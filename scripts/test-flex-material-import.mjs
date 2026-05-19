import { spawn, spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import * as XLSX from '../server/node_modules/xlsx/xlsx.mjs';

const isWindows = process.platform === 'win32';
const root = process.cwd();
const dev = spawn(isWindows ? 'npm.cmd run dev' : 'npm', isWindows ? [] : ['run', 'dev'], {
  cwd: root,
  shell: isWindows,
  stdio: ['ignore', 'pipe', 'pipe']
});

let output = '';
dev.stdout.on('data', (chunk) => { output += chunk.toString(); });
dev.stderr.on('data', (chunk) => { output += chunk.toString(); });

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(url) {
  for (let i = 0; i < 60; i += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // wait
    }
    await delay(750);
  }
  throw new Error(`Timeout aguardando ${url}\n${output}`);
}

function stop() {
  if (isWindows) {
    spawnSync('cmd.exe', ['/c', 'taskkill', '/PID', String(dev.pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    try { process.kill(-dev.pid, 'SIGTERM'); } catch {}
  }
}

function writeWorkbook(filePath, rows) {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Planilha1');
  fs.writeFileSync(filePath, XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
}

async function api(pathname, options = {}) {
  const response = await fetch(`http://127.0.0.1:4000/api${pathname}`, options);
  if (!response.ok && response.status !== 409) throw new Error(await response.text());
  return response;
}

async function upload(filePath, user) {
  const form = new FormData();
  form.append('file', new Blob([fs.readFileSync(filePath)], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  }), path.basename(filePath));
  form.append('user', user);
  const response = await fetch('http://127.0.0.1:4000/api/materials/import', { method: 'POST', body: form });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

try {
  await waitFor('http://127.0.0.1:4000/api/health');
  await waitFor('http://127.0.0.1:5173');
  const suffix = Date.now().toString().slice(-6);
  const name = `Flex User ${suffix}`;
  const suggestion = await (await api(`/auth/suggest-login?name=${encodeURIComponent(name)}`)).json();
  await api('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email: `flex${suffix}@example.com`, password: '123456', confirmPassword: '123456' })
  });
  const user = suggestion.username;

  const qaDir = path.join(root, 'tmp-qa');
  fs.mkdirSync(qaDir, { recursive: true });
  const code = `FLEX${Date.now().toString().slice(-6)}`;
  const file = path.join(qaDir, 'materiais-cabecalho-flexivel.xlsx');
  writeWorkbook(file, [
    { 'Código': code, 'Texto breve  ': 'ABRACADEIRA INOX 2 POL', 'Texto Longo ': 'ABRACADEIRA ACO INOX PARA TUBULACAO 2 POL' },
    { 'Código': '', 'Texto breve  ': '', 'Texto Longo ': '' },
    { 'Código': `FLEX${Date.now().toString().slice(-5)}B`, 'Texto breve  ': '', 'Texto Longo ': 'ABAFADOR RUIDO INDUSTRIAL' }
  ]);

  const result = await upload(file, user);
  const rows = await (await fetch(`http://127.0.0.1:4000/api/materials?q=${encodeURIComponent('FLEX')}`)).json();
  if (result.read !== 3 || result.imported !== 2 || result.ignored !== 1) {
    throw new Error(`Resumo inesperado: ${JSON.stringify(result)}`);
  }
  if (rows.length < 2) {
    throw new Error(`Materiais FLEX nao encontrados: ${rows.length}`);
  }

  console.log(JSON.stringify({ ok: true, result, importedCodes: rows.map((row) => row.codigo).slice(0, 5) }, null, 2));
} catch (error) {
  console.error(error);
  console.error(output);
  process.exitCode = 1;
} finally {
  stop();
  process.exit(process.exitCode || 0);
}
