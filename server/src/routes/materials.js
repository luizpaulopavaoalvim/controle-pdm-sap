import express from 'express';
import db from '../db.js';
import { suggestForMaterial } from '../services/classifier.js';
import { generateFinalTexts } from '../services/text.js';
import { describeColumns, isEmptyRow, mapRowFlexible, readWorkbookRows } from '../services/importExport.js';
import { addHistory, recordChanges } from '../services/history.js';
import { setSettings } from '../services/settings.js';
import { actorPayload, requireOperationalActor } from '../services/actors.js';

const router = express.Router();

const materialMapping = {
  codigo: ['Codigo', 'CODIGO', 'Codigo', 'Codigo do material', 'CODIGO MATERIAL'],
  descricao: ['Texto breve', 'Texto Breve', 'TEXTO BREVE', 'DESCRICAO DO MATERIAL', 'DESCRICAO'],
  texto_longo_original: ['Texto Longo', 'Texto longo', 'TEXTO LONGO', 'DESCRICAO LONGA'],
  centro: ['CENTRO', 'Centro'],
  deposito: ['DEPOSITO', 'Deposito'],
  tipo_material: ['TIPO DE MATERIAL', 'Tipo de Material'],
  fabricante: ['FABRICANTE', 'Fabricante'],
  part_number: ['PART NUMBER', 'Part Number', 'PN', 'P/N'],
  modelo: ['MODELO', 'Modelo'],
  dimensao: ['DIMENSAO', 'Dimensao'],
  material: ['MATERIAL', 'Material'],
  aplicacao: ['APLICACAO', 'Aplicacao'],
  observacao: ['OBSERVACAO', 'Observacao']
};

function normalizeMaterial(row = {}) {
  const descricao = String(row.descricao || '').trim();
  const textoLongo = String(row.texto_longo_original || '').trim();
  return {
    codigo: String(row.codigo || '').trim(),
    descricao: descricao || textoLongo || 'INFORMACAO AUSENTE',
    texto_longo_original: textoLongo || descricao || '',
    centro: row.centro || '',
    deposito: row.deposito || '',
    tipo_material: row.tipo_material || '',
    fabricante: row.fabricante || '',
    part_number: row.part_number || '',
    modelo: row.modelo || '',
    dimensao: row.dimensao || '',
    material: row.material || '',
    aplicacao: row.aplicacao || '',
    observacao: row.observacao || '',
    status: row.status || '',
    source_file: row.source_file || '',
    import_batch: row.import_batch || '',
    row_number: row.row_number || null,
    import_order: row.import_order || null,
    import_error: row.import_error || '',
    modified_by_user_id: row.modified_by_user_id || null,
    modified_by_name: row.modified_by_name || '',
    modified_by_role: row.modified_by_role || ''
  };
}

async function insertOrUpdateMaterial(rawMaterial, user = 'sistema') {
  const material = normalizeMaterial(rawMaterial);
  const suggestion = await suggestForMaterial(material);
  let status = material.status || suggestion.status;
  if (material.import_error && status === 'OK') status = 'VALIDAR';
  const responsible = typeof user === 'object' ? user.username : user;
  const payload = {
    ...material,
    ...suggestion,
    status,
    responsible,
    final_result: ['OK', 'APROVADO', 'CONCLUIDO'].includes(status) ? 1 : 0
  };

  await db.prepare(`
    INSERT INTO materials (
      codigo, descricao, texto_longo_original, centro, deposito, tipo_material, fabricante, part_number,
      modelo, dimensao, material, aplicacao, observacao, suggested_pdm_id,
      suggested_pdm_name, confidence, suggestion_reason, status, responsible,
      short_pt, long_pt, short_en, long_en, final_result,
      source_file, import_batch, row_number, import_order, import_error,
      modified_by_user_id, modified_by_name, modified_by_role
    ) VALUES (
      @codigo, @descricao, @texto_longo_original, @centro, @deposito, @tipo_material, @fabricante, @part_number,
      @modelo, @dimensao, @material, @aplicacao, @observacao, @suggested_pdm_id,
      @suggested_pdm_name, @confidence, @suggestion_reason, @status, @responsible,
      @short_pt, @long_pt, @short_en, @long_en, @final_result,
      @source_file, @import_batch, @row_number, @import_order, @import_error,
      @modified_by_user_id, @modified_by_name, @modified_by_role
    )
    ON CONFLICT(codigo) DO UPDATE SET
      descricao=excluded.descricao,
      texto_longo_original=excluded.texto_longo_original,
      centro=excluded.centro,
      deposito=excluded.deposito,
      tipo_material=excluded.tipo_material,
      fabricante=excluded.fabricante,
      part_number=excluded.part_number,
      modelo=excluded.modelo,
      dimensao=excluded.dimensao,
      material=excluded.material,
      aplicacao=excluded.aplicacao,
      observacao=excluded.observacao,
      suggested_pdm_id=excluded.suggested_pdm_id,
      suggested_pdm_name=excluded.suggested_pdm_name,
      confidence=excluded.confidence,
      suggestion_reason=excluded.suggestion_reason,
      status=excluded.status,
      responsible=excluded.responsible,
      short_pt=excluded.short_pt,
      long_pt=excluded.long_pt,
      short_en=excluded.short_en,
      long_en=excluded.long_en,
      final_result=excluded.final_result,
      source_file=excluded.source_file,
      import_batch=excluded.import_batch,
      row_number=excluded.row_number,
      import_order=excluded.import_order,
      import_error=excluded.import_error,
      modified_by_user_id=excluded.modified_by_user_id,
      modified_by_name=excluded.modified_by_name,
      modified_by_role=excluded.modified_by_role,
      modified_at=CURRENT_TIMESTAMP,
      updated_at=CURRENT_TIMESTAMP
  `).run(payload);
  await addHistory({ codigo: material.codigo, field: 'importacao', oldValue: '', newValue: 'Material importado/processado', user, action: 'Material importado', entity: 'Material' });
  return payload;
}

