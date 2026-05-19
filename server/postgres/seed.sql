INSERT INTO users (name, username, email, password, role)
VALUES ('Administrador', 'admin', 'admin@local', '123456', 'Admin')
ON CONFLICT (username) DO UPDATE SET
  name = EXCLUDED.name,
  email = EXCLUDED.email,
  password = EXCLUDED.password,
  role = EXCLUDED.role;

INSERT INTO pdms (
  id_padrao, nome_valido, atributos_dt, id_pdm, nome_pdm, descricao_pdm,
  tipo_material, palavra_chave, estrutura_texto_breve_pt, estrutura_texto_longo_pt,
  estrutura_texto_breve_en, estrutura_texto_longo_en, observacao
)
VALUES (
  '1',
  '(NÃO-PADRONIZADO)',
  '[]'::jsonb,
  '1',
  '(NÃO-PADRONIZADO)',
  'Fallback usado apenas quando nenhum PDM adequado for encontrado.',
  '',
  'NAO PADRONIZADO',
  '{NOME_PDM}',
  '{NOME_PDM}; {TEXTO_LONGO}',
  '',
  '',
  'Criado automaticamente para fluxo real sem dados demo.'
)
ON CONFLICT (id_pdm) DO NOTHING;
