import express from 'express';
import db from '../db.js';
import { workbookBuffer } from '../services/importExport.js';
import { requireOperationalActor } from '../services/actors.js';
import { addHistory } from '../services/history.js';

const router = express.Router();

router.get('/final', async (req, res, next) => {
  try {
    const actor = await requireOperationalActor(req, res, ['Consultor']);
    if (!actor) return;
    const rows = await db.prepare(`
      SELECT codigo AS "CÓDIGO", short_pt AS "TEXTO BREVE PT", long_pt AS "TEXTO LONGO PT",
        short_en AS "TEXTO BREVE EN", long_en AS "TEXTO LONGO EN"
      FROM materials
      WHERE final_result = 1 OR status IN ('OK','APROVADO','CONCLUIDO')
      ORDER BY COALESCE(import_order, id), row_number, id
    `).all();
    const buffer = workbookBuffer(rows, 'Resultado Final');
    res.setHeader('Content-Disposition', 'attachment; filename="resultado-final-pdm-sap.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    await addHistory({ user: actor, action: 'Material exportado', entity: 'Exportacao', field: 'exportacao', newValue: 'Resultado final', note: `${rows.length} linha(s)` });
    res.send(buffer);
  } catch (error) {
    next(error);
  }
});

router.get('/complete', async (req, res, next) => {
  try {
    const actor = await requireOperationalActor(req, res, ['Consultor']);
    if (!actor) return;
    const rows = await db.prepare(`
      SELECT codigo AS "CÓDIGO", descricao AS "DESCRIÇÃO ORIGINAL", texto_longo_original AS "TEXTO LONGO ORIGINAL",
        suggested_pdm_name AS "PDM SUGERIDO", suggested_pdm_id AS "ID PDM",
        status AS "STATUS", confidence AS "CONFIANÇA",
        responsible AS "RESPONSÁVEL", observacao AS "OBSERVAÇÃO", updated_at AS "DATA DE ATUALIZAÇÃO",
        short_pt AS "TEXTO BREVE PT", long_pt AS "TEXTO LONGO PT",
        short_en AS "TEXTO BREVE EN", long_en AS "TEXTO LONGO EN",
        CASE WHEN final_result = 1 THEN 'SIM' ELSE 'NAO' END AS "RESULTADO FINAL"
      FROM materials
      ORDER BY COALESCE(import_order, id), row_number, id
    `).all();
    const buffer = workbookBuffer(rows, 'Base Completa');
    res.setHeader('Content-Disposition', 'attachment; filename="base-completa-pdm-sap.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    await addHistory({ user: actor, action: 'Material exportado', entity: 'Exportacao', field: 'exportacao', newValue: 'Base completa', note: `${rows.length} linha(s)` });
    res.send(buffer);
  } catch (error) {
    next(error);
  }
});

export default router;
