import express from 'express';
import db from '../db.js';
import { requireActor } from '../services/actors.js';
import { addHistory } from '../services/history.js';
import { seedDemoData } from '../seed.js';

const router = express.Router();

router.delete('/clear-operational-data', async (req, res, next) => {
  try {
    const actor = await requireActor(req, res);
    if (!actor) return;

    if (actor.role !== 'Admin') {
      res.status(403).json({ message: 'Apenas Admin pode apagar dados operacionais.' });
      return;
    }

    await db.prepare('DELETE FROM materials').run();
    await db.prepare('DELETE FROM pdm_attributes').run();
    await db.prepare('DELETE FROM pdms').run();
    await db.prepare('DELETE FROM app_settings').run();
    await db.prepare('DELETE FROM history').run();
    await seedDemoData();

    await addHistory({
      user: actor,
      action: 'Todos os dados operacionais foram apagados',
      entity: 'Administracao',
      field: 'limpeza_operacional',
      oldValue: '',
      newValue: 'Dados apagados com sucesso.',
      note: 'Usuarios e estrutura das tabelas preservados.'
    });

    res.json({ message: 'Dados apagados com sucesso.' });
  } catch (error) {
    next(error);
  }
});

export default router;
