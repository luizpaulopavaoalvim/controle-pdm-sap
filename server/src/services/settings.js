import db from '../db.js';

export async function getSetting(key, fallback = '') {
  const row = await db.prepare('SELECT value FROM app_settings WHERE key = ?').get(key);
  return row?.value ?? fallback;
}

export async function setSetting(key, value) {
  await db.prepare(`
    INSERT INTO app_settings (key, value)
    VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value
  `).run(key, String(value ?? ''));
}

export async function setSettings(values = {}) {
  for (const [key, value] of Object.entries(values)) {
    await setSetting(key, value);
  }
}
