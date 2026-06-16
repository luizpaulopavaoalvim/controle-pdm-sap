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

async function login(username, password) {
  return (await api('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  })).json();
}

function makeWorkbook(filePath, sheets) {
  const workbook = XLSX.utils.book_new();
  for (const [sheetName, rows] of Object.entries(sheets)) {
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), sheetName);
  }
  fs.writeFileSync(filePath, XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
}

async function upload(pathname, filePath, user) {
  const form = new FormData();
  form.append('file', new Blob([fs.readFileSync(filePath)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), path.basename(filePath));
  form.append('user', user);
  if (pathname.includes('/pdms/import')) form.append('mode', 'replace');
  return (await api(pathname, { method: 'POST', body: form })).json();
}

try {
  await waitFor('http://127.0.0.1:4000/api/health');
  await waitFor('http://127.0.0.1:5173');

  const suffix = String(Date.now()).slice(-6);
  const qaDir = path.join(root, 'tmp-qa');
  fs.mkdirSync(qaDir, { recursive: true });
  const pdmFile = path.join(qaDir, 'Padroes DT Mesclados PRIO.xlsx');
  const materialFile = path.join(qaDir, 'materiais-dados-tecnicos.xlsx');
  const materialCode = `DT${suffix}`;

  makeWorkbook(pdmFile, {
    Resultado: [
      { 'Id Padrao': '1', 'Nome Valido': '(NAOPADRONIZADO)', 'Dados Tecnicos': '' },
      { 'Id Padrao': '30000', 'Nome Valido': 'BOTA SEGURANCA', 'Dados Tecnicos': 'MATERIAL CORPO,COR CORPO,TAMANHO BOTA,TIPO CANO,CARACTERISTICAS ADICIONAIS' },
      { 'Id Padrao': '70001', 'Nome Valido': 'SILICONE', 'Dados Tecnicos': 'TIPO,MATERIAL' },
      { 'Id Padrao': '70002', 'Nome Valido': 'TRANSMISSOR PRESSAO', 'Dados Tecnicos': 'TIPO PRESSAO,FAIXA PRESSAO,SAIDA TRANSMISSOR,FLUIDO SENSOR,MATERIAL CARCACA' }
    ],
    Planilha1: [
      { 'Id Padrao': '99999', 'Nome Valido': 'NAO USAR', 'Dados Tecnicos': 'ERRO' }
    ]
  });

  makeWorkbook(materialFile, {
    Planilha1: [{
      Codigo: materialCode,
      'Texto Breve': 'BOTA SEGURANCA FIRE1015090-35',
      'Texto Longo': 'BOTA SEGURANCA; MATERIAL CORPO: COURO; COR CORPO: PRETO; TAMANHO BOTA: 35; TIPO CANO: LONGO; CARACTERISTICAS ADICIONAIS: BOTA BRIGADISTA; PN FIRE1015090-35; FAB GUARTELA'
    }, {
      Codigo: `${materialCode}TR`,
      'Texto Breve': 'TR.,3051TG3A2B21KB4K2Q4Q8M5T1CNP1HR7,EM',
      'Texto Longo': [
        'Name: TRANSMITTER, PRESSURE',
        'Manufacturer Name: EMERSON PROCESS MANAGEMENT',
        'Manufacturer Part Number: 3051TG3A2B21KB4K2Q4Q8M5T1CNP1HR7',
        'Pressure type: Gage',
        'Sensor fill fluid: Silicone',
        'Housing material: Stainless steel'
      ].join('\n')
    }]
  });

  const registeredName = `Usuario Dados Tecnicos ${suffix}`;
  const suggestion = await (await api(`/auth/suggest-login?name=${encodeURIComponent(registeredName)}`)).json();
  await api('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: registeredName, email: `dt${suffix}@example.com`, password: '654321', confirmPassword: '654321' })
  });
  const { user } = await login(suggestion.username, '654321');

  const pdmImport = await upload('/pdms/import', pdmFile, user.username);
  if (pdmImport.sheetName !== 'Resultado') throw new Error(`Aba Resultado nao priorizada: ${pdmImport.sheetName}`);
  if (pdmImport.imported !== 4 || pdmImport.withTechnicalData !== 3 || pdmImport.withoutTechnicalData !== 1) {
    throw new Error(`Resumo PDM inesperado: ${JSON.stringify(pdmImport)}`);
  }
  if (pdmImport.totalAttributes !== 12) throw new Error(`Total de atributos inesperado: ${pdmImport.totalAttributes}`);

  const pdms = await (await api('/pdms?q=BOTA')).json();
  const botaPdm = pdms.find((row) => row.id_padrao === '30000');
  if (!botaPdm || botaPdm.attribute_count !== 5 || !/MATERIAL CORPO/.test(botaPdm.dados_tecnicos || '')) {
    throw new Error(`PDM BOTA sem Dados Tecnicos importados: ${JSON.stringify(botaPdm)}`);
  }

  const materialImport = await upload('/materials/import', materialFile, user.username);
  if (materialImport.imported !== 2) throw new Error(`Importacao materiais inesperada: ${JSON.stringify(materialImport)}`);
  const rows = await (await api(`/materials?q=${encodeURIComponent(materialCode)}`)).json();
  const bota = rows.find((row) => row.codigo === materialCode);
  const transmitter = rows.find((row) => row.codigo === `${materialCode}TR`);
  if (!bota || !transmitter) throw new Error(`Materiais nao encontrados: ${JSON.stringify(rows)}`);
  if (bota.suggested_pdm_id !== '30000') throw new Error(`BOTA sugeriu PDM errado: ${bota.suggested_pdm_id}`);
  if (transmitter.suggested_pdm_id !== '70002') throw new Error(`TRANSMITTER sugeriu PDM errado: ${transmitter.suggested_pdm_id}`);
  if (transmitter.suggested_pdm_id === '70001') throw new Error('TRANSMITTER sugeriu SILICONE indevidamente');
  if (!/MATERIAL CORPO/.test(bota.technical_attributes || '')) throw new Error(`Dados tecnicos nao exibidos no material: ${bota.technical_attributes}`);
  if ((bota.short_pt || '').length > 40 || (bota.short_en || '').length > 40) throw new Error(`Texto breve acima de 40: ${bota.short_pt} / ${bota.short_en}`);
  if (!/MATERIAL CORPO: COURO/.test(bota.long_pt || '') || !/COR CORPO: PRETO/.test(bota.long_pt || '')) {
    throw new Error(`Texto longo sem atributos tecnicos: ${bota.long_pt}`);
  }
  if (!/FIRE1015090-35\/GUARTELA$/.test(bota.long_pt || '')) throw new Error(`PN/FAB nao ficou no final: ${bota.long_pt}`);
  if (/NAO INFORMADO|PECA INDUSTRIAL/i.test(`${bota.short_pt} ${bota.long_pt}`)) throw new Error(`Texto inventado/generico detectado: ${bota.long_pt}`);

  await api(`/materials/${bota.id}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user: user.username, status: 'VALIDAR' })
  });
  const reprocess = await (await api('/materials/reprocess', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user: user.username, statuses: ['VALIDAR', 'REVISAR'] })
  })).json();
  if (reprocess.reprocessed < 1) throw new Error(`Reprocessamento nao executado: ${JSON.stringify(reprocess)}`);

  const afterReprocess = await (await api(`/materials?q=${encodeURIComponent(materialCode)}`)).json();
  for (const row of afterReprocess) {
    await api(`/materials/${row.id}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user: user.username })
    });
  }

  const exportFinal = await api(`/export/final?user=${encodeURIComponent(user.username)}`);
  const finalRows = XLSX.utils.sheet_to_json(XLSX.read(Buffer.from(await exportFinal.arrayBuffer())).Sheets['Resultado Final']);
  if (finalRows.length !== 2) throw new Error(`Exportacao final inesperada: ${finalRows.length}`);

  console.log(JSON.stringify({
    ok: true,
    pdmImport: {
      sheetName: pdmImport.sheetName,
      read: pdmImport.read,
      imported: pdmImport.imported,
      totalAttributes: pdmImport.totalAttributes,
      withTechnicalData: pdmImport.withTechnicalData,
      withoutTechnicalData: pdmImport.withoutTechnicalData
    },
    materialImport,
    bota: {
      pdm: bota.suggested_pdm_id,
      status: bota.status,
      confidence: bota.confidence,
      technicalAttributes: bota.technical_attributes,
      shortPt: bota.short_pt,
      longPt: bota.long_pt,
      shortEn: bota.short_en,
      longEn: bota.long_en
    },
    transmitter: {
      pdm: transmitter.suggested_pdm_id,
      status: transmitter.status,
      reason: transmitter.suggestion_reason,
      ignoredSecondary: transmitter.doubtful_words
    },
    reprocess,
    exportFinalRows: finalRows.length
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
