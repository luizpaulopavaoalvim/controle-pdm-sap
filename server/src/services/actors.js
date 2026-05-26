import db from '../db.js';

export async function getActor(username = '') {
  const key = String(username || '').trim();
  if (!key) return null;
  return await db.prepare('SELECT id, name, username, email, role FROM users WHERE username = ? OR name = ?').get(key, key) || null;
}

export function actorPayload(actor) {
  return {
    modified_by_user_id: actor?.id || null,
    modified_by_name: actor?.name || actor?.username || 'Sistema',
    modified_by_role: actor?.role || 'Sistema'
  };
}

export async function requireActor(req, res) {
  const username = req.body?.user || req.query?.user || req.headers['x-user'];
  const actor = await getActor(username);
  if (!actor) {
    res.status(401).json({ message: 'Usuario autenticado obrigatorio para esta acao' });
    return null;
  }
  return actor;
}

export async function requireOperationalActor(req, res, allowedRoles = ['Consultor', 'Validador']) {
  const actor = await requireActor(req, res);
  if (!actor) return null;
  if (!allowedRoles.includes(actor.role)) {
    res.status(403).json({ message: 'Seu perfil não possui permissão para esta ação.' });
    return null;
  }
  return actor;
}
