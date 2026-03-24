# IDMatr

IDMatr is a monolith-first identity platform built to run real integrations, starting with Google Workspace through the Admin SDK and domain-wide delegation.

## What Works Now

- One backend service: `apps/control-plane`
- One PostgreSQL database
- JWT auth, MFA, RBAC, invites, tenant isolation
- Real Google Workspace integration
- Real synced identities, groups, and memberships
- IAM identity mapping between local users and synced Google users
- IGA access reviews against real Google group memberships
- IVIP provisioning requests that add Google group memberships on approval
- ISPM app inventory and risk indicators from synced Google data
- ITDR detections for inactive and high-privilege Google users
- Periodic Google sync scheduler

## Quick Start

```bash
cp .env.example .env
npm install && npm run build
docker compose up --build
```

## Bootstrap Login

- Tenant slug: `idmatr`
- Email: `admin@idmatr.local`
- Password: `ChangeMe123!`

## Google Setup

See [docs/GOOGLE_WORKSPACE_SETUP.md](/Users/sudhir/Music/IdMatr/docs/GOOGLE_WORKSPACE_SETUP.md) for the full service-account and domain-wide delegation flow.

Once your `.env` has valid Google credentials:

1. `POST /api/integrations/google/connect`
2. `POST /api/integrations/google/sync-users`
3. `POST /api/integrations/google/sync-groups`

## Core API Areas

- `/api/auth`
- `/api/tenants`
- `/api/users`
- `/api/invites`
- `/api/mfa`
- `/api/integrations/google/*`
- `/api/iam/*`
- `/api/iga/reviews/*`
- `/api/ivip/requests/*`
- `/api/ispm/apps`
- `/api/itdr/*`
