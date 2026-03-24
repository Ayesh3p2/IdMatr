# IDMatr Quick Start

## 1. Start The Stack

```bash
cp .env.example .env
npm install && npm run build
docker compose up --build
```

## 2. Bootstrap Login

- Tenant slug: `idmatr`
- Email: `admin@idmatr.local`
- Password: `ChangeMe123!`

Login endpoint:

```text
POST /api/auth/login
```

## 3. Configure Google Workspace

Set these variables in `.env`:

- `GOOGLE_SERVICE_ACCOUNT_KEY`
- `GOOGLE_ADMIN_EMAIL`
- `GOOGLE_DOMAIN`
- `DATA_ENCRYPTION_KEY`

Then call:

```bash
curl -X POST http://localhost:3001/api/integrations/google/connect \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{}'

curl -X POST http://localhost:3001/api/integrations/google/sync-users \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{}'

curl -X POST http://localhost:3001/api/integrations/google/sync-groups \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{}'
```

## 4. Use Real Data

- `GET /api/integrations/google/users`
- `GET /api/integrations/google/groups`
- `GET /api/iam/identities`
- `GET /api/ispm/apps`
- `POST /api/itdr/detect/google`

For full credential setup, use [docs/GOOGLE_WORKSPACE_SETUP.md](/Users/sudhir/Music/IdMatr/docs/GOOGLE_WORKSPACE_SETUP.md).
