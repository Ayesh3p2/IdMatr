-- Row Level Security (RLS) Policies for IDMatr
-- Ensures tenant isolation and data security

-- Enable RLS on all tenant-scoped tables
ALTER TABLE tenant_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE operator_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE identity_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE request_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_subject_requests ENABLE ROW LEVEL SECURITY;

-- Tenant isolation policies
CREATE POLICY tenant_isolation_tenant_users ON tenant_users
    FOR ALL TO authenticated_user
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY tenant_isolation_tenants ON tenants
    FOR ALL TO authenticated_user
    USING (id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY tenant_isolation_audit_logs ON operator_audit_logs
    FOR ALL TO authenticated_user
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY tenant_isolation_integrations ON tenant_integrations
    FOR ALL TO authenticated_user
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY tenant_isolation_identity_requests ON identity_requests
    FOR ALL TO authenticated_user
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY tenant_isolation_request_comments ON request_comments
    FOR ALL TO authenticated_user
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY tenant_isolation_onboarding_tokens ON onboarding_tokens
    FOR ALL TO authenticated_user
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY tenant_isolation_consent_records ON consent_records
    FOR ALL TO authenticated_user
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY tenant_isolation_data_subject_requests ON data_subject_requests
    FOR ALL TO authenticated_user
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Platform admin policies (can access all tenants)
CREATE POLICY platform_admin_access_tenant_users ON tenant_users
    FOR ALL TO platform_admin
    USING (true);

CREATE POLICY platform_admin_access_tenants ON tenants
    FOR ALL TO platform_admin
    USING (true);

CREATE POLICY platform_admin_access_audit_logs ON operator_audit_logs
    FOR ALL TO platform_admin
    USING (true);

-- Data protection constraints
ALTER TABLE tenant_users ADD CONSTRAINT check_email_format 
    CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

ALTER TABLE tenant_users ADD CONSTRAINT check_role_values 
    CHECK (role IN ('tenant_admin', 'tenant_user', 'analyst', 'viewer'));

ALTER TABLE tenant_users ADD CONSTRAINT check_status_values 
    CHECK (status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED'));

ALTER TABLE tenants ADD CONSTRAINT check_tenant_status 
    CHECK (status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED'));

ALTER TABLE identity_requests ADD CONSTRAINT check_request_status 
    CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'COMPLETED'));

ALTER TABLE identity_requests ADD CONSTRAINT check_request_type 
    CHECK (request_type IN ('ACCESS_REQUEST', 'ROLE_CHANGE', 'MFA_SETUP', 'ACCOUNT_RECOVERY'));

-- Security indexes for performance
CREATE INDEX idx_tenant_users_tenant_id ON tenant_users(tenant_id);
CREATE INDEX idx_tenant_users_email ON tenant_users(email);
CREATE INDEX idx_tenant_users_status ON tenant_users(status);
CREATE INDEX idx_audit_logs_tenant_id ON operator_audit_logs(tenant_id);
CREATE INDEX idx_audit_logs_created_at ON operator_audit_logs(created_at);
CREATE INDEX idx_identity_requests_tenant_id ON identity_requests(tenant_id);
CREATE INDEX idx_identity_requests_status ON identity_requests(status);
CREATE INDEX idx_onboarding_tokens_tenant_id ON onboarding_tokens(tenant_id);
CREATE INDEX idx_onboarding_tokens_token ON onboarding_tokens(token);

-- Unique constraints
ALTER TABLE tenant_users ADD CONSTRAINT unique_tenant_email 
    UNIQUE (tenant_id, email);

-- Data retention policies (optional)
-- CREATE POLICY data_retention_audit_logs ON operator_audit_logs
--     FOR DELETE TO authenticated_user
--     USING (created_at < NOW() - INTERVAL '2 years');

-- Grant permissions to application roles
GRANT USAGE ON SCHEMA public TO authenticated_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON tenant_users TO authenticated_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON tenants TO authenticated_user;
GRANT SELECT, INSERT, UPDATE ON operator_audit_logs TO authenticated_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON tenant_integrations TO authenticated_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON identity_requests TO authenticated_user;
GRANT SELECT, INSERT, DELETE ON request_comments TO authenticated_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON onboarding_tokens TO authenticated_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON consent_records TO authenticated_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON data_subject_requests TO authenticated_user;

-- Platform admin permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO platform_admin;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO platform_admin;
