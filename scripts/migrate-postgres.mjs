import fs from 'fs/promises';
import path from 'path';

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

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL nao configurada.');
  process.exit(1);
}

async function main() {
  const { Client } = await import('pg');
  const client = new Client({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined
  });

  await client.connect();
  const root = process.cwd();
  const schema = await fs.readFile(path.join(root, 'server/postgres/schema.sql'), 'utf8');
  const seed = await fs.readFile(path.join(root, 'server/postgres/seed.sql'), 'utf8');
  await client.query(schema);
  await client.query(seed);
  await client.end();
  console.log('PostgreSQL migrado e seed inicial aplicado.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
