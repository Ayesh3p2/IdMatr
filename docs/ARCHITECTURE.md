# IDMatr Architecture

## Runtime Shape

```text
Client
  |
  v
NestJS Monolith
  |
  v
PostgreSQL
```

The platform is intentionally monolith-first, but the integration layer is provider-oriented so new SaaS connectors can be added without restoring distributed complexity.

## Active Backend Modules

```text
src/
  auth/
  users/
  tenants/
  invites/
  mfa/
  rbac/
  iam/
  iga/
  ivip/
  ispm/
  itdr/
  integrations/
    google/
    microsoft/
    slack/
    github/
```

## Real Identity Data Model

- `TenantUser`: local application users for auth and RBAC
- `Integration`: encrypted connector configuration and sync state
- `ExternalIdentity`: synced Google users
- `ExternalGroup`: synced Google groups
- `ExternalGroupMembership`: synced Google group memberships
- `AccessReview`: governance records over real memberships
- `IdentityRequest`: provisioning requests against real groups and identities
- `AuditEvent`: operational and detection events

## Integration Framework

Each provider follows the same contract:

- `connect()`
- `syncUsers()`
- `syncPermissions()`
- `healthCheck()`

Google also supports membership add/remove so governance and provisioning can apply real changes.

## Google Workspace Flow

### Sync Users

- Uses Google Admin SDK Directory `users.list`
- Stores email, full name, admin roles, org unit, last login, and status
- Maps synced identities to local tenant users by email

### Sync Groups

- Uses `groups.list` and `members.list`
- Stores groups plus membership role data (`OWNER`, `MANAGER`, `MEMBER`)

### Security

- Service account JSON is encrypted at rest before being stored
- Domain-wide delegation is required
- Tenant boundaries are enforced in every query and mutation path

## Module Behavior

### IAM

- Local auth users
- External identity mapping

### IGA

- Access reviews over real Google group memberships
- Approval keeps access
- Revoke removes the membership in Google

### IVIP

- Access requests target real Google groups
- Approval adds the membership in Google

### ISPM

- Connected apps come from real integrations
- User count, permission types, and risk indicators come from synced data

### ITDR

- Detects inactive synced users
- Detects high-privilege synced users
- Writes audit events from those detections
