import db, { initDb } from '../server/src/db.js';
import { seedDemoData } from '../server/src/seed.js';

await initDb();

await db.prepare('DELETE FROM history').run();
await db.prepare('DELETE FROM materials').run();
await db.prepare('DELETE FROM pdm_attributes').run();
await db.prepare('DELETE FROM pdms').run();
await db.prepare('DELETE FROM app_settings').run();
await db.prepare('DELETE FROM users WHERE username <> ?').run('admin');

await seedDemoData();

const users = await db.prepare('SELECT username, role FROM users ORDER BY username').all();
const pdms = await db.prepare('SELECT id_pdm, nome_pdm FROM pdms ORDER BY id_pdm').all();

console.log(JSON.stringify({
  ok: true,
  message: 'Dados antigos limpos. Estrutura preservada.',
  users,
  pdms
}, null, 2));
