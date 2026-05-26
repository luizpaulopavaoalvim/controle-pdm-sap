import fs from 'fs';
import path from 'path';
import initSqlJs from 'sql.js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
dotenv.config();

const databasePath = process.env.DATABASE_PATH || path.resolve(__dirname, '..', 'data', 'pdm_sap.sqlite');
const resolvedPath = path.resolve(databasePath);
const usePostgres = Boolean(process.env.DATABASE_URL) && process.env.DB_CLIENT !== 'sqlite';

let SQL;
let sqlite;
let pool;

function persist() {
  if (usePostgres) return;
  fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
  fs.writeFileSync(resolvedPath, Buffer.from(sqlite.export()));
}

function bindParams(stmt, params) {
  if (params === undefined) return;
  if (Array.isArray(params)) {
    stmt.bind(params);
    return;
  }
  if (params && typeof params === 'object') {
    const expanded = {};
    Object.entries(params).forEach(([key, value]) => {
      expanded[key] = value;
      expanded[`@${key}`] = value;
      expanded[`:${key}`] = value;
      expanded[`$${key}`] = value;
    });
    stmt.bind(expanded);
    return;
  }
  stmt.bind([params]);
}

function sqliteStatement(sql) {
  return {
    run(...params) {
      const stmt = sqlite.prepare(sql);
      const value = params.length === 1 ? params[0] : params;
      if (params.length) bindParams(stmt, value);
      while (stmt.step()) {}
      stmt.free();
      persist();
      return { changes: sqlite.getRowsModified() };
    },
    get(...params) {
      const stmt = sqlite.prepare(sql);
      const value = params.length === 1 ? params[0] : params;
      if (params.length) bindParams(stmt, value);
      const row = stmt.step() ? stmt.getAsObject() : undefined;
      stmt.free();
      return row;
    },
    all(...params) {
      const stmt = sqlite.prepare(sql);
      const value = params.length === 1 ? params[0] : params;
      if (params.length) bindParams(stmt, value);
      const rows = [];
      while (stmt.step()) rows.push(stmt.getAsObject());
      stmt.free();
      return rows;
    }
  };
}

function normalizeSqlForPostgres(sql) {
  return sql
    .replace(/AUTOINCREMENT/gi, '')
    .replace(/INTEGER PRIMARY KEY/gi, 'BIGSERIAL PRIMARY KEY');
}

function pgBind(sql, params) {
  const values = [];
  if (!params.length) return { text: normalizeSqlForPostgres(sql), values };

  const value = params.length === 1 ? params[0] : params;
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const seen = new Map();
    const text = normalizeSqlForPostgres(sql).replace(/[@:$]([a-zA-Z_][a-zA-Z0-9_]*)/g, (match, key, offset, full) => {
      if (match.startsWith(':') && full[offset - 1] === ':') return match;
      if (!Object.prototype.hasOwnProperty.call(value, key)) return match;
      if (!seen.has(key)) {
        values.push(value[key]);
        seen.set(key, `$${values.length}`);
      }
      return seen.get(key);
    });
    return { text, values };
  }

  const positional = Array.isArray(value) ? value : [value];
  let index = 0;
  const text = normalizeSqlForPostgres(sql).replace(/\?/g, () => {
    index += 1;
    return `$${index}`;
  });
  return { text, values: positional };
}

function pgStatement(sql) {
  return {
    async run(...params) {
      const query = pgBind(sql, params);
      const result = await pool.query(query.text, query.values);
      return { changes: result.rowCount };
    },
    async get(...params) {
      const query = pgBind(sql, params);
      const result = await pool.query(query.text, query.values);
      return result.rows[0];
    },
    async all(...params) {
      const query = pgBind(sql, params);
      const result = await pool.query(query.text, query.values);
      return result.rows;
    }
  };
}

const db = {
  client: usePostgres ? 'postgres' : 'sqlite',
  pragma() {},
  async exec(sql) {
    if (usePostgres) {
      await pool.query(sql);
      return;
    }
    sqlite.exec(sql);
    persist();
  },
  async query(sql, params = []) {
    if (!usePostgres) throw new Error('db.query esta disponivel apenas para PostgreSQL');
    return pool.query(sql, params);
  },
  prepare(sql) {
    return usePostgres ? pgStatement(sql) : sqliteStatement(sql);
  }
};

async function sqliteColumnExists(table, column) {
  return (await db.prepare(`PRAGMA table_info(${table})`).all()).some((row) => row.name === column);
}

