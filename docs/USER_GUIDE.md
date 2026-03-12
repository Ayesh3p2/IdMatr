# IDMatr User Guide
**Version 1.0 | Enterprise Identity Security Platform**

---

## Table of Contents
1. [Platform Overview](#1-platform-overview)
2. [System Architecture](#2-system-architecture)
3. [Installation](#3-installation)
4. [Configuring Identity Providers](#4-configuring-identity-providers)
5. [Discovering Applications](#5-discovering-applications)
6. [Analyzing Identity Risks](#6-analyzing-identity-risks)
7. [Managing Access Governance](#7-managing-access-governance)
8. [Interpreting Dashboards](#8-interpreting-dashboards)
9. [ITDR — Threat Detection & Response](#9-itdr--threat-detection--response)
10. [Compliance Management](#10-compliance-management)

---

## 1. Platform Overview

IDMatr is an enterprise Identity Security Platform that unifies four critical security disciplines:

| Module | What it does |
|--------|--------------|
| **IGA** — Identity Governance & Administration | Manage who has access to what, with automated workflows for requesting, approving, and revoking access |
| **IAM** — Identity & Access Management | Centralize identity lifecycle (Joiner/Mover/Leaver), SSO, and role management |
| **ISPM** — Identity Security Posture Management | Continuously assess your identity security posture across 6 domains: MFA, least privilege, PAM, governance, service accounts, shadow IT |
| **ITDR** — Identity Threat Detection & Response | Detect and respond to identity-based attacks using MITRE ATT&CK framework |

### Key Capabilities
- **Application Discovery**: Automatically find managed and unmanaged (shadow IT) applications
- **Identity Graph**: Visualize relationships between users, roles, applications, and data
- **Risk Scoring**: AI-powered risk scores for every identity (0–100)
- **Toxic Combination Detection**: Find dangerous segregation-of-duties (SoD) violations
- **Access Certification**: Run quarterly access reviews with automated workflows
- **Audit Trail**: Tamper-proof log of every identity and access event

---

## 2. System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Admin Dashboard                        │
│              (Next.js / React 19 / port 3000)           │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTPS
┌──────────────────────▼──────────────────────────────────┐
│                   API Gateway                            │
│          (NestJS / JWT Auth / port 3001)                │
└──────────────────────┬──────────────────────────────────┘
                       │ NATS JetStream
     ┌─────────────────┼─────────────────┐
     ▼                 ▼                 ▼
Identity          Governance          Risk Engine
Service           Service             (+ ITDR)
(PostgreSQL)      (PostgreSQL)        (PostgreSQL)

     ▼                 ▼                 ▼
Discovery         Graph Service       Audit Service
Service           (Neo4j)             (PostgreSQL)

     ▼                 ▼
Policy Engine     Notification +
(PostgreSQL)      Worker Queue
                  (Redis)
```

---

## 3. Installation

### Prerequisites
- Docker 24+ and Docker Compose v2
- 8GB RAM, 4 CPU cores minimum
- Linux, macOS, or Windows (WSL2)

### Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/your-org/idmatr.git
cd idmatr

# 2. Create your environment file
cp .env.example .env

# 3. Generate strong secrets
echo "JWT_SECRET=$(openssl rand -base64 64)" >> .env.new
echo "POSTGRES_PASSWORD=$(openssl rand -base64 32 | tr -dc 'A-Za-z0-9' | head -c 32)" >> .env.new
echo "NEO4J_PASSWORD=$(openssl rand -base64 32 | tr -dc 'A-Za-z0-9' | head -c 32)" >> .env.new
# Edit .env and replace the placeholder values

# 4. Start the platform
docker compose up -d

# 5. Wait for all services to be healthy (~60 seconds)
docker compose ps

# 6. Initialize databases (first run only)
docker compose exec identity-service npx prisma migrate deploy
docker compose exec discovery-service npx prisma migrate deploy
docker compose exec governance-service npx prisma migrate deploy
docker compose exec risk-engine npx prisma migrate deploy
docker compose exec audit-service npx prisma migrate deploy

# 7. Open the dashboard
open http://localhost:3000
```

### Verifying Installation

```bash
# Check all services are healthy
docker compose ps --format "table {{.Name}}\t{{.Status}}"

# Test API Gateway
curl http://localhost:3001/api/health

# Check database connections
docker compose logs identity-service | grep "connected"
```

---

## 4. Configuring Identity Providers

### Accessing Settings
Navigate to **Settings** → **Identity Providers** in the sidebar.

### Microsoft Azure AD / Entra ID

1. Register an application in Azure Portal → App Registrations
2. Note the **Tenant ID** and **Client ID**
3. Create a client secret under **Certificates & Secrets**
4. Grant API permissions: `User.Read.All`, `Group.Read.All`, `Directory.Read.All`
5. In IDMatr Settings, enter:
   - Tenant ID: `<your-tenant-id>`
   - Client ID: `<your-client-id>`
   - Client Secret: `<your-client-secret>`
6. Click **Save** → **Sync Now**

### Google Workspace

1. Go to Google Cloud Console → APIs & Services → Credentials
2. Create OAuth 2.0 Client ID (Service Account)
3. Enable the Admin SDK API
4. Download the service account JSON key
5. In IDMatr Settings → Identity Providers → Google Workspace
6. Upload the JSON key file and enter your domain

### GitHub

1. Go to GitHub Settings → Developer Settings → Personal Access Tokens
2. Generate a token with scopes: `read:org`, `read:user`, `repo`
3. In IDMatr Settings, paste the token

---

## 5. Discovering Applications

### Running a Discovery Scan

1. Navigate to **Applications** in the sidebar
2. Click **+ Scan Now** in the top-right
3. Select connectors to scan (Microsoft 365, Google Workspace, GitHub, Slack)
4. Click **Start Discovery**

The scan will:
- Enumerate all applications from connected identity providers
- Detect OAuth integrations and third-party app grants
- Identify shadow IT (unmanaged applications)
- Classify applications by data sensitivity

### Understanding Discovery Results

| Status | Meaning | Action Required |
|--------|---------|-----------------|
| **Managed** | Known, approved application | None |
| **Unmanaged** | Discovered but not in inventory | Review and classify |
| **Shadow IT** | Unapproved, not sanctioned by IT | Investigate immediately |
| **Deprecated** | Marked for decommission | Plan migration |

### Shadow IT Detection

Applications appear as **Shadow IT** when they are:
- OAuth-connected by users without IT approval
- Not in the application inventory
- Connected via browser extensions or personal accounts

**To handle Shadow IT:**
1. Click on the application
2. Review which users have connected it
3. Choose: **Approve** (add to inventory) or **Block** (revoke access)

---

## 6. Analyzing Identity Risks

### Risk Score Interpretation

Every identity receives a risk score from 0 to 100:

| Score Range | Severity | Meaning |
|-------------|----------|---------|
| 80–100 | 🔴 Critical | Immediate action required |
| 60–79 | 🟠 High | Review within 24 hours |
| 40–59 | 🟡 Medium | Review within 1 week |
| 20–39 | 🟢 Low | Monitor |
| 0–19 | ⚪ Minimal | No action needed |

### Risk Factors

The risk engine considers:
- **Privilege level** — admin/super-admin accounts score higher
- **Dormancy** — accounts not used in 30+ days
- **MFA status** — accounts without MFA score higher
- **Excessive permissions** — roles with more access than job function requires
- **Recent violations** — policy violations in last 30 days
- **Anomalous behavior** — login from unusual locations/times

### Identity Graph Navigation

1. Navigate to **Identity Graph**
2. Click any node to see its connections
3. **Red nodes** = high-risk identities
4. **Red lines** = critical access paths (potential attack vectors)
5. Click **Toxic Permissions** tab to see SoD violations
6. Click **Attack Paths** tab to see potential lateral movement routes

---

## 7. Managing Access Governance

### Approval Workflows

When a user requests access:
1. Request appears in **Access Governance** → **Approval Workflows**
2. Reviewer sees: requester, resource, business justification, risk score
3. Click **Approve**, **Deny**, or **Escalate**
4. Notifications sent automatically via email/Slack

### Running Access Certifications

1. Navigate to **Access Governance** → **Certification Campaigns**
2. Click **+ New Campaign**
3. Set: campaign name, scope (all users / specific department), due date
4. Certifiers receive email with list of access to review
5. For each access item: **Certify** (keep) or **Revoke**
6. Track completion in the campaign progress bar

### Joiner / Mover / Leaver (JML) Lifecycle

**Joiner** (new employee):
1. HR system triggers IDMatr via API
2. Identity created with base role set
3. Manager approves additional access
4. Welcome email sent with access details

**Mover** (department change):
1. Old access automatically revoked
2. New role set applied
3. Approval workflow for exceptions

**Leaver** (employee exit):
1. Account immediately suspended
2. Access revoked across all connected applications
3. Data preserved for 90-day audit period
4. Final access report generated

---

## 8. Interpreting Dashboards

### Executive Dashboard
The main dashboard shows your organization's security posture at a glance:

- **Total Identities**: All managed users + service accounts
- **High-Risk**: Identities with risk score >60
- **Shadow IT Apps**: Unapproved applications in use
- **Pending Certifications**: Access reviews awaiting action
- **Risk Trend Chart**: 12-month risk score trend line
- **Security Posture Ring**: Overall ISPM score (0–100)
- **Active Alerts**: Critical security events requiring immediate response

### Risk Heatmap
The heatmap shows risk concentration by:
- **Rows**: User types (Admin, Developer, Finance, HR, etc.)
- **Columns**: Risk dimensions (Privilege, MFA, Access, Behavior)
- **Color intensity**: Higher = more risk

### Security Posture (ISPM)
Six domain scores make up the overall posture:

| Domain | What it measures |
|--------|-----------------|
| **Least Privilege** | Are users limited to only what they need? |
| **MFA Coverage** | What % of accounts have MFA enabled? |
| **PAM** | Privileged account management maturity |
| **Governance** | Access review completion rates |
| **Service Accounts** | Are non-human identities properly managed? |
| **Shadow IT** | How much unauthorized software is in use? |

---

## 9. ITDR — Threat Detection & Response

### Threat Categories

| Threat Type | MITRE Tactic | Severity |
|------------|--------------|----------|
| Privilege Escalation | T1068 | Critical |
| Impossible Travel | T1078 | Critical |
| Dormant Account Activation | T1098 | High |
| Credential Stuffing | T1110 | High |
| Excessive Permission Grant | T1134 | Medium |

### Responding to Threats

1. Navigate to **ITDR** → **Active Threats**
2. Click a threat card to expand IoC details
3. Review response steps in the playbook panel
4. Click **Investigate** → Opens the identity timeline
5. Choose a response action:
   - **Isolate**: Suspend the account immediately
   - **Revoke Access**: Remove all app access
   - **Reset Credentials**: Force password + MFA reset
   - **Escalate**: Send to SIEM/SOC team
   - **Mark Resolved**: Close the threat with notes

### MITRE ATT&CK Coverage

Navigate to **ITDR** → **MITRE Coverage** to see:
- Which ATT&CK tactics IDMatr can detect
- Coverage percentage per tactic
- Gap analysis for undetected techniques

---

## 10. Compliance Management

### Supported Frameworks
- **SOC 2 Type II** — Security, Availability, Confidentiality controls
- **ISO 27001** — Information security management
- **NIST CSF** — Cybersecurity framework (Identify, Protect, Detect, Respond, Recover)

### Compliance Dashboard

Navigate to **Compliance** to see:
- Overall compliance score per framework
- Control area breakdown (Identity, Access, Audit, Encryption)
- 6-month compliance trend chart
- Open policy violations requiring remediation

### Generating Compliance Evidence

For SOC 2 or ISO 27001 audits:
1. Navigate to **Audit Trail**
2. Set date range for audit period
3. Click **Export Audit** to download CSV
4. Filter by category (Authentication, Access Change, Policy)
5. Include in audit evidence package

---

*For technical support, see [Administrator Guide](ADMIN_GUIDE.md).*
*For API documentation, see the API reference at `http://localhost:3001/api/docs`.*
