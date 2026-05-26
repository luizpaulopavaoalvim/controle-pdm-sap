import express from 'express';
import db from '../db.js';
import { getSetting } from '../services/settings.js';
import { requireActor } from '../services/actors.js';
import { addHistory } from '../services/history.js';

const router = express.Router();

router.get('/', async (req, res) => {
  const actor = req.query.user || req.headers['x-user'] ? await requireActor(req, res) : null;
  if (req.query.user || req.headers['x-user']) {
    if (!actor) return;
    await addHistory({ user: actor, action: 'Dashboard acessado', entity: 'Dashboard', field: 'visualizacao', req, screen: 'Dashboard' });
  }
  const total = Number((await db.prepare('SELECT COUNT(*) total FROM materials').get()).total);
  const byStatusRows = await db.prepare('SELECT status name, COUNT(*) value FROM materials GROUP BY status ORDER BY value DESC').all();
  const byPdmRows = await db.prepare(`
    SELECT COALESCE(suggested_pdm_name, 'Sem PDM') name, COUNT(*) value
    FROM materials GROUP BY suggested_pdm_name ORDER BY value DESC LIMIT 8
  `).all();
  const byStatus = byStatusRows.map((row) => ({ ...row, value: Number(row.value) }));
  const byPdm = byPdmRows.map((row) => ({ ...row, value: Number(row.value) }));
  const totalClassified = Number((await db.prepare("SELECT COUNT(*) total FROM materials WHERE status <> 'PENDENTE'").get()).total);
  const totalOk = Number((await db.prepare("SELECT COUNT(*) total FROM materials WHERE status IN ('OK','APROVADO','CONCLUIDO')").get()).total);
  const totalValidar = Number((await db.prepare("SELECT COUNT(*) total FROM materials WHERE status = 'VALIDAR'").get()).total);
  const totalRevisar = Number((await db.prepare("SELECT COUNT(*) total FROM materials WHERE status = 'REVISAR'").get()).total);
  const totalPendente = Number((await db.prepare("SELECT COUNT(*) total FROM materials WHERE status = 'PENDENTE'").get()).total);
  const totalConcluido = Number((await db.prepare("SELECT COUNT(*) total FROM materials WHERE status IN ('CONCLUIDO','APROVADO')").get()).total);
  const byUserRows = await db.prepare(`
    SELECT COALESCE(modified_by_name, responsible, 'Sem usuario') name, COUNT(*) value
    FROM materials
    GROUP BY COALESCE(modified_by_name, responsible, 'Sem usuario')
    ORDER BY value DESC
    LIMIT 8
  `).all();
  const dailyRows = await db.prepare(`
    SELECT SUBSTR(CAST(created_at AS TEXT), 1, 10) name, COUNT(*) value
    FROM materials
    GROUP BY SUBSTR(CAST(created_at AS TEXT), 1, 10)
    ORDER BY name
    LIMIT 14
  `).all();
  const latest = await db.prepare('SELECT * FROM history ORDER BY created_at DESC LIMIT 8').all();

  res.json({
    cards: {
      total,
      totalClassified,
      totalOk,
      totalValidar,
      totalRevisar,
      totalPendente,
      totalConcluido,
      percentComplete: total ? Math.round((totalOk / total) * 100) : 0,
      percentPending: total ? Math.round((totalPendente / total) * 100) : 0,
      averageProcessingMs: Number(await getSetting('latest_material_processing_ms', 0)) || 0,
      importedRows: Number(await getSetting('latest_material_imported_rows', 0)) || 0
    },
    byStatus,
    byPdm,
    byUser: byUserRows.map((row) => ({ ...row, value: Number(row.value) })),
    dailyEvolution: dailyRows.map((row) => ({ ...row, value: Number(row.value) })),
    latest,
    latestImport: {
      file_name: await getSetting('latest_material_file', ''),
      batch_id: await getSetting('latest_material_batch', ''),
      imported_at: await getSetting('latest_material_imported_at', '')
    }
  });
});

export default router;
