# Google Workspace Setup

## Required Google Cloud Setup

1. Create or select a Google Cloud project.
2. Enable the Admin SDK API.
3. Configure the OAuth consent screen for your app.
4. Create an OAuth client for a web application.
5. Add the callback URL:

   - `http://localhost:3001/api/auth/google/callback`
   - or your production equivalent

6. Create a service account.
7. Turn on Domain-Wide Delegation for that service account.
8. Download the service account JSON key.

## Required Google Workspace Admin Setup

In the Google Workspace Admin console, authorize the service account client ID for domain-wide delegation and grant these scopes:

- `https://www.googleapis.com/auth/admin.directory.user.readonly`
- `https://www.googleapis.com/auth/admin.directory.group.readonly`
- `https://www.googleapis.com/auth/admin.directory.group.member`
- `https://www.googleapis.com/auth/admin.directory.rolemanagement.readonly`

Use an admin account in `GOOGLE_ADMIN_EMAIL` that is allowed to read users, groups, and memberships for the target domain.

## IDMatr Environment Variables

Set these in `.env`:

```bash
DATA_ENCRYPTION_KEY=replace-with-strong-random-secret
GOOGLE_OAUTH_CLIENT_ID=your-google-oauth-client-id
GOOGLE_OAUTH_CLIENT_SECRET=your-google-oauth-client-secret
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:3001/api/auth/google/callback
GOOGLE_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"your-project","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n","client_email":"google-sync@your-project.iam.gserviceaccount.com","client_id":"1234567890"}'
GOOGLE_ADMIN_EMAIL=admin@yourdomain.com
GOOGLE_DOMAIN=yourdomain.com
```

## IDMatr Onboarding Flow

1. Start Google OAuth with the tenant slug:

```bash
open "http://localhost:3001/api/auth/google?tenantSlug=idmatr"
```

2. Sign in with a Google Workspace admin account from the tenant domain.
3. IDMatr redirects you to the onboarding page at `/api/integrations/google/onboarding`.
4. Upload the service account JSON or paste it into the form, then connect.
5. IDMatr validates the service account with domain-wide delegation, stores the credentials encrypted, and immediately runs:

- `/api/integrations/google/sync-users`
- `/api/integrations/google/sync-groups`
- `/api/integrations/google/sync-roles`

You can also call the APIs directly after OAuth trust is established:

```bash
curl -X POST http://localhost:3001/api/integrations/google/connect \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{"serviceAccountKeyJson":"{\"type\":\"service_account\",...}","adminEmail":"admin@yourdomain.com","domain":"yourdomain.com"}'
```

## Security Model

- OAuth is used only to establish admin identity and tenant-domain trust.
- Full org sync uses the service account plus domain-wide delegation.
- The service account JSON is encrypted server-side before storage.
- Google credentials never need to be exposed by the API after initial connect.
- Tenant domain mismatch causes onboarding to fail instead of falling back to fake or partial data.

## What IDMatr Stores

### Users

- email
- full name
- org unit path
- admin role names
- last login
- suspended and archived status

### Groups

- group email
- group name
- description
- direct member count

### Memberships

- group membership role
- member identity
- member email

These records drive ISPM, IGA, IVIP, ITDR, and IAM identity mapping.
