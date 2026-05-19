# Controle Inteligente de PDM SAP

MVP web para importar uma base padrao PDM, processar planilhas reais de materiais SAP MM, sugerir PDM, auditar alteracoes, gerar textos finais PT/EN e exportar Excel.

## Stack

- Frontend: React, Vite, Tailwind CSS, Recharts, lucide-react
- Backend: Node.js, Express
- Banco em producao: PostgreSQL via `DATABASE_URL`
- Banco local sem `DATABASE_URL`: SQLite via sql.js
- Importacao/exportacao: Excel `.xlsx`
- E-mail: Nodemailer com SMTP por variaveis de ambiente

## Como rodar localmente

```bash
npm install
npm run dev
```

Frontend: `http://127.0.0.1:5173`
API: `http://127.0.0.1:4000/api`

Para limpar dados antigos e voltar ao estado inicial:

```bash
npm run reset:data
```

Esse comando preserva a estrutura, remove materiais, PDMs importados, historico e usuarios antigos, e mantem:

- Admin: `admin` / `123456`
- PDM fallback: `1` / `(NAO-PADRONIZADO)`

## Perfis

- Admin: somente dashboard, leitura executiva, sem exportar ou alterar dados.
- Consultor: importa PDM, importa materiais, classifica, edita, gera resultado final e exporta.
- Validador: valida, aprova, devolve e acompanha.

## Cadastro e Login

- Na tela inicial, use `Entrar` ou `Cadastrar`.
- Cadastro: nome completo, login gerado, e-mail, senha numerica de 6 digitos e confirmacao.
- O login e gerado automaticamente com primeiro nome + ultimo sobrenome, sem acentos, em minusculo.
- Usuarios cadastrados recebem perfil `Consultor`.
- A senha nunca e enviada por e-mail nem registrada no historico.

## Variaveis de ambiente

Copie `.env.example` e ajuste conforme o ambiente:

```env
PORT=4000
HOST=0.0.0.0
FRONTEND_URL=http://localhost:5173
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
VITE_API_URL=http://localhost:4000/api
EMAIL_HOST=
EMAIL_PORT=
EMAIL_USER=
EMAIL_PASS=
EMAIL_FROM=
EMAIL_NOTIFY_TO=lpaulo.alvim@hotmail.com
```

Se o SMTP nao estiver configurado, o cadastro continua funcionando e o backend registra apenas um aviso seguro.

## Planilhas esperadas

### Base PDM

- Aba: `Parte1`
- Colunas: `Id Padrão`, `Nome Válido`, `DT_01`, `DT_02`, `DT_03` ... `DT_115`
- As colunas DT vazias ou com `-` sao ignoradas.
- A ordem dos atributos DT e preservada.

### Materiais

- Colunas: `Código`, `Texto Breve`, `Texto Longo`
- Os cabecalhos aceitam variacoes de acento, caixa e espacos.
- A ordem original da planilha e preservada.
- O nome do arquivo importado aparece no dashboard.

## Scripts uteis

```bash
npm run validate:dev
npm run qa:functional
npm run qa:import-flex
npm run reset:data
npm run build --prefix client
```

## Preparacao para publicacao na web

Ainda antes de abrir para internet:

- Configurar SMTP real para `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS`, `EMAIL_FROM`.
- Definir `FRONTEND_URL` e `CORS_ORIGINS` com os dominios finais.
- Definir `VITE_API_URL` apontando para a API publicada.
- Trocar o armazenamento de senha simples por hash com `bcrypt` ou servico de autenticacao.
- Trocar token demonstrativo por JWT/session seguro.
- Migrar o banco de SQLite para PostgreSQL/Supabase quando houver uso multiusuario real.
- Configurar HTTPS, backups, logs e rate limiting.

Recomendacao de deploy futuro:

- Frontend: Vercel.
- Backend: Render.
- Banco: PostgreSQL gerenciado ou Supabase.

## Estrutura

```text
server/
  src/
    routes/
    services/
    data/
    db.js
    seed.js
    index.js
client/
  src/
    components/
    pages/
    services/
scripts/
```

Em producao, configure `DATABASE_URL` para usar PostgreSQL. Sem `DATABASE_URL`, o banco SQLite local e criado automaticamente em `server/data/pdm_sap.sqlite` ao iniciar a API.
