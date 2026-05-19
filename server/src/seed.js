import db from './db.js';

async function ensureAdmin() {
  const admin = await db.prepare("SELECT id FROM users WHERE username = 'admin'").get();
  if (admin) {
    await db.prepare("UPDATE users SET name = 'Administrador', email = 'admin@local', password = '123456', role = 'Admin' WHERE username = 'admin'").run();
    return;
  }

  await db.prepare('INSERT INTO users (name, username, email, password, role) VALUES (?, ?, ?, ?, ?)')
    .run('Administrador', 'admin', 'admin@local', '123456', 'Admin');
}

async function ensureFallbackPdm() {
  const fallback = await db.prepare("SELECT id FROM pdms WHERE id_pdm = '1'").get();
  if (fallback) return;

  await db.prepare(`
    INSERT INTO pdms (
      id_padrao, nome_valido, atributos_dt, id_pdm, nome_pdm, descricao_pdm,
      tipo_material, palavra_chave, estrutura_texto_breve_pt, estrutura_texto_longo_pt,
      estrutura_texto_breve_en, estrutura_texto_longo_en, observacao
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    '1',
    '(NÃO-PADRONIZADO)',
    '[]',
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
  );
}

export async function seedDemoData() {
  await ensureAdmin();
  await ensureFallbackPdm();
}
