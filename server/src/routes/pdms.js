import express from 'express';
import db from '../db.js';
import { isEmptyRow, mapRowFlexible, readWorkbookRowsByDetectedHeader } from '../services/importExport.js';
import { getSetting, setSettings } from '../services/settings.js';
import { actorPayload, requireOperationalActor } from '../services/actors.js';
import { addHistory } from '../services/history.js';

const router = express.Router();

const pdmFields = `
  id_padrao, nome_valido, id_pdm, nome_pdm, descricao_pdm, tipo_material, palavra_chave,
  atributos_dt,
  estrutura_texto_breve_pt, estrutura_texto_longo_pt,
  estrutura_texto_breve_en, estrutura_texto_longo_en, observacao,
  modified_by_user_id, modified_by_name, modified_by_role
`;

function normalizePdm(body = {}, attributes = []) {
  const id = String(body.id_padrao || body.id_pdm || '').trim();
  const name = String(body.nome_valido || body.nome_pdm || '').trim();
  return {
    id_padrao: id,
    nome_valido: name,
    id_pdm: id,
    nome_pdm: name,
    atributos_dt: JSON.stringify(attributes),
    descricao_pdm: body.descricao_pdm || '',
    tipo_material: body.tipo_material || '',
    palavra_chave: body.palavra_chave || name,
    estrutura_texto_breve_pt: body.estrutura_texto_breve_pt || '{NOME_PDM}',
    estrutura_texto_longo_pt: body.estrutura_texto_longo_pt || '{NOME_PDM}; {TEXTO_LONGO}',
    estrutura_texto_breve_en: body.estrutura_texto_breve_en || '',
    estrutura_texto_longo_en: body.estrutura_texto_longo_en || '',
    observacao: body.observacao || '',
    modified_by_user_id: body.modified_by_user_id || null,
    modified_by_name: body.modified_by_name || '',
    modified_by_role: body.modified_by_role || ''
  };
}

function parseAttrs(row) {
  if (Array.isArray(row.atributos_dt)) return row.atributos_dt;
  try {
    return JSON.parse(row.atributos_dt || '[]');
  } catch {
    return [];
  }
}

async function upsertPdm(row) {
  await db.prepare(`
    INSERT INTO pdms (${pdmFields})
    VALUES (@id_padrao, @nome_valido, @id_pdm, @nome_pdm, @descricao_pdm, @tipo_material, @palavra_chave, @atributos_dt,
      @estrutura_texto_breve_pt, @estrutura_texto_longo_pt,
      @estrutura_texto_breve_en, @estrutura_texto_longo_en, @observacao,
      @modified_by_user_id, @modified_by_name, @modified_by_role)
    ON CONFLICT(id_pdm) DO UPDATE SET
      id_padrao=excluded.id_padrao,
      nome_valido=excluded.nome_valido,
      atributos_dt=excluded.atributos_dt,
      nome_pdm=excluded.nome_pdm,
      descricao_pdm=excluded.descricao_pdm,
      tipo_material=excluded.tipo_material,
      palavra_chave=excluded.palavra_chave,
      estrutura_texto_breve_pt=excluded.estrutura_texto_breve_pt,
      estrutura_texto_longo_pt=excluded.estrutura_texto_longo_pt,
      estrutura_texto_breve_en=excluded.estrutura_texto_breve_en,
      estrutura_texto_longo_en=excluded.estrutura_texto_longo_en,
      observacao=excluded.observacao,
      modified_by_user_id=excluded.modified_by_user_id,
      modified_by_name=excluded.modified_by_name,
      modified_by_role=excluded.modified_by_role,
      modified_at=CURRENT_TIMESTAMP,
      updated_at=CURRENT_TIMESTAMP
  `).run(row);

  const attrs = parseAttrs(row);
  await db.prepare('DELETE FROM pdm_attributes WHERE pdm_id = ?').run(row.id_pdm);
  const insertAttr = db.prepare(`
    INSERT INTO pdm_attributes (pdm_id, dt_column, attribute_order, attribute_name)
    VALUES (?, ?, ?, ?)
  `);
  for (const attr of attrs) {
    await insertAttr.run(row.id_pdm, attr.dt_column, attr.attribute_order, attr.attribute_name);
  }
}

