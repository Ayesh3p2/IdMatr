export interface GoogleServiceAccountKey {
  client_email: string;
  private_key: string;
  project_id?: string;
}

export interface GoogleIntegrationConfig {
  serviceAccountKey: GoogleServiceAccountKey;
  adminEmail: string;
  domain: string;
}

export interface GoogleSyncedUser {
  externalId: string;
  primaryEmail: string;
  fullName: string | null;
  orgUnitPath: string | null;
  roleNames: string[];
  lastLoginAt: Date | null;
  suspended: boolean;
  archived: boolean;
  isAdmin: boolean;
  isDelegatedAdmin: boolean;
  sourceStatus: string;
  rawProfile: Record<string, unknown>;
}

export interface GoogleSyncedGroup {
  externalId: string;
  email: string;
  name: string;
  description: string | null;
  directMembersCount: number;
  rawProfile: Record<string, unknown>;
}

export interface GoogleSyncedMembership {
  groupExternalId: string;
  memberExternalId: string;
  memberEmail: string | null;
  memberType: string;
  role: string;
  rawProfile: Record<string, unknown>;
}

export interface GoogleSyncedRoleAssignment {
  userExternalId: string;
  roleNames: string[];
  isAdmin: boolean;
  isDelegatedAdmin: boolean;
  lastLoginAt: Date | null;
}
