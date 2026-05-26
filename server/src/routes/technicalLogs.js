import express from 'express';
import db from '../db.js';
import { requireOperationalActor } from '../services/actors.js';

const router = express.Router();

router.get('/', async (req, res) => {
  const actor = await requireOperationalActor(req, res, ['Consultor', 'Validador']);
  if (!actor) return;
  const { level = '', action = '', q = '' } = req.query;
  const rows = await db.prepare(`
    SELECT * FROM technical_logs
    WHERE COALESCE(level, '') LIKE ?
      AND COALESCE(action, '') LIKE ?
      AND (
        COALESCE(message, '') LIKE ?
        OR COALESCE(entity, '') LIKE ?
        OR COALESCE(user_name, '') LIKE ?
      )
    ORDER BY created_at DESC
    LIMIT 300
  `).all(`%${level}%`, `%${action}%`, `%${q}%`, `%${q}%`, `%${q}%`);
  res.json(rows);
});

export default router;
