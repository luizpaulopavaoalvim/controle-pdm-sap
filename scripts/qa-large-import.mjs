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

async function upload(pathname, filePath, user) {
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
  const pdmFile = path.join(qaDir, 'pdm-simples-qa.xlsx');
  const materialFile = path.join(qaDir, 'materiais-2005-qa.xlsx');
  const totalMaterials = 2005;

  const registeredName = `Consultor Grande ${suffix}`;
  const suggestion = await (await api(`/auth/suggest-login?name=${encodeURIComponent(registeredName)}`)).json();
  await api('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: registeredName, email: `qa.large.${suffix}@example.com`, password: '654321', confirmPassword: '654321' })
  });
  const registeredLogin = await login(suggestion.username, '654321');
  const consultant = registeredLogin.user.username;

  makeWorkbook(pdmFile, [
    { 'Id Padrao': '1', 'Nome Valido': '(NAO-PADRONIZADO)', Ignorar: 'coluna extra' },
    { 'Id Padrao': '20016', 'Nome Valido': 'ABRACADEIRA', Ignorar: 'coluna extra' },
    { 'Id Padrao': '20015', 'Nome Valido': 'ABAFADOR RUIDO', Ignorar: 'coluna extra' },
    { 'Id Padrao': '30000', 'Nome Valido': 'BOTA SEGURANCA', Ignorar: 'coluna extra' }
  ], 'Parte1');

  const materialRows = Array.from({ length: totalMaterials }, (_, index) => {
    const number = String(index + 1).padStart(5, '0');
    const kind = index % 3;
    if (kind === 0) {
      return {
        Codigo: `LG${number}`,
        'Texto breve': `ABRACADEIRA INOX ${number}`,
        'Texto Longo': `ABRACADEIRA INOX PARA TUBO; PN ABR-${number}; FAB METALQA`
      };
    }
    if (kind === 1) {
      return {
        Codigo: `LG${number}`,
        'Texto breve': `ABAFADOR RUIDO ${number}`,
        'Texto Longo': `ABAFADOR RUIDO CONCHA; PN ABA-${number}; FAB SAFETYQA`
      };
    }
    return {
      Codigo: `LG${number}`,
      'Texto breve': `BOTA SEGURANCA ${number}`,
      'Texto Longo': `BOTA SEGURANCA COURO PRETO; PN BOT-${number}; FAB BOOTQA`
    };
  });
  makeWorkbook(materialFile, materialRows);

  const pdmImport = await upload('/pdms/import', pdmFile, consultant);
  if (pdmImport.read !== 4 || pdmImport.imported !== 4 || pdmImport.totalAttributes !== 0) {
    throw new Error(`Importacao PDM simples inesperada: ${JSON.stringify(pdmImport)}`);
  }

  const materialImport = await upload('/materials/import', materialFile, consultant);
  if (materialImport.read !== totalMaterials || materialImport.imported !== totalMaterials || materialImport.ignored !== 0) {
    throw new Error(`Importacao grande inconsistente: ${JSON.stringify(materialImport)}`);
  }

  const allRows = await (await api('/materials')).json();
  if (allRows.length !== totalMaterials) throw new Error(`Listagem retornou ${allRows.length}, esperado ${totalMaterials}`);
  if (allRows[0].codigo !== 'LG00001' || allRows[0].descricao !== 'ABRACADEIRA INOX 00001' || allRows[0].row_number !== 2) {
    throw new Error(`Primeira linha perdeu ordem/vinculo: ${JSON.stringify(allRows[0])}`);
  }
  const last = allRows[allRows.length - 1];
  if (last.codigo !== 'LG02005' || last.descricao !== 'ABRACADEIRA INOX 02005' || last.row_number !== 2006) {
    throw new Error(`Ultima linha perdeu ordem/vinculo: ${JSON.stringify(last)}`);
  }
  if (allRows[0].suggested_pdm_id !== '20016' || allRows[1].suggested_pdm_id !== '20015' || allRows[2].suggested_pdm_id !== '30000') {
    throw new Error(`Match PDM inconsistente nos primeiros itens: ${JSON.stringify(allRows.slice(0, 3).map((row) => ({ codigo: row.codigo, pdm: row.suggested_pdm_id, reason: row.suggestion_reason })))}`);
  }

  const exportFinal = await api(`/export/final?user=${encodeURIComponent(consultant)}`);
  const exportComplete = await api(`/export/complete?user=${encodeURIComponent(consultant)}`);
  const exportOk = await api(`/export/status/OK?user=${encodeURIComponent(consultant)}`);
  const exportHistory = await api(`/export/history?user=${encodeURIComponent(consultant)}`);
  const exportDashboard = await api(`/export/dashboard-summary?user=${encodeURIComponent(consultant)}`);
  const finalRows = XLSX.utils.sheet_to_json(XLSX.read(Buffer.from(await exportFinal.arrayBuffer())).Sheets['Resultado Final']);
  const completeRows = XLSX.utils.sheet_to_json(XLSX.read(Buffer.from(await exportComplete.arrayBuffer())).Sheets['Base Completa']);
  const okRows = XLSX.utils.sheet_to_json(XLSX.read(Buffer.from(await exportOk.arrayBuffer())).Sheets['Somente OK']);
  const historyRows = XLSX.utils.sheet_to_json(XLSX.read(Buffer.from(await exportHistory.arrayBuffer())).Sheets['Historico']);
  const dashboardRows = XLSX.utils.sheet_to_json(XLSX.read(Buffer.from(await exportDashboard.arrayBuffer())).Sheets['Resumo Dashboard']);
  if (finalRows.length !== totalMaterials || completeRows.length !== totalMaterials) {
    throw new Error(`Exportacao nao bate com total importado: final=${finalRows.length}, completa=${completeRows.length}`);
  }
  if (okRows.length !== totalMaterials || !historyRows.length || !dashboardRows.length) {
    throw new Error(`Exportacoes inteligentes inconsistentes: ok=${okRows.length}, historico=${historyRows.length}, dashboard=${dashboardRows.length}`);
  }

  const adminDeleteBlocked = await fetch('http://127.0.0.1:4000/api/admin/clear-operational-data', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user: consultant })
  });
  if (adminDeleteBlocked.status !== 403) throw new Error(`Consultor conseguiu apagar dados: HTTP ${adminDeleteBlocked.status}`);

  const clearResponse = await api('/admin/clear-operational-data', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user: 'admin' })
  });
  const clearPayload = await clearResponse.json();
  if (clearPayload.message !== 'Dados apagados com sucesso.') throw new Error(`Mensagem de limpeza inesperada: ${JSON.stringify(clearPayload)}`);

  const dashboardAfterClear = await (await api('/dashboard')).json();
  const usersAfterClear = await (await api('/auth/users')).json();
  const pdmsAfterClear = await (await api('/pdms')).json();
  const historyAfterClear = await (await api('/history')).json();
  if (dashboardAfterClear.cards.total !== 0 || dashboardAfterClear.cards.totalClassified !== 0) {
    throw new Error(`Dashboard nao zerou apos limpeza: ${JSON.stringify(dashboardAfterClear.cards)}`);
  }
  if (!usersAfterClear.some((user) => user.username === 'admin') || !usersAfterClear.some((user) => user.username === consultant)) {
    throw new Error('Usuarios foram apagados pela limpeza operacional');
  }
  if (!pdmsAfterClear.some((pdm) => String(pdm.id_pdm) === '1')) {
    throw new Error('PDM fallback nao foi recriado apos limpeza');
  }
  if (!historyAfterClear.some((row) => row.action === 'Todos os dados operacionais foram apagados')) {
    throw new Error('Historico nao registrou a limpeza operacional');
  }

  console.log(JSON.stringify({
    ok: true,
    consultant,
    pdmImport: {
      read: pdmImport.read,
      imported: pdmImport.imported,
      ignored: pdmImport.ignored,
      totalAttributes: pdmImport.totalAttributes
    },
    materialImport,
    firstRows: allRows.slice(0, 3).map((row) => ({
      codigo: row.codigo,
      descricao: row.descricao,
      row_number: row.row_number,
      pdm: row.suggested_pdm_id,
      status: row.status,
      confidence: row.confidence,
      reason: row.suggestion_reason
    })),
    lastRow: {
      codigo: last.codigo,
      descricao: last.descricao,
      row_number: last.row_number,
      pdm: last.suggested_pdm_id
    },
    exportFinalRows: finalRows.length,
    exportCompleteRows: completeRows.length,
    exportOkRows: okRows.length,
    exportHistoryRows: historyRows.length,
    exportDashboardRows: dashboardRows.length,
    clearMessage: clearPayload.message,
    usersPreserved: usersAfterClear.length,
    dashboardAfterClear: dashboardAfterClear.cards,
    historyAfterClear: historyAfterClear.length
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
