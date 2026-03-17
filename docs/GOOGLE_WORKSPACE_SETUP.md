# Google Workspace Connector Setup

This guide explains how to configure the Google Workspace connector to discover identities, application access, and OAuth-connected apps from your Google Workspace domain.

---

## How It Works

The discovery service uses the **Google Admin SDK Directory API** with a **Service Account** and **Domain-Wide Delegation (DWD)** to:

1. List all users in your Google Workspace domain
2. Identify admins and their privilege level
3. Discover OAuth-connected third-party apps via the Reports API (best-effort)

The connector uses **read-only scopes only** — it never modifies any Google Workspace data.

---

## Step 1: Create a Google Cloud Project

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Click **Select a project** → **New Project**
3. Name it (e.g., `IDMatr Integration`) and click **Create**
4. Note the **Project ID**

---

## Step 2: Enable Required APIs

In your new project, enable the following APIs:

1. Navigate to **APIs & Services → Library**
2. Search for and enable each API:
   - **Admin SDK API** (also called "Admin SDK")
   - **Google Workspace Reseller API** (optional, for reseller access)

Or use the gcloud CLI:

```bash
gcloud services enable admin.googleapis.com
gcloud services enable reports.googleapis.com
```

---

## Step 3: Create a Service Account

1. Go to **IAM & Admin → Service Accounts**
2. Click **Create Service Account**
3. Fill in:
   - Name: `idmatr-discovery`
   - Description: `IDMatr identity discovery read-only`
4. Click **Create and Continue**
5. Skip the role assignment (click **Continue**)
6. Click **Done**

---

## Step 4: Create and Download a JSON Key

1. Click on your new service account to open it
2. Go to the **Keys** tab
3. Click **Add Key → Create New Key**
4. Select **JSON** format
5. Click **Create** — a JSON file downloads automatically

Keep this file secure. You will reference it in your `.env` config.

---

## Step 5: Enable Domain-Wide Delegation

1. Go back to the service account detail page
2. Click **Edit** (pencil icon)
3. Expand **Advanced settings**
4. Check **Enable Google Workspace Domain-wide Delegation**
5. Enter a product name (e.g., `IDMatr Discovery`)
6. Click **Save**
7. Note the **Client ID** shown in the service account list (a long number)

---

## Step 6: Authorize the Scopes in Google Admin Console

This step must be completed by a **Super Admin** of your Google Workspace domain.

1. Go to [admin.google.com](https://admin.google.com)
2. Navigate to **Security → Access and data control → API controls**
3. Click **Manage Domain Wide Delegation**
4. Click **Add new**
5. Enter:
   - **Client ID:** The client ID from Step 5
   - **OAuth scopes (comma separated):**
     ```
     https://www.googleapis.com/auth/admin.directory.user.readonly,
     https://www.googleapis.com/auth/admin.directory.group.readonly,
     https://www.googleapis.com/auth/admin.reports.audit.readonly
     ```
6. Click **Authorize**

> **Important:** The Reports API scope (`admin.reports.audit.readonly`) is optional — it's used for discovering OAuth-connected apps. The connector works without it.

---

## Step 7: Configure IDMatr

Add the following to your `.env` file:

```dotenv
# Set to false to use real connectors
DEMO_MODE=false

# Option A: Path to the downloaded JSON key file
GOOGLE_SERVICE_ACCOUNT_KEY=/run/secrets/google-sa.json

# Option B: Inline JSON content (useful for Docker secrets / CI)
# GOOGLE_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"...","private_key":"...","client_email":"..."}'

# A Google Workspace admin email to impersonate via Domain-Wide Delegation
GOOGLE_ADMIN_EMAIL=admin@yourcompany.com

# Your primary Google Workspace domain
GOOGLE_DOMAIN=yourcompany.com
```

### Using Docker Secrets (Recommended for Production)

Instead of putting the JSON in a file path or environment variable, use Docker secrets:

1. Create the secret:
   ```bash
   docker secret create google-sa-key /path/to/service-account.json
   ```

2. Mount it in `docker-compose.yml` under the `discovery-service`:
   ```yaml
   secrets:
     - google-sa-key
   environment:
     GOOGLE_SERVICE_ACCOUNT_KEY: /run/secrets/google-sa-key
   ```

3. Add the secret definition at the bottom of `docker-compose.yml`:
   ```yaml
   secrets:
     google-sa-key:
       external: true
   ```

---

## Step 8: Verify the Connection

After starting IDMatr with `docker compose up`, verify the connector works:

```bash
# Trigger a discovery scan via the API
curl -X POST http://localhost:3001/api/discovery/scan \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"source":"google"}'
```

Or use the Admin Dashboard:
1. Log in at http://localhost:3000
2. Navigate to **Applications**
3. Click **Run Discovery Scan**
4. Check the scan result — it should show `google` in `sources_scanned`

---

## Required Scopes Summary

| Scope | Purpose | Required? |
|-------|---------|-----------|
| `admin.directory.user.readonly` | List all users | ✅ Yes |
| `admin.directory.group.readonly` | List groups and memberships | ✅ Yes |
| `admin.reports.audit.readonly` | Discover OAuth-connected apps | Optional |

---

## Minimum Permissions

The Google Workspace admin account used for `GOOGLE_ADMIN_EMAIL` impersonation does NOT need to be a Super Admin. A **delegated admin** with the following privileges is sufficient:

- **Users** → View user information
- **Reports** → View reports (for OAuth app discovery)

---

## Troubleshooting

### Error: "Client is unauthorized to retrieve access tokens"

The Domain-Wide Delegation scopes are not yet authorized in the Google Admin Console, or you used the wrong Client ID. Re-check Step 6.

### Error: "The caller does not have permission"

The service account's domain-wide delegation is not configured, or the `GOOGLE_ADMIN_EMAIL` account doesn't have the required Admin SDK privileges.

### No users returned

Check:
1. `GOOGLE_DOMAIN` matches your primary domain (not an alias)
2. The admin email in `GOOGLE_ADMIN_EMAIL` exists and is active
3. The service account JSON is valid (not expired or revoked)

### OAuth apps not appearing

The Reports API (`admin.reports.audit.readonly` scope) may not be authorized. This is optional — the connector will still discover users without it.

---

## Data Collected

The Google Workspace connector collects the following **read-only** data:

| Data | Source | Notes |
|------|--------|-------|
| User email addresses | Directory API | Primary identifier |
| Display names | Directory API | Full name |
| Account status | Directory API | Active / Suspended |
| Admin status | Directory API | Is the user a super admin? |
| Last login time | Directory API | For dormant account detection |
| OAuth app names | Reports API | Apps users authorized via OAuth |

**No passwords, no email content, no Drive files, no Calendar events are ever accessed.**
