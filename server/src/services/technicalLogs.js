import db from '../db.js';

function reqMeta(req = {}) {
  return {
    ip_address: req.headers?.['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || req.socket?.remoteAddress || '',
    user_agent: req.headers?.['user-agent'] || ''
  };
}

export async function addTechnicalLog({
  req,
  user,
  level = 'info',
  action = '',
  entity = '',
  message = '',
  details = {},
  durationMs = null,
  rowsProcessed = null
}) {
  const meta = reqMeta(req);
  try {
    await db.prepare(`
      INSERT INTO technical_logs (
        level, action, entity, message, details, duration_ms, rows_processed,
        user_id, user_name, user_role, ip_address, user_agent
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      level,
      action,
      entity,
      message,
      JSON.stringify(details || {}),
      durationMs,
      rowsProcessed,
      user?.id || null,
      user?.name || user?.username || '',
      user?.role || '',
      meta.ip_address,
      meta.user_agent
    );
  } catch (error) {
    console.error('[technical-log-error]', error.message);
  }
}
