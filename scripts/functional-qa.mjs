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
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${pathname} falhou: HTTP ${response.status} ${text}`);
  }
  return response;
}

function makeWorkbook(filePath, rows, sheetName = 'Planilha1') {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  fs.writeFileSync(filePath, XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
}

async function upload(pathname, filePath, user = 'consultor') {
  const form = new FormData();
  form.append('file', new Blob([fs.readFileSync(filePath)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), path.basename(filePath));
  form.append('user', user);
  if (pathname.includes('/pdms/import')) form.append('mode', 'replace');
  const response = await api(pathname, { method: 'POST', body: form });
  return response.json();
}

async function login(username, password) {
  const response = await api('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  return response.json();
}

try {
  await waitFor('http://127.0.0.1:4000/api/health');
  await waitFor('http://127.0.0.1:5173');

  const suffix = String(Date.now()).slice(-6);
  const qaDir = path.join(root, 'tmp-qa');
  fs.mkdirSync(qaDir, { recursive: true });
  const pdmId = `9${suffix}`;
  const materialCode = `QA${suffix}`;
  const uniqueToken = `TOKENQA${suffix}`;
  const pdmFile = path.join(qaDir, 'base-pdm-klassmatt-qa.xlsx');
  const materialFile = path.join(qaDir, 'Materiais Prioridade Alta.xlsx');

  makeWorkbook(pdmFile, [
    { 'Id Padrão': '1', 'Nome Válido': '(NÃO-PADRONIZADO)', DT_01: 'Texto longo', DT_02: 'Texto curto' },
    { 'Id Padrão': pdmId, 'Nome Válido': `BOTA SEGURANCA ${uniqueToken}`, DT_01: 'MATERIAL CORPO', DT_02: 'COR CORPO', DT_03: 'TAMANHO BOTA', DT_04: 'TIPO CANO', DT_05: 'CARACTERISTICAS ADICIONAIS' }
  ], 'Parte1');

  makeWorkbook(materialFile, [
    {
      'Código': materialCode,
      'Texto Breve': `BOTA SEGURANCA FIRE1015090-35 ${uniqueToken}`,
      'Texto Longo': `BOTA SEGURANCA ${uniqueToken}; MATERIAL CORPO: COURO; COR CORPO: PRETO; TAMANHO BOTA: 35; TIPO CANO: LONGO; CARACTERISTICAS ADICIONAIS: BOTA BRIGADISTA; PN FIRE1015090-35; FAB GUARTELA`
    },
    {
      'Código': `${materialCode}B`,
      'Texto Breve': `BOTA SEGURANCA RESERVA ${uniqueToken}`,
      'Texto Longo': `BOTA SEGURANCA ${uniqueToken}; MATERIAL CORPO: COURO; COR CORPO: PRETO; PN RESERVA-01; FAB GUARTELA`
    }
  ]);

  const users = [await login('admin', '123456')];
  const registeredName = `Usuario QA ${suffix}`;
  const suggestion = await (await api(`/auth/suggest-login?name=${encodeURIComponent(registeredName)}`)).json();
  await api('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: registeredName, email: `qa${suffix}@example.com`, password: '654321', confirmPassword: '654321' })
  });
  const registeredLogin = await login(suggestion.username, '654321');
  const consultant = registeredLogin.user.username;

  const dashboardBefore = await (await api('/dashboard')).json();
  const adminBlocked = await fetch('http://127.0.0.1:4000/api/export/final?user=admin');
  const pdmImport = await upload('/pdms/import', pdmFile, consultant);
  const pdmStatus = await (await api('/pdms/status')).json();
  if (pdmImport.totalAttributes < 7 || pdmStatus.count < 2) throw new Error(`PDMs/atributos nao importados: ${JSON.stringify({ pdmImport, pdmStatus })}`);

  const materialImport = await upload('/materials/import', materialFile, consultant);
  const allRows = await (await api('/materials')).json();
  if (allRows[0]?.codigo !== materialCode || allRows[1]?.codigo !== `${materialCode}B`) {
    throw new Error(`Ordem da planilha nao preservada: ${allRows.map((row) => row.codigo).join(', ')}`);
  }

  const filtered = await (await api(`/materials?q=${encodeURIComponent(materialCode)}`)).json();
  const material = filtered[0];
  if (!material) throw new Error('Material importado nao encontrado na listagem');
  if (material.suggested_pdm_id !== pdmId) throw new Error(`PDM sugerido inesperado: ${material.suggested_pdm_id}, esperado ${pdmId}`);

  await api(`/materials/${material.id}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user: consultant })
  });

  const afterGenerate = (await (await api(`/materials?q=${encodeURIComponent(materialCode)}`)).json())[0];
  const dashboardAfter = await (await api('/dashboard')).json();
  if (dashboardAfter.latestImport?.file_name !== path.basename(materialFile)) {
    throw new Error(`Dashboard sem nome da ultima planilha: ${JSON.stringify(dashboardAfter.latestImport)}`);
  }
  const history = await (await api(`/history?codigo=${encodeURIComponent(materialCode)}`)).json();
  const exportFinal = await api(`/export/final?user=${encodeURIComponent(consultant)}`);
  const exportComplete = await api(`/export/complete?user=${encodeURIComponent(consultant)}`);
  const finalRows = XLSX.utils.sheet_to_json(XLSX.read(Buffer.from(await exportFinal.arrayBuffer())).Sheets['Resultado Final']);
  const completeRows = XLSX.utils.sheet_to_json(XLSX.read(Buffer.from(await exportComplete.arrayBuffer())).Sheets['Base Completa']);
  if (!finalRows.length || !completeRows.length) throw new Error('Exportacao Excel vazia');

  console.log(JSON.stringify({
    ok: true,
    users: users.map(({ user }) => ({ username: user.username, role: user.role })),
    registeredUser: { username: registeredLogin.user.username, role: registeredLogin.user.role },
    adminReadOnlyExportStatus: adminBlocked.status,
    dashboardBefore: dashboardBefore.cards,
    pdmImport,
    pdmStatus,
    materialImport,
    dashboardTitleFile: dashboardAfter.latestImport?.file_name,
    importedOrder: allRows.map((row) => ({ codigo: row.codigo, row_number: row.row_number })),
    material: {
      codigo: afterGenerate.codigo,
      pdm: afterGenerate.suggested_pdm_id,
      status: afterGenerate.status,
      confidence: afterGenerate.confidence,
      short_pt: afterGenerate.short_pt,
      short_en: afterGenerate.short_en
    },
    historyCount: history.length,
    exportFinalRows: finalRows.length,
    exportCompleteRows: completeRows.length
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
