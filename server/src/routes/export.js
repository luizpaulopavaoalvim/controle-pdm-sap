import express from 'express';
import db from '../db.js';
import { workbookBuffer } from '../services/importExport.js';
import { requireOperationalActor } from '../services/actors.js';
import { addHistory } from '../services/history.js';

const router = express.Router();

function sendWorkbook(res, rows, sheetName, filename) {
  const buffer = workbookBuffer(rows, sheetName);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buffer);
}

router.get('/final', async (req, res, next) => {
  try {
    const actor = await requireOperationalActor(req, res, ['Consultor']);
    if (!actor) return;
    const rows = await db.prepare(`
      SELECT codigo AS "CODIGO", short_pt AS "TEXTO BREVE PT", long_pt AS "TEXTO LONGO PT",
        short_en AS "TEXTO BREVE EN", long_en AS "TEXTO LONGO EN"
      FROM materials
      WHERE final_result = 1 OR status IN ('OK','APROVADO','CONCLUIDO')
      ORDER BY COALESCE(import_order, id), row_number, id
    `).all();
    await addHistory({ user: actor, action: 'Material exportado', entity: 'Exportacao', field: 'exportacao', newValue: 'Resultado final', note: `${rows.length} linha(s)`, req, screen: 'Exportacao' });
    sendWorkbook(res, rows, 'Resultado Final', 'resultado-final-pdm-sap.xlsx');
  } catch (error) {
    next(error);
  }
});

router.get('/complete', async (req, res, next) => {
  try {
    const actor = await requireOperationalActor(req, res, ['Consultor']);
    if (!actor) return;
    const rows = await db.prepare(`
      SELECT codigo AS "CODIGO", descricao AS "DESCRICAO ORIGINAL", texto_longo_original AS "TEXTO LONGO ORIGINAL",
        suggested_pdm_name AS "PDM SUGERIDO", suggested_pdm_id AS "ID PDM",
        status AS "STATUS", confidence AS "CONFIANCA", suggestion_reason AS "MOTIVO",
        matched_words AS "PALAVRAS ENCONTRADAS", doubtful_words AS "PALAVRAS EM DUVIDA",
        alternative_1 AS "ALTERNATIVA 1", alternative_2 AS "ALTERNATIVA 2", alternative_3 AS "ALTERNATIVA 3",
        responsible AS "RESPONSAVEL", observacao AS "OBSERVACAO", updated_at AS "DATA DE ATUALIZACAO",
        short_pt AS "TEXTO BREVE PT", long_pt AS "TEXTO LONGO PT",
        short_en AS "TEXTO BREVE EN", long_en AS "TEXTO LONGO EN",
        CASE WHEN final_result = 1 THEN 'SIM' ELSE 'NAO' END AS "RESULTADO FINAL"
      FROM materials
      ORDER BY COALESCE(import_order, id), row_number, id
    `).all();
    await addHistory({ user: actor, action: 'Material exportado', entity: 'Exportacao', field: 'exportacao', newValue: 'Base completa', note: `${rows.length} linha(s)`, req, screen: 'Exportacao' });
    sendWorkbook(res, rows, 'Base Completa', 'base-completa-pdm-sap.xlsx');
  } catch (error) {
    next(error);
  }
});

router.get('/status/:status', async (req, res, next) => {
  try {
    const actor = await requireOperationalActor(req, res, ['Consultor']);
    if (!actor) return;
    const status = String(req.params.status || '').toUpperCase();
    if (!['OK', 'VALIDAR', 'REVISAR'].includes(status)) return res.status(400).json({ message: 'Status invalido para exportacao' });
    const rows = await db.prepare(`
      SELECT codigo AS "CODIGO", descricao AS "DESCRICAO ORIGINAL", texto_longo_original AS "TEXTO LONGO ORIGINAL",
        suggested_pdm_name AS "PDM SUGERIDO", suggested_pdm_id AS "ID PDM",
        status AS "STATUS", confidence AS "CONFIANCA", suggestion_reason AS "MOTIVO",
        matched_words AS "PALAVRAS ENCONTRADAS", doubtful_words AS "PALAVRAS EM DUVIDA",
        alternative_1 AS "ALTERNATIVA 1", alternative_2 AS "ALTERNATIVA 2", alternative_3 AS "ALTERNATIVA 3",
        short_pt AS "TEXTO BREVE PT", long_pt AS "TEXTO LONGO PT",
        short_en AS "TEXTO BREVE EN", long_en AS "TEXTO LONGO EN"
      FROM materials
      WHERE status = ?
      ORDER BY COALESCE(import_order, id), row_number, id
    `).all(status);
    await addHistory({ user: actor, action: 'Material exportado', entity: 'Exportacao', field: 'exportacao', newValue: `Somente ${status}`, note: `${rows.length} linha(s)`, req, screen: 'Exportacao' });
    sendWorkbook(res, rows, `Somente ${status}`, `materiais-${status.toLowerCase()}.xlsx`);
  } catch (error) {
    next(error);
  }
});

router.get('/history', async (req, res, next) => {
  try {
    const actor = await requireOperationalActor(req, res, ['Consultor', 'Validador']);
    if (!actor) return;
    const rows = await db.prepare(`
      SELECT codigo AS "CODIGO", action AS "ACAO", entity AS "ENTIDADE", field AS "CAMPO",
        old_value AS "VALOR ANTERIOR", new_value AS "VALOR NOVO", "user" AS "USUARIO",
        user_role AS "PERFIL", ip_address AS "IP", user_agent AS "NAVEGADOR", created_at AS "DATA"
      FROM history
      ORDER BY created_at DESC
    `).all();
    await addHistory({ user: actor, action: 'Material exportado', entity: 'Exportacao', field: 'exportacao', newValue: 'Historico', note: `${rows.length} linha(s)`, req, screen: 'Exportacao' });
    sendWorkbook(res, rows, 'Historico', 'historico-pdm-sap.xlsx');
  } catch (error) {
    next(error);
  }
});

router.get('/dashboard-summary', async (req, res, next) => {
  try {
    const actor = await requireOperationalActor(req, res, ['Consultor']);
    if (!actor) return;
    const rows = await db.prepare('SELECT status AS "STATUS", COUNT(*) AS "TOTAL" FROM materials GROUP BY status ORDER BY status').all();
    await addHistory({ user: actor, action: 'Material exportado', entity: 'Exportacao', field: 'exportacao', newValue: 'Dashboard resumo', note: `${rows.length} linha(s)`, req, screen: 'Exportacao' });
    sendWorkbook(res, rows, 'Resumo Dashboard', 'dashboard-resumo-pdm-sap.xlsx');
  } catch (error) {
    next(error);
  }
});

export default router;
