/**
 * Default values for each settings category.
 * Returned when no persisted settings exist for a given context.
 */

export const DEFAULT_GENERAL = {
  orgName: 'My Organization',
  adminEmail: '',
  timezone: 'UTC',
  sessionTimeoutMinutes: 60,
  demoMode: false,
  autoDiscovery: true,
  aiRiskAnalysis: true,
  realtimeAlerts: true,
  auditEverything: false,
  maintenanceMode: false,
};

export const DEFAULT_SECURITY = {
  mfaForAll: false,
  mfaForPrivileged: true,
  ssoRequired: false,
  passwordlessAuth: false,
  ipAllowlist: false,
  ipAllowlistCidrs: [] as string[],
  maxRolesPerUser: 10,
  accessReviewFrequencyDays: 90,
  orphanedAccountGracePeriodDays: 30,
  privilegedSessionDurationHours: 8,
  failedLoginLockoutThreshold: 5,
};

export const DEFAULT_RISK = {
  criticalThreshold: 80,
  highThreshold: 60,
  mediumThreshold: 40,
  lowThreshold: 20,
  autoDisableAboveCritical: false,
  autoRevokeOrphanedDays: 90,
  autoEscalateToSiem: false,
  triggerReviewOnRiskIncrease: true,
  autoBlockImpossibleTravel: false,
};

export const DEFAULT_NOTIFICATIONS = {
  smtpHost: '',
  smtpPort: 587,
  smtpUsername: '',
  // smtpPassword intentionally not stored here — handled separately
  smtpPasswordSet: false,
  fromAddress: '',
  slackWebhookUrl: '',
  alertWebhookUrl: '',
  alertRules: {
    criticalThreat:    { email: true,  slack: true  },
    highRiskIdentity:  { email: true,  slack: false },
    shadowItApp:       { email: true,  slack: false },
    certificationDue:  { email: true,  slack: false },
    approvalPending:   { email: true,  slack: false },
    weeklyDigest:      { email: false, slack: false },
  },
};

export const DEFAULT_DISCOVERY = {
  scheduleEnabled: true,
  cronExpression: '0 2 * * *',
  maxIdentitiesPerScan: 10000,
  maxAppsPerScan: 5000,
  includeServiceAccounts: true,
  deduplicateIdentities: true,
  scanSources: ['GOOGLE_WORKSPACE', 'MICROSOFT_365', 'GITHUB', 'SLACK'],
};

export const DEFAULT_INTEGRATIONS = {
  GOOGLE_WORKSPACE: { enabled: false, configured: false, clientId: '', domain: '' },
  MICROSOFT_365:    { enabled: false, configured: false, tenantId: '', clientId: '' },
  OKTA:             { enabled: false, configured: false, domain: '', clientId: '' },
  GITHUB:           { enabled: false, configured: false, org: '' },
  SLACK:            { enabled: false, configured: false, workspaceId: '' },
  AZURE_AD:         { enabled: false, configured: false, tenantId: '', clientId: '' },
};

export type SettingsCategory = 'general' | 'security' | 'risk' | 'notifications' | 'discovery' | 'integrations';

export const CATEGORY_DEFAULTS: Record<SettingsCategory, object> = {
  general:       DEFAULT_GENERAL,
  security:      DEFAULT_SECURITY,
  risk:          DEFAULT_RISK,
  notifications: DEFAULT_NOTIFICATIONS,
  discovery:     DEFAULT_DISCOVERY,
  integrations:  DEFAULT_INTEGRATIONS,
};
