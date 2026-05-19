import express from 'express';
import db from '../db.js';
import { getSetting } from '../services/settings.js';

const router = express.Router();

router.get('/', async (_req, res) => {
  const total = (await db.prepare('SELECT COUNT(*) total FROM materials').get()).total;
  const byStatus = await db.prepare('SELECT status name, COUNT(*) value FROM materials GROUP BY status ORDER BY value DESC').all();
  const byPdm = await db.prepare(`
    SELECT COALESCE(suggested_pdm_name, 'Sem PDM') name, COUNT(*) value
    FROM materials GROUP BY suggested_pdm_name ORDER BY value DESC LIMIT 8
  `).all();
  const totalClassified = (await db.prepare("SELECT COUNT(*) total FROM materials WHERE status <> 'PENDENTE'").get()).total;
  const totalOk = (await db.prepare("SELECT COUNT(*) total FROM materials WHERE status IN ('OK','APROVADO','CONCLUIDO')").get()).total;
  const totalValidar = (await db.prepare("SELECT COUNT(*) total FROM materials WHERE status = 'VALIDAR'").get()).total;
  const totalRevisar = (await db.prepare("SELECT COUNT(*) total FROM materials WHERE status = 'REVISAR'").get()).total;
  const totalPendente = (await db.prepare("SELECT COUNT(*) total FROM materials WHERE status = 'PENDENTE'").get()).total;
  const latest = await db.prepare('SELECT * FROM history ORDER BY created_at DESC LIMIT 8').all();

  res.json({
    cards: {
      total,
      totalClassified,
      totalOk,
      totalValidar,
      totalRevisar,
      totalPendente,
      percentComplete: total ? Math.round((totalOk / total) * 100) : 0
    },
    byStatus,
    byPdm,
    latest,
    latestImport: {
      file_name: await getSetting('latest_material_file', ''),
      batch_id: await getSetting('latest_material_batch', ''),
      imported_at: await getSetting('latest_material_imported_at', '')
    }
  });
});

export default router;
