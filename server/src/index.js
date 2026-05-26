import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDb } from './db.js';
import { seedDemoData } from './seed.js';
import authRoutes from './routes/auth.js';
import dashboardRoutes from './routes/dashboard.js';
import pdmRoutes from './routes/pdms.js';
import materialRoutes from './routes/materials.js';
import historyRoutes from './routes/history.js';
import exportRoutes from './routes/export.js';
import adminRoutes from './routes/admin.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const upload = multer({ dest: path.resolve(__dirname, '../uploads') });
const app = express();

const envOrigins = String(process.env.CORS_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  process.env.FRONTEND_URL,
  ...envOrigins
].filter(Boolean);

function isLocalNetworkOrigin(origin = '') {
  return /^http:\/\/(localhost|127\.0\.0\.1):5173$/.test(origin)
    || /^http:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}:5173$/.test(origin)
    || /^http:\/\/172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}:5173$/.test(origin)
    || /^http:\/\/192\.168\.\d{1,3}\.\d{1,3}:5173$/.test(origin);
}

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin) || isLocalNetworkOrigin(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error(`Origem nao permitida pelo CORS: ${origin}`));
  }
}));
app.use(express.json({ limit: '10mb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true, name: 'Controle Inteligente de PDM SAP' }));
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/pdms', upload.single('file'), pdmRoutes);
app.use('/api/materials', upload.single('file'), materialRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/admin', adminRoutes);

app.use((error, _req, res, _next) => {
  console.error('[api-error]', error.message);
  res.status(500).json({ message: 'Erro interno no servidor' });
});

const port = process.env.PORT || 4000;
const host = process.env.HOST || '0.0.0.0';
await initDb();
await seedDemoData();

app.listen(port, host, () => {
  console.log(`API Controle Inteligente de PDM SAP em http://${host}:${port}`);
});