async function addColumnIfMissing(table, column, definition) {
  if (usePostgres) return;
  if (!(await sqliteColumnExists(table, column))) {
    await db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

async function initPostgres() {
  const { Pool } = await import('pg');
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('sslmode=require') || process.env.PGSSLMODE === 'require'
      ? { rejectUnauthorized: false }
      : undefined
  });
  const schema = fs.readFileSync(path.resolve(__dirname, '..', 'postgres', 'schema.sql'), 'utf8');
  const seed = fs.readFileSync(path.resolve(__dirname, '..', 'postgres', 'seed.sql'), 'utf8');
  await pool.query(schema);
  await pool.query(seed);
}

async function initSqlite() {
  SQL = await initSqlJs();
  if (fs.existsSync(resolvedPath)) {
    sqlite = new SQL.Database(fs.readFileSync(resolvedPath));
  } else {
    sqlite = new SQL.Database();
  }

  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      username TEXT NOT NULL UNIQUE,
      email TEXT,
      password TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('Admin','Consultor','Validador'))
    );

    CREATE TABLE IF NOT EXISTS pdms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      id_padrao TEXT,
      nome_valido TEXT,
      atributos_dt TEXT,
      id_pdm TEXT NOT NULL UNIQUE,
      nome_pdm TEXT NOT NULL,
      descricao_pdm TEXT,
      tipo_material TEXT,
      palavra_chave TEXT,
      estrutura_texto_breve_pt TEXT,
      estrutura_texto_longo_pt TEXT,
      estrutura_texto_breve_en TEXT,
      estrutura_texto_longo_en TEXT,
      observacao TEXT,
      modified_by_user_id INTEGER,
      modified_by_name TEXT,
      modified_by_role TEXT,
      modified_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS materials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      codigo TEXT NOT NULL UNIQUE,
      descricao TEXT NOT NULL,
      texto_longo_original TEXT,
      centro TEXT,
      deposito TEXT,
      tipo_material TEXT,
      fabricante TEXT,
      part_number TEXT,
      modelo TEXT,
      dimensao TEXT,
      material TEXT,
      aplicacao TEXT,
      observacao TEXT,
      suggested_pdm_id TEXT,
      suggested_pdm_name TEXT,
      confidence INTEGER DEFAULT 0,
      suggestion_reason TEXT,
      status TEXT NOT NULL DEFAULT 'PENDENTE',
      responsible TEXT,
      short_pt TEXT,
      long_pt TEXT,
      short_en TEXT,
      long_en TEXT,
      final_result INTEGER DEFAULT 0,
      source_file TEXT,
      import_batch TEXT,
      row_number INTEGER,
      import_order INTEGER,
      import_error TEXT,
      modified_by_user_id INTEGER,
      modified_by_name TEXT,
      modified_by_role TEXT,
      modified_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS pdm_attributes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pdm_id TEXT NOT NULL,
      dt_column TEXT NOT NULL,
      attribute_order INTEGER NOT NULL,
      attribute_name TEXT NOT NULL,
      UNIQUE(pdm_id, dt_column)
    );

    CREATE TABLE IF NOT EXISTS history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      codigo TEXT NOT NULL,
      field TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      user TEXT NOT NULL,
      user_id INTEGER,
      user_role TEXT,
      action TEXT,
      entity TEXT,
      note TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  await addColumnIfMissing('pdms', 'id_padrao', 'TEXT');
  await addColumnIfMissing('pdms', 'nome_valido', 'TEXT');
  await addColumnIfMissing('pdms', 'atributos_dt', 'TEXT');
  await addColumnIfMissing('pdms', 'modified_by_user_id', 'INTEGER');
  await addColumnIfMissing('pdms', 'modified_by_name', 'TEXT');
  await addColumnIfMissing('pdms', 'modified_by_role', 'TEXT');
  await addColumnIfMissing('pdms', 'modified_at', 'TEXT');
  await addColumnIfMissing('materials', 'texto_longo_original', 'TEXT');
  await addColumnIfMissing('materials', 'source_file', 'TEXT');
  await addColumnIfMissing('materials', 'import_batch', 'TEXT');
  await addColumnIfMissing('materials', 'row_number', 'INTEGER');
  await addColumnIfMissing('materials', 'import_order', 'INTEGER');
  await addColumnIfMissing('materials', 'import_error', 'TEXT');
  await addColumnIfMissing('materials', 'modified_by_user_id', 'INTEGER');
  await addColumnIfMissing('materials', 'modified_by_name', 'TEXT');
  await addColumnIfMissing('materials', 'modified_by_role', 'TEXT');
  await addColumnIfMissing('materials', 'modified_at', 'TEXT');
  await addColumnIfMissing('users', 'email', 'TEXT');
  await addColumnIfMissing('history', 'user_id', 'INTEGER');
  await addColumnIfMissing('history', 'user_role', 'TEXT');
  await addColumnIfMissing('history', 'action', 'TEXT');
  await addColumnIfMissing('history', 'entity', 'TEXT');
}

export async function initDb() {
  if (usePostgres) await initPostgres();
  else await initSqlite();
}

export default db;