async function bulkUpsertPdms(rows) {
  if (!rows.length) return;
  if (db.client !== 'postgres') {
    for (const row of rows) await upsertPdm(row);
    return;
  }

  const fields = [
    'id_padrao', 'nome_valido', 'id_pdm', 'nome_pdm', 'descricao_pdm', 'tipo_material', 'palavra_chave',
    'atributos_dt', 'estrutura_texto_breve_pt', 'estrutura_texto_longo_pt', 'estrutura_texto_breve_en',
    'estrutura_texto_longo_en', 'observacao', 'modified_by_user_id', 'modified_by_name', 'modified_by_role'
  ];
  const chunkSize = 500;
  for (let start = 0; start < rows.length; start += chunkSize) {
    const chunk = rows.slice(start, start + chunkSize);
    const values = [];
    const placeholders = chunk.map((row, rowIndex) => {
      const rowPlaceholders = fields.map((field, fieldIndex) => {
        values.push(row[field]);
        return `$${rowIndex * fields.length + fieldIndex + 1}`;
      });
      return `(${rowPlaceholders.join(', ')})`;
    });

    await db.query(`
      INSERT INTO pdms (${fields.join(', ')})
      VALUES ${placeholders.join(', ')}
      ON CONFLICT(id_pdm) DO UPDATE SET
        id_padrao=excluded.id_padrao,
        nome_valido=excluded.nome_valido,
        atributos_dt=excluded.atributos_dt,
        nome_pdm=excluded.nome_pdm,
        descricao_pdm=excluded.descricao_pdm,
        tipo_material=excluded.tipo_material,
        palavra_chave=excluded.palavra_chave,
        estrutura_texto_breve_pt=excluded.estrutura_texto_breve_pt,
        estrutura_texto_longo_pt=excluded.estrutura_texto_longo_pt,
        estrutura_texto_breve_en=excluded.estrutura_texto_breve_en,
        estrutura_texto_longo_en=excluded.estrutura_texto_longo_en,
        observacao=excluded.observacao,
        modified_by_user_id=excluded.modified_by_user_id,
        modified_by_name=excluded.modified_by_name,
        modified_by_role=excluded.modified_by_role,
        modified_at=CURRENT_TIMESTAMP,
        updated_at=CURRENT_TIMESTAMP
    `, values);
  }
}

async function ensureFallbackPdm() {
  const exists = await db.prepare("SELECT id FROM pdms WHERE id_pdm = '1'").get();
  if (exists) return;
  await upsertPdm(normalizePdm({ id_padrao: '1', nome_valido: '(NAO-PADRONIZADO)', observacao: 'Fallback automatico.' }, []));
}

async function pdmStatus() {
  const count = (await db.prepare('SELECT COUNT(*) total FROM pdms').get()).total;
  const attributeCount = (await db.prepare('SELECT COUNT(*) total FROM pdm_attributes').get()).total;
  return {
    imported: Number(count) > 0,
    count: Number(count),
    attributeCount: Number(attributeCount),
    lastImportedAt: await getSetting('latest_pdm_imported_at', ''),
    latestPdmFile: await getSetting('latest_pdm_file', '')
  };
}

