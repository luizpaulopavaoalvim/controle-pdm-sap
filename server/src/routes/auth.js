import express from 'express';
import db from '../db.js';
import { notifyUserRegistration } from '../services/email.js';
import { addHistory } from '../services/history.js';

const router = express.Router();

function stripAccents(value = '') {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function baseLoginFromName(name = '') {
  const words = stripAccents(name)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return '';
  const first = words[0];
  const last = words.length > 1 ? words[words.length - 1] : '';
  return `${first}${last}`;
}

async function availableUsername(name = '') {
  const base = baseLoginFromName(name);
  if (!base) return '';

  let candidate = base;
  let suffix = 2;
  while (await db.prepare('SELECT id FROM users WHERE username = ?').get(candidate)) {
    candidate = `${base}${suffix}`;
    suffix += 1;
  }
  return candidate;
}

router.post('/login', async (req, res) => {
  const username = String(req.body.username || req.body.name || '').trim();
  const password = String(req.body.password || '').trim();
  if (!/^\d{6}$/.test(password)) {
    return res.status(400).json({ message: 'A senha deve conter exatamente 6 numeros' });
  }
  const user = await db.prepare(`
    SELECT id, name, username, email, role
    FROM users
    WHERE (username = ? OR name = ?) AND password = ?
  `).get(username, username, password);
  if (!user) return res.status(401).json({ message: 'Usuario ou senha invalidos' });
  await addHistory({ user, action: 'Login realizado', entity: 'Autenticacao', field: 'login', newValue: user.username, req, screen: 'Login' });
  res.json({ user, token: `demo-token-${user.username}` });
});

router.get('/suggest-login', (req, res) => {
  const name = String(req.query.name || '').trim();
  availableUsername(name).then((username) => res.json({ username }));
});

router.post('/register', async (req, res) => {
  const name = String(req.body.name || req.body.username || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '').trim();
  const confirmPassword = String(req.body.confirmPassword || '').trim();

  if (!name) return res.status(400).json({ message: 'Informe o nome do usuario' });
  if (!email) return res.status(400).json({ message: 'Informe o e-mail' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ message: 'Informe um e-mail valido' });
  }
  if (!/^\d{6}$/.test(password)) {
    return res.status(400).json({ message: 'A senha deve conter exatamente 6 numeros' });
  }
  if (password !== confirmPassword) {
    return res.status(400).json({ message: 'A confirmacao da senha nao confere' });
  }

  const username = await availableUsername(name);
  if (!username) return res.status(400).json({ message: 'Informe nome completo valido' });

  await db.prepare('INSERT INTO users (name, username, email, password, role) VALUES (?, ?, ?, ?, ?)')
    .run(name, username, email, password, 'Consultor');
  const user = await db.prepare('SELECT id, name, username, email, role FROM users WHERE username = ?').get(username);
  await addHistory({
    codigo: '',
    field: 'usuario',
    newValue: username,
    user,
    action: 'Usuario cadastrado',
    entity: 'Usuario',
    note: `Cadastro criado para ${email}`,
    req,
    screen: 'Cadastro'
  });
  await notifyUserRegistration(user);
  res.status(201).json({ user, token: `demo-token-${user.username}` });
});

router.get('/users', async (_req, res) => {
  res.json(await db.prepare('SELECT id, name, username, email, role FROM users ORDER BY name').all());
});

export default router;
