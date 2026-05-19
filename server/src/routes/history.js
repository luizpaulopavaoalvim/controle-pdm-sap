import express from 'express';
import db from '../db.js';

const router = express.Router();

router.get('/', async (req, res) => {
  const { codigo = '', user = '', action = '', entity = '' } = req.query;
  const rows = await db.prepare(`
    SELECT * FROM history
    WHERE codigo LIKE ?
      AND "user" LIKE ?
      AND COALESCE(action,'') LIKE ?
      AND COALESCE(entity,'') LIKE ?
    ORDER BY created_at DESC
    LIMIT 500
  `).all(`%${codigo}%`, `%${user}%`, `%${action}%`, `%${entity}%`);
  res.json(rows);
});

export default router;