router.get('/', async (req, res) => {
  const { q = '' } = req.query;
  const rows = await db.prepare(`
    SELECT * FROM pdms
    WHERE id_pdm LIKE ?
      OR nome_pdm LIKE ?
      OR COALESCE(id_padrao, '') LIKE ?
      OR COALESCE(nome_valido, '') LIKE ?
      OR COALESCE(palavra_chave, '') LIKE ?
    ORDER BY CASE WHEN id_pdm = '1' THEN 0 ELSE 1 END, nome_pdm
  `).all(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
  res.json(rows.map((row) => {
    const attrs = parseAttrs(row);
    return { ...row, attribute_count: attrs.length, attributes: attrs };
  }));
});

router.get('/status', async (_req, res) => {
  res.json(await pdmStatus());
});

router.post('/', async (req, res) => {
  const actor = await requireOperationalActor(req, res, ['Consultor']);
  if (!actor) return;
  const body = normalizePdm({ ...req.body, ...actorPayload(actor) });
  if (!body.id_pdm || !body.nome_pdm) {
    return res.status(400).json({ message: 'Informe Id Padrao e Nome Valido' });
  }
  await upsertPdm(body);
  await addHistory({ user: actor, action: 'PDM cadastrado', entity: 'PDM', field: 'pdm', newValue: body.nome_pdm, note: body.id_pdm });
  res.status(201).json({ message: 'PDM salvo com sucesso' });
});

router.put('/:id', async (req, res) => {
  const actor = await requireOperationalActor(req, res, ['Consultor']);
  if (!actor) return;
  const body = normalizePdm({ ...req.body, ...actorPayload(actor) });
  await db.prepare(`
    UPDATE pdms SET
      id_padrao=@id_padrao,
      nome_valido=@nome_valido,
      atributos_dt=@atributos_dt,
      id_pdm=@id_pdm,
      nome_pdm=@nome_pdm,
      descricao_pdm=@descricao_pdm,
      tipo_material=@tipo_material,
      palavra_chave=@palavra_chave,
      estrutura_texto_breve_pt=@estrutura_texto_breve_pt,
      estrutura_texto_longo_pt=@estrutura_texto_longo_pt,
      estrutura_texto_breve_en=@estrutura_texto_breve_en,
      estrutura_texto_longo_en=@estrutura_texto_longo_en,
      observacao=@observacao,
      modified_by_user_id=@modified_by_user_id,
      modified_by_name=@modified_by_name,
      modified_by_role=@modified_by_role,
      modified_at=CURRENT_TIMESTAMP,
      updated_at=CURRENT_TIMESTAMP
    WHERE id=@id
  `).run({ ...body, id: req.params.id });
  await addHistory({ user: actor, action: 'PDM editado', entity: 'PDM', field: 'pdm', newValue: body.nome_pdm, note: body.id_pdm });
  res.json({ message: 'PDM atualizado' });
});

router.post('/import', async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Arquivo nao enviado' });
  const actor = await requireOperationalActor(req, res, ['Consultor']);
  if (!actor) return;
  const mode = String(req.body.mode || 'replace').toLowerCase();
  const existingCount = Number((await db.prepare('SELECT COUNT(*) total FROM pdms').get()).total);
  if (existingCount > 1 && mode === 'keep') {
    return res.json({
      read: 0,
      imported: 0,
      ignored: 0,
      totalAttributes: Number((await db.prepare('SELECT COUNT(*) total FROM pdm_attributes').get()).total),
      message: 'Base PDM existente mantida.',
      status: await pdmStatus(),
      preview: []
    });
  }
  if (mode === 'replace') {
    await db.prepare('DELETE FROM pdm_attributes').run();
    await db.prepare('DELETE FROM pdms').run();
  }

  const mapping = {
    id_padrao: ['Id Padrao', 'ID PADRAO', 'id_padrao', 'ID_PADRAO', 'ID_PDM', 'ID PDM'],
    nome_valido: ['Nome Valido', 'NOME VALIDO', 'nome_valido', 'NOME_VALIDO', 'Nome_PDM', 'NOME_PDM', 'Nome PDM']
  };

  const detected = readWorkbookRowsByDetectedHeader(req.file.path, mapping);
  const rows = detected.rows;
  const columns = detected.columns;
  console.log('[import-pdms] colunas originais:', columns.original);
  console.log('[import-pdms] colunas normalizadas:', columns.normalized);
  console.log('[import-pdms] total de linhas lidas:', rows.length);
  console.log('[import-pdms] aba usada:', detected.sheetName);
  console.log('[import-pdms] linha do cabecalho:', detected.headerRowNumber);

  if (detected.error) {
    return res.status(400).json({
      message: 'Cabecalho obrigatorio nao encontrado. Use Id Padrao e Nome Valido na primeira aba da planilha.',
      read: 0,
      imported: 0,
      ignored: 0,
      totalAttributes: 0,
      ignoredReasons: { [detected.error]: 1 },
      errors: [detected.error],
      columns,
      preview: [],
      status: await pdmStatus()
    });
  }

  let imported = 0;
  let ignored = 0;
  let totalAttributes = 0;
  const errors = [];
  const ignoredReasons = {};
  const pdmsToSave = [];

  for (const [index, rawRow] of rows.entries()) {
    if (isEmptyRow(rawRow)) {
      ignored += 1;
      ignoredReasons['Linha totalmente vazia'] = (ignoredReasons['Linha totalmente vazia'] || 0) + 1;
      continue;
    }

    const mapped = mapRowFlexible(rawRow, mapping);
    const attributes = [];

    const row = normalizePdm({ ...mapped, ...actorPayload(actor) }, attributes);
    if (!row.id_pdm || !row.nome_pdm) {
      ignored += 1;
      const reason = 'Id Padrao ou Nome Valido ausente';
      ignoredReasons[reason] = (ignoredReasons[reason] || 0) + 1;
      errors.push(`Linha ${index + 2}: ${reason}`);
      continue;
    }

    pdmsToSave.push(row);
    totalAttributes += attributes.length;
    imported += 1;
  }

  try {
    await bulkUpsertPdms(pdmsToSave);
    if (mode === 'replace') await db.prepare('DELETE FROM pdm_attributes').run();
  } catch (error) {
    return res.status(500).json({
      message: `Erro ao salvar base PDM: ${error.message}`,
      read: rows.length,
      imported: 0,
      ignored: rows.length,
      totalAttributes: 0,
      ignoredReasons: { [error.message]: rows.length },
      errors: [error.message],
      columns,
      preview: [],
      status: await pdmStatus()
    });
  }

  await ensureFallbackPdm();
  const savedCount = Number((await db.prepare('SELECT COUNT(*) total FROM pdms').get()).total);
  const savedAttributeCount = Number((await db.prepare('SELECT COUNT(*) total FROM pdm_attributes').get()).total);
  await setSettings({
    latest_pdm_imported_at: new Date().toISOString(),
    latest_pdm_count: savedCount,
    latest_pdm_attribute_count: savedAttributeCount,
    latest_pdm_file: req.file.originalname || ''
  });
  await addHistory({
    user: actor,
    action: 'PDM importado',
    entity: 'PDM',
    field: 'base_pdm',
    newValue: `${imported} PDMs importados`,
    note: `Arquivo ${req.file.originalname || ''}; aba ${detected.sheetName}; cabecalho linha ${detected.headerRowNumber}`
  });

  const previewRows = await db.prepare('SELECT * FROM pdms ORDER BY updated_at DESC LIMIT 10').all();
  const preview = previewRows.map((row) => {
    const attrs = parseAttrs(row);
    return { id_padrao: row.id_padrao, nome_valido: row.nome_valido, attribute_count: attrs.length, attributes: attrs };
  });
  const summary = {
    read: rows.length,
    imported,
    ignored,
    totalAttributes,
    ignoredReasons,
    errors,
    columns,
    sheetName: detected.sheetName,
    headerRowNumber: detected.headerRowNumber,
    preview,
    status: await pdmStatus()
  };
  console.log('[import-pdms] resumo:', summary);
  res.json(summary);
});

export default router;
