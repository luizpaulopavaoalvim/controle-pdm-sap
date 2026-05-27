CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE,
  email TEXT,
  password TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('Admin','Consultor','Validador','Leitura'))
);

CREATE TABLE IF NOT EXISTS pdms (
  id BIGSERIAL PRIMARY KEY,
  id_padrao TEXT,
  nome_valido TEXT,
  atributos_dt JSONB DEFAULT '[]'::jsonb,
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
  modified_by_user_id BIGINT,
  modified_by_name TEXT,
  modified_by_role TEXT,
  modified_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS materials (
  id BIGSERIAL PRIMARY KEY,
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
  alternative_1 TEXT,
  alternative_2 TEXT,
  alternative_3 TEXT,
  matched_words TEXT,
  doubtful_words TEXT,
  processing_ms INTEGER DEFAULT 0,
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
  modified_by_user_id BIGINT,
  modified_by_name TEXT,
  modified_by_role TEXT,
  modified_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pdm_attributes (
  id BIGSERIAL PRIMARY KEY,
  pdm_id TEXT NOT NULL,
  dt_column TEXT NOT NULL,
  attribute_order INTEGER NOT NULL,
  attribute_name TEXT NOT NULL,
  UNIQUE (pdm_id, dt_column)
);

CREATE TABLE IF NOT EXISTS history (
  id BIGSERIAL PRIMARY KEY,
  codigo TEXT NOT NULL DEFAULT '',
  field TEXT NOT NULL DEFAULT '',
  old_value TEXT,
  new_value TEXT,
  "user" TEXT NOT NULL,
  user_id BIGINT,
  user_role TEXT,
  action TEXT,
  entity TEXT,
  note TEXT,
  ip_address TEXT,
  user_agent TEXT,
  screen TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS companies (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS projects (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT REFERENCES companies(id),
  name TEXT NOT NULL,
  pdm_base_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, name)
);

CREATE TABLE IF NOT EXISTS technical_logs (
  id BIGSERIAL PRIMARY KEY,
  level TEXT NOT NULL DEFAULT 'info',
  action TEXT,
  entity TEXT,
  message TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  duration_ms INTEGER,
  rows_processed INTEGER,
  user_id BIGINT,
  user_name TEXT,
  user_role TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_materials_status ON materials(status);
CREATE INDEX IF NOT EXISTS idx_materials_import_order ON materials(import_order);
CREATE INDEX IF NOT EXISTS idx_history_created_at ON history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pdms_id_pdm ON pdms(id_pdm);
CREATE INDEX IF NOT EXISTS idx_technical_logs_created_at ON technical_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_username_password ON users(username, password);
