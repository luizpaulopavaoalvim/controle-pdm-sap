import db from '../db.js';
import { getActor } from './actors.js';

async function actorFromInput(user) {
  if (user && typeof user === 'object') return user;
  return await getActor(user) || { id: null, name: String(user || 'Sistema'), username: String(user || 'sistema'), role: 'Sistema' };
}

export async function addHistory({
  codigo = '',
  field = '',
  oldValue = '',
  newValue = '',
  user = 'sistema',
  action = '',
  entity = '',
  note = ''
}) {
  const actor = await actorFromInput(user);
  await db.prepare(`
    INSERT INTO history (codigo, field, old_value, new_value, "user", user_id, user_role, action, entity, note)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    codigo || '',
    field || action || '',
    String(oldValue ?? ''),
    String(newValue ?? ''),
    actor.name || actor.username || 'Sistema',
    actor.id || null,
    actor.role || 'Sistema',
    action || field || '',
    entity || '',
    note || ''
  );
}

export async function recordChanges(codigo, oldRow, newValues, user, note, entity = 'Material') {
  for (const [field, newValue] of Object.entries(newValues)) {
    if (['user', 'note'].includes(field)) return;
    const oldValue = oldRow?.[field] ?? '';
    if (String(oldValue ?? '') !== String(newValue ?? '')) {
      await addHistory({
        codigo,
        field,
        oldValue,
        newValue,
        user,
        action: field.includes('short_') || field.includes('long_') ? 'Resultado final editado' : 'Campo alterado',
        entity,
        note
      });
    }
  }
}
