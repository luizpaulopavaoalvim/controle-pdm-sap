import fs from 'fs/promises';
import path from 'path';
import { Client } from 'pg';

async function loadEnvFile(filePath) {
  try {
    const text = await fs.readFile(filePath, 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const index = trimmed.indexOf('=');
      if (index === -1) continue;
      const key = trimmed.slice(0, index).trim();
      const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, '');
      if (key && !process.env[key]) process.env[key] = value;
    }
  } catch {
    // optional env file
  }
}

await loadEnvFile(path.join(process.cwd(), 'server', '.env'));
await loadEnvFile(path.join(process.cwd(), '.env'));

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL nao configurada.');
  process.exit(1);
}

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

await client.connect();
const result = await client.query(`
  SELECT
    (SELECT COUNT(*) FROM users) AS users,
    (SELECT COUNT(*) FROM pdms) AS pdms,
    (SELECT COUNT(*) FROM materials) AS materials,
    (SELECT COUNT(*) FROM history) AS history,
    (SELECT value FROM app_settings WHERE key = 'latest_material_file') AS latest_file
`);
await client.end();

console.log(JSON.stringify(result.rows[0], null, 2));
