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

async function upload(pathname, filePath, user, extra = {}) {
  const form = new FormData();
  form.append('file', new Blob([fs.readFileSync(filePath)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), path.basename(filePath));
  form.append('user', user);
  Object.entries(extra).forEach(([key, value]) => form.append(key, value));
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
  const pdmFile = path.join(qaDir, 'PDMs Cadastrados KlassmattV2.xlsx');
  const materialFile = path.join(qaDir, 'materiais-match-pdm-real.xlsx');
  const totalPdms = 2772;
  const totalMaterials = 2005;

  const registeredName = `Consultor PDM ${suffix}`;
  const suggestion = await (await api(`/auth/suggest-login?name=${encodeURIComponent(registeredName)}`)).json();
  await api('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: registeredName, email: `qa.pdm.${suffix}@example.com`, password: '654321', confirmPassword: '654321' })
  });
  const registeredLogin = await login(suggestion.username, '654321');
  const consultant = registeredLogin.user.username;

  const baseRows = [
    { 'Id Padrão': '1', 'Nome Válido': '(NÃO-PADRONIZADO)' },
    { 'Id Padrão': '20015', 'Nome Válido': 'ABAFADOR RUIDO' },
    { 'Id Padrão': '17379', 'Nome Válido': 'ABAIXADOR LINGUA' },
    { 'Id Padrão': '20016', 'Nome Válido': 'ABRACADEIRA' }
  ];
  for (let index = baseRows.length + 1; index <= totalPdms; index += 1) {
    baseRows.push({ 'Id Padrão': String(50000 + index), 'Nome Válido': `PDM TESTE ${String(index).padStart(4, '0')}` });
  }
  makeWorkbook(pdmFile, baseRows, 'Planilha1');

  const pdmImport = await upload('/pdms/import', pdmFile, consultant, { mode: 'replace' });
  if (pdmImport.read !== totalPdms || pdmImport.imported !== totalPdms || pdmImport.ignored !== 0) {
    throw new Error(`Importacao PDM real simulada falhou: ${JSON.stringify(pdmImport)}`);
  }

  const pdmStatus = await (await api('/pdms/status')).json();
  if (pdmStatus.count !== totalPdms || pdmStatus.attributeCount !== 0) {
    throw new Error(`Total salvo de PDMs incorreto: ${JSON.stringify(pdmStatus)}`);
  }

  const pdmQuery = await (await api('/pdms?q=ABRACADEIRA')).json();
  if (!pdmQuery.some((pdm) => String(pdm.id_pdm) === '20016' && pdm.nome_valido === 'ABRACADEIRA')) {
    throw new Error(`PDM ABRACADEIRA nao encontrado apos importacao: ${JSON.stringify(pdmQuery.slice(0, 3))}`);
  }

  const materialRows = Array.from({ length: totalMaterials }, (_, index) => {
    const number = String(index + 1).padStart(5, '0');
    const kind = index % 3;
    if (kind === 0) {
      return {
        Codigo: `MAT-PDM-${number}`,
        'Texto breve': `ABRACADEIRA INOX ${number}`,
        'Texto Longo': `ABRACADEIRA INOX PARA TUBO; PN ABR-${number}; FAB METALQA`
      };
    }
    if (kind === 1) {
      return {
        Codigo: `MAT-PDM-${number}`,
        'Texto breve': `ABAFADOR RUIDO CONCHA ${number}`,
        'Texto Longo': `ABAFADOR RUIDO TIPO CONCHA; PN ABA-${number}; FAB SAFETYQA`
      };
    }
    return {
      Codigo: `MAT-PDM-${number}`,
      'Texto breve': `ABAIXADOR LINGUA MADEIRA ${number}`,
      'Texto Longo': `ABAIXADOR LINGUA MADEIRA DESCARTAVEL; PN ABL-${number}; FAB MEDQA`
    };
  });
  makeWorkbook(materialFile, materialRows, 'Planilha1');

  const materialImport = await upload('/materials/import', materialFile, consultant);
  if (materialImport.read !== totalMaterials || materialImport.imported !== totalMaterials || materialImport.ignored !== 0) {
    throw new Error(`Importacao materiais falhou: ${JSON.stringify(materialImport)}`);
  }

  const materials = await (await api('/materials')).json();
  if (materials.length !== totalMaterials) throw new Error(`Listagem retornou ${materials.length}, esperado ${totalMaterials}`);
  const first = materials.find((row) => row.codigo === 'MAT-PDM-00001');
  const second = materials.find((row) => row.codigo === 'MAT-PDM-00002');
  const third = materials.find((row) => row.codigo === 'MAT-PDM-00003');
  const last = materials[materials.length - 1];
  if (first?.suggested_pdm_id !== '20016' || second?.suggested_pdm_id !== '20015' || third?.suggested_pdm_id !== '17379') {
    throw new Error(`Match PDM inconsistente: ${JSON.stringify(materials.map((row) => ({ codigo: row.codigo, pdm: row.suggested_pdm_id, reason: row.suggestion_reason })))}`);
  }
  if (last.codigo !== 'MAT-PDM-02005' || last.row_number !== 2006) {
    throw new Error(`Ultima linha perdeu ordem/vinculo: ${JSON.stringify(last)}`);
  }

  await api(`/materials/${first.id}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user: consultant })
  });

  const dashboard = await (await api('/dashboard')).json();
  if (dashboard.cards.total !== totalMaterials || dashboard.latestImport.file_name !== path.basename(materialFile)) {
    throw new Error(`Dashboard inconsistente: ${JSON.stringify(dashboard)}`);
  }

  const exportFinal = await api(`/export/final?user=${encodeURIComponent(consultant)}`);
  const exportComplete = await api(`/export/complete?user=${encodeURIComponent(consultant)}`);
  const finalRows = XLSX.utils.sheet_to_json(XLSX.read(Buffer.from(await exportFinal.arrayBuffer())).Sheets['Resultado Final']);
  const completeRows = XLSX.utils.sheet_to_json(XLSX.read(Buffer.from(await exportComplete.arrayBuffer())).Sheets['Base Completa']);
  if (finalRows.length !== totalMaterials || completeRows.length !== totalMaterials) {
    throw new Error(`Exportacao inconsistente: final=${finalRows.length}, completa=${completeRows.length}`);
  }

  await api('/admin/clear-operational-data', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user: 'admin' })
  });

  console.log(JSON.stringify({
    ok: true,
    consultant,
    pdmImport: {
      read: pdmImport.read,
      imported: pdmImport.imported,
      ignored: pdmImport.ignored,
      totalAttributes: pdmImport.totalAttributes,
      columns: pdmImport.columns
    },
    pdmStatus,
    materialImport,
    firstMatches: materials.slice(0, 3).map((row) => ({
      codigo: row.codigo,
      pdm: row.suggested_pdm_id,
      nome: row.suggested_pdm_name,
      status: row.status,
      confidence: row.confidence,
      reason: row.suggestion_reason
    })),
    lastRow: {
      codigo: last.codigo,
      pdm: last.suggested_pdm_id,
      row_number: last.row_number
    },
    dashboard: dashboard.cards,
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
