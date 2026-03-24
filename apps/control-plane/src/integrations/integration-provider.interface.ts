import { IntegrationProvider } from '@prisma/client';

export interface ProviderHealthResult {
  reachable: boolean;
  detail?: string;
}

export interface SyncUsersResult<TUser> {
  users: TUser[];
}

export interface SyncPermissionsResult<TGroup, TMembership> {
  groups: TGroup[];
  memberships: TMembership[];
}

export interface ProvisionMemberInput {
  groupExternalId: string;
  memberEmail: string;
  role: string;
}

export interface DeprovisionMemberInput {
  groupExternalId: string;
  memberKey: string;
}

export interface IntegrationProviderService<TConfig, TUser, TGroup, TMembership> {
  readonly provider: IntegrationProvider;
  connect(config: TConfig): Promise<ProviderHealthResult>;
  healthCheck(config: TConfig): Promise<ProviderHealthResult>;
  syncUsers(config: TConfig): Promise<SyncUsersResult<TUser>>;
  syncPermissions(config: TConfig): Promise<SyncPermissionsResult<TGroup, TMembership>>;
  addGroupMember?(config: TConfig, input: ProvisionMemberInput): Promise<void>;
  removeGroupMember?(config: TConfig, input: DeprovisionMemberInput): Promise<void>;
}
