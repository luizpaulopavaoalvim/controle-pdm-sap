# README_PRODUCAO - Controle Inteligente de PDM SAP

Este documento prepara o projeto para publicacao web com frontend na Vercel, backend no Render/Railway e banco PostgreSQL em Supabase/Neon/Render PostgreSQL.

## Estado atual

- Frontend pronto para build Vite.
- Backend Express pronto para ambiente Node.
- CORS configuravel por `FRONTEND_URL` e `CORS_ORIGINS`.
- Notificacao por e-mail preparada por SMTP.
- Schema PostgreSQL criado em `server/postgres/schema.sql`.
- Seed inicial PostgreSQL criado em `server/postgres/seed.sql`.
- Runtime do backend usa PostgreSQL automaticamente quando `DATABASE_URL` estiver configurada.
- Sem `DATABASE_URL`, o backend usa SQLite apenas como fallback local de desenvolvimento.

## Rodar localmente

```bash
npm install
npm run dev
```

URLs locais:

- Frontend: `http://localhost:5173`
- API: `http://localhost:4000/api`
- Health: `http://localhost:4000/api/health`

## Variaveis do frontend Vercel

Configure no painel da Vercel:

```env
VITE_API_URL=https://SUA-API.onrender.com/api
```

Build:

```bash
npm install --prefix client
npm run build --prefix client
```

Output directory:

```text
client/dist
```

## Variaveis do backend Render/Railway

```env
NODE_ENV=production
PORT=4000
HOST=0.0.0.0
FRONTEND_URL=https://SEU-FRONTEND.vercel.app
CORS_ORIGINS=https://SEU-FRONTEND.vercel.app
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require
DB_CLIENT=postgres
EMAIL_HOST=smtp.seu-provedor.com
EMAIL_PORT=587
EMAIL_USER=usuario-smtp
EMAIL_PASS=senha-smtp
EMAIL_FROM="Controle PDM SAP <usuario-smtp@dominio.com>"
EMAIL_NOTIFY_TO=lpaulo.alvim@hotmail.com
```

## Banco PostgreSQL

Opcoes recomendadas:

- Supabase PostgreSQL
- Neon PostgreSQL
- Render PostgreSQL

Criar estrutura:

```bash
DATABASE_URL="postgresql://..." npm run migrate:postgres
```

Esse script aplica:

- tabelas principais
- indices
- usuario admin inicial
- PDM fallback `(NAO-PADRONIZADO)`

Admin inicial:

```text
admin / 123456
```

## Publicar frontend na Vercel

1. Suba o projeto para um repositorio Git.
2. Importe o repositorio na Vercel.
3. Configure o root como o repositorio.
4. Use o `vercel.json` deste projeto.
5. Configure `VITE_API_URL` com a URL publica da API.
6. Publique.

## Publicar backend no Render

1. Suba o projeto para um repositorio Git.
2. Crie um Web Service no Render apontando para o repositorio.
3. Use `render.yaml` ou configure manualmente:
   - Root directory: `server`
   - Build command: `npm install`
   - Start command: `npm start`
4. Configure todas as variaveis do backend.
5. Publique.
6. Teste `/api/health`.

## Manutencao futura

Para atualizar:

1. Alterar codigo localmente.
2. Rodar:

```bash
npm run qa:functional
npm run qa:import-flex
npm run build --prefix client
```

3. Fazer commit e push.
4. Vercel/Render fazem deploy automatico.
5. Testar:
   - `/api/health`
   - login admin
   - cadastro consultor
   - importacao PDM
   - importacao materiais
   - resultado final
   - exportacao Excel

## Pendencias antes de uso real publico

- Implementar hash de senha com bcrypt.
- Trocar token demonstrativo por JWT/session segura.
- Configurar SMTP real.
- Configurar dominio e HTTPS.
- Configurar backup do banco.
- Configurar logs, rate limiting e politicas LGPD.
