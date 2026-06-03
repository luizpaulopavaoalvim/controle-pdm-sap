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

async function stopTree(pid) {
  if (!pid) return;
  if (isWindows) {
    spawnSync('cmd.exe', ['/c', 'taskkill', '/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
    return;
  }
  try { process.kill(-pid, 'SIGTERM'); } catch {}
}

async function waitFor(url, timeoutMs = 45000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
    } catch {}
    await delay(750);
  }
  throw new Error(`Timeout aguardando ${url}\n\n${output}`);
}

async function api(pathname, options = {}) {
  const response = await fetch(`http://127.0.0.1:4000/api${pathname}`, options);
  if (!response.ok) throw new Error(`${pathname} falhou: HTTP ${response.status} ${await response.text()}`);
  return response;
}

function makeWorkbook(filePath, rows, sheetName = 'Planilha1') {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  fs.writeFileSync(filePath, XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
}

async function upload(pathname, filePath, user) {
  const form = new FormData();
  form.append('file', new Blob([fs.readFileSync(filePath)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), path.basename(filePath));
  form.append('user', user);
  if (pathname.includes('/pdms/import')) form.append('mode', 'replace');
  return (await api(pathname, { method: 'POST', body: form })).json();
}

async function login(username, password) {
  return (await api('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  })).json();
}

try {
  await waitFor('http://127.0.0.1:4000/api/health');
  await waitFor('http://127.0.0.1:5173');

  const suffix = String(Date.now()).slice(-6);
  const qaDir = path.join(root, 'tmp-qa');
  fs.mkdirSync(qaDir, { recursive: true });
  const pdmFile = path.join(qaDir, 'base-pdm-transmitter.xlsx');
  const materialFile = path.join(qaDir, 'material-transmitter-pressure.xlsx');
  const materialCode = `TR${suffix}`;

  makeWorkbook(pdmFile, [
    { 'Id Padrao': '1', 'Nome Valido': '(NAO-PADRONIZADO)' },
    { 'Id Padrao': '70001', 'Nome Valido': 'SILICONE' },
    { 'Id Padrao': '70002', 'Nome Valido': 'TRANSMISSOR PRESSAO' }
  ]);

  makeWorkbook(materialFile, [{
    Codigo: materialCode,
    'Texto Breve': 'TR.,3051TG3A2B21KB4K2Q4Q8M5T1CNP1HR7,EM',
    'Texto Longo': [
      'Name: TRANSMITTER, PRESSURE',
      'Manufacturer Name: EMERSON PROCESS MANAGEMENT',
      'Manufacturer Part Number: 3051TG3A2B21KB4K2Q4Q8M5T1CNP1HR7',
      'Manufacturer Model/Type: 3051T',
      'Pressure type: Gage',
      'Pressure range: -14.7 to 800 psi',
      'Transmitter output: 4-20 mA with HART Protocol',
      'Sensor fill fluid: Silicone',
      'Housing material: Stainless steel'
    ].join('\n')
  }]);

  const registeredName = `Usuario Transmitter ${suffix}`;
  const suggestion = await (await api(`/auth/suggest-login?name=${encodeURIComponent(registeredName)}`)).json();
  await api('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: registeredName, email: `transmitter${suffix}@example.com`, password: '654321', confirmPassword: '654321' })
  });
  const { user } = await login(suggestion.username, '654321');

  const pdmImport = await upload('/pdms/import', pdmFile, user.username);
  const materialImport = await upload('/materials/import', materialFile, user.username);
  const rows = await (await api(`/materials?q=${encodeURIComponent(materialCode)}`)).json();
  const material = rows[0];
  if (!material) throw new Error('Material TRANSMITTER nao encontrado apos importacao');
  if (material.suggested_pdm_id === '70001' || /SILICONE/i.test(material.suggested_pdm_name || '')) {
    throw new Error(`PDM secundario SILICONE foi sugerido indevidamente: ${JSON.stringify(material)}`);
  }
  if (material.suggested_pdm_id !== '70002') {
    throw new Error(`PDM transmissor esperado 70002, recebido ${material.suggested_pdm_id}: ${material.suggestion_reason}`);
  }
  if (material.status !== 'OK') {
    throw new Error(`Status esperado OK para match principal forte, recebido ${material.status}`);
  }
  if (!/Name|campo principal|TRANSMITTER|PRESSURE/i.test(material.suggestion_reason || '')) {
    throw new Error(`Motivo nao explica campo principal: ${material.suggestion_reason}`);
  }
  if (!/SILICONE|STAINLESS|HART/i.test(material.doubtful_words || '')) {
    throw new Error(`Atributos secundarios nao foram destacados: ${material.doubtful_words}`);
  }

  await api(`/materials/${material.id}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user: user.username, status: 'VALIDAR' })
  });
  const reprocessBulk = await (await api('/materials/reprocess', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user: user.username, statuses: ['VALIDAR'] })
  })).json();
  if (reprocessBulk.reprocessed < 1) throw new Error(`Reprocessamento em lote nao executado: ${JSON.stringify(reprocessBulk)}`);
  const afterBulk = (await (await api(`/materials?q=${encodeURIComponent(materialCode)}`)).json())[0];
  if (afterBulk.suggested_pdm_id !== '70002' || afterBulk.status !== 'OK') {
    throw new Error(`Reprocessamento perdeu match principal: ${JSON.stringify(afterBulk)}`);
  }
  await api(`/materials/${afterBulk.id}/reprocess`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user: user.username })
  });
  const history = await (await api(`/history?codigo=${encodeURIComponent(materialCode)}`)).json();
  if (!history.some((item) => item.action === 'Material reprocessado')) {
    throw new Error(`Historico de reprocessamento nao encontrado: ${JSON.stringify(history)}`);
  }
  const exportFinal = await api(`/export/final?user=${encodeURIComponent(user.username)}`);
  const finalRows = XLSX.utils.sheet_to_json(XLSX.read(Buffer.from(await exportFinal.arrayBuffer())).Sheets['Resultado Final']);
  if (!finalRows.length) throw new Error('Exportacao final vazia apos reprocessamento');
  const dashboard = await (await api('/dashboard')).json();

  console.log(JSON.stringify({
    ok: true,
    pdmImport,
    materialImport,
    material: {
      codigo: afterBulk.codigo,
      pdm: afterBulk.suggested_pdm_id,
      nome: afterBulk.suggested_pdm_name,
      status: afterBulk.status,
      confidence: afterBulk.confidence,
      reason: afterBulk.suggestion_reason,
      matchedWords: afterBulk.matched_words,
      ignoredSecondary: afterBulk.doubtful_words
    },
    reprocessBulk,
    historyCount: history.length,
    exportFinalRows: finalRows.length,
    dashboardTotal: dashboard.cards?.total
  }, null, 2));
} catch (error) {
  console.error(error);
  console.error(output);
  process.exitCode = 1;
} finally {
  await stopTree(dev.pid);
  dev.stdout.destroy();
  dev.stderr.destroy();
  process.exit(process.exitCode || 0);
}