router.get('/', async (req, res) => {
  const { status = '', pdm = '', responsible = '', centro = '', tipo = '', q = '', minConfidence = 0 } = req.query;
  const rows = await db.prepare(`
    SELECT * FROM materials
    WHERE status LIKE ?
      AND suggested_pdm_name LIKE ?
      AND COALESCE(responsible,'') LIKE ?
      AND COALESCE(centro,'') LIKE ?
      AND COALESCE(tipo_material,'') LIKE ?
      AND confidence >= ?
      AND (
        codigo LIKE ?
        OR descricao LIKE ?
        OR COALESCE(texto_longo_original,'') LIKE ?
        OR COALESCE(part_number,'') LIKE ?
      )
    ORDER BY COALESCE(import_order, id), row_number, id
  `).all(`%${status}%`, `%${pdm}%`, `%${responsible}%`, `%${centro}%`, `%${tipo}%`, Number(minConfidence), `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
  res.json(rows);
});

router.post('/', async (req, res) => {
  const actor = await requireOperationalActor(req, res, ['Consultor']);
  if (!actor) return;
  const payload = await insertOrUpdateMaterial({ ...req.body, ...actorPayload(actor) }, actor);
  res.status(201).json(payload);
});

router.put('/:id', async (req, res) => {
  const oldRow = await db.prepare('SELECT * FROM materials WHERE id = ?').get(req.params.id);
  if (!oldRow) return res.status(404).json({ message: 'Material nao encontrado' });
  const actor = await requireOperationalActor(req, res, ['Consultor', 'Validador']);
  if (!actor) return;
  const allowed = [
    'codigo', 'descricao', 'texto_longo_original', 'centro', 'deposito', 'tipo_material', 'fabricante', 'part_number',
    'modelo', 'dimensao', 'material', 'aplicacao', 'observacao', 'suggested_pdm_id', 'suggested_pdm_name',
    'confidence', 'suggestion_reason', 'status', 'responsible', 'short_pt', 'long_pt', 'short_en', 'long_en', 'final_result',
    'source_file', 'import_batch', 'row_number', 'import_order', 'import_error',
    'modified_by_user_id', 'modified_by_name', 'modified_by_role'
  ];
  const next = { ...oldRow, ...req.body, ...actorPayload(actor), updated_at: undefined };
  const setClause = allowed.map((field) => `${field}=@${field}`).join(', ');
  await db.prepare(`UPDATE materials SET ${setClause}, modified_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE id=@id`).run({ ...next, id: req.params.id });
  await recordChanges(oldRow.codigo, oldRow, req.body, actor, req.body.note || 'Edicao manual');
  res.json(await db.prepare('SELECT * FROM materials WHERE id = ?').get(req.params.id));
});

router.post('/:id/status', async (req, res) => {
  const row = await db.prepare('SELECT * FROM materials WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ message: 'Material nao encontrado' });
  const actor = await requireOperationalActor(req, res, ['Consultor', 'Validador']);
  if (!actor) return;
  const status = req.body.status;
  await db.prepare('UPDATE materials SET status = ?, responsible = ?, modified_by_user_id = ?, modified_by_name = ?, modified_by_role = ?, modified_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE id = ?')
    .run(status, actor.username, actor.id, actor.name, actor.role, req.params.id);
  await addHistory({ codigo: row.codigo, field: 'status', oldValue: row.status, newValue: status, user: actor, action: 'Status alterado', entity: 'Material', note: req.body.note || '' });
  res.json({ message: 'Status atualizado' });
});

router.post('/:id/generate', async (req, res) => {
  const row = await db.prepare('SELECT * FROM materials WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ message: 'Material nao encontrado' });
  const actor = await requireOperationalActor(req, res, ['Consultor']);
  if (!actor) return;
  const pdm = await db.prepare('SELECT * FROM pdms WHERE id_pdm = ?').get(req.body.id_pdm || row.suggested_pdm_id);
  const texts = generateFinalTexts(row, pdm);
  const status = texts.hasMissingInfo ? 'VALIDAR' : (row.status === 'APROVADO' ? 'CONCLUIDO' : row.status);
  await db.prepare(`
    UPDATE materials SET short_pt=@short_pt, long_pt=@long_pt, short_en=@short_en, long_en=@long_en,
      final_result=1, status=@status, responsible=@user, modified_by_user_id=@modified_by_user_id,
      modified_by_name=@modified_by_name, modified_by_role=@modified_by_role,
      modified_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP
    WHERE id=@id
  `).run({ ...texts, status, user: actor.username, ...actorPayload(actor), id: req.params.id });
  await addHistory({ codigo: row.codigo, field: 'resultado_final', oldValue: '', newValue: 'Gerado', user: actor, action: 'Resultado final gerado', entity: 'Material' });
  res.json({ ...texts, status });
});

router.post('/import', async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Arquivo nao enviado' });
  const actor = await requireOperationalActor(req, res, ['Consultor']);
  if (!actor) return;
  const rows = readWorkbookRows(req.file.path);
  const columns = describeColumns(rows);
  console.log('[import-materials] colunas originais:', columns.original);
  console.log('[import-materials] colunas normalizadas:', columns.normalized);
  console.log('[import-materials] total de linhas lidas:', rows.length);

  let imported = 0;
  let ignored = 0;
  const ignoredReasons = {};
  const errors = [];
  const user = actor;
  const fileName = req.file.originalname || 'materiais.xlsx';
  const batchId = `${Date.now()}`;

  await db.prepare('DELETE FROM history').run();
  await db.prepare('DELETE FROM materials').run();

  for (const [index, rawRow] of rows.entries()) {
    const rowNumber = index + 2;
    if (isEmptyRow(rawRow)) {
      ignored += 1;
      ignoredReasons['Linha totalmente vazia'] = (ignoredReasons['Linha totalmente vazia'] || 0) + 1;
      continue;
    }

    const mapped = mapRowFlexible(rawRow, materialMapping);
    const hasAnyText = Boolean(String(mapped.descricao || mapped.texto_longo_original || '').trim());
    const row = normalizeMaterial({
      ...mapped,
      source_file: fileName,
      import_batch: batchId,
      row_number: rowNumber,
      import_order: index + 1,
      ...actorPayload(actor)
    });

    if (!row.codigo) {
      ignored += 1;
      const reason = 'Codigo ausente';
      ignoredReasons[reason] = (ignoredReasons[reason] || 0) + 1;
      errors.push({ row: rowNumber, reason });
      continue;
    }
    if (!hasAnyText) row.import_error = 'Texto breve e Texto Longo ausentes';

    await insertOrUpdateMaterial(row, user);
    imported += 1;
  }

  await setSettings({
    latest_material_file: fileName,
    latest_material_batch: batchId,
    latest_material_imported_at: new Date().toISOString(),
    latest_material_total_rows: rows.length,
    latest_material_imported_rows: imported,
    latest_material_ignored_rows: ignored
  });

  const summary = { read: rows.length, imported, ignored, ignoredReasons, errors, columns, fileName, batchId };
  console.log('[import-materials] resumo:', summary);
  res.json(summary);
});

export default router;
