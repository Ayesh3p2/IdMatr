import { Injectable } from '@nestjs/common';
import { IntegrationProvider } from '@prisma/client';
import { google, admin_directory_v1 } from 'googleapis';
import {
  DeprovisionMemberInput,
  IntegrationProviderService,
  ProvisionMemberInput,
  ProviderHealthResult,
  SyncPermissionsResult,
  SyncUsersResult,
} from '../integration-provider.interface';
import {
  GoogleIntegrationConfig,
  GoogleSyncedGroup,
  GoogleSyncedMembership,
  GoogleSyncedRoleAssignment,
  GoogleSyncedUser,
} from './google.types';

const GOOGLE_DIRECTORY_SCOPES = [
  'https://www.googleapis.com/auth/admin.directory.user.readonly',
  'https://www.googleapis.com/auth/admin.directory.group.readonly',
  'https://www.googleapis.com/auth/admin.directory.group.member',
  'https://www.googleapis.com/auth/admin.directory.rolemanagement.readonly',
] as const;

@Injectable()
export class GoogleIntegrationService
  implements
    IntegrationProviderService<
      GoogleIntegrationConfig,
      GoogleSyncedUser,
      GoogleSyncedGroup,
      GoogleSyncedMembership
    >
{
  readonly provider = IntegrationProvider.GOOGLE;
  readonly scopes = [...GOOGLE_DIRECTORY_SCOPES];

  async connect(config: GoogleIntegrationConfig): Promise<ProviderHealthResult> {
    return this.healthCheck(config);
  }

  async healthCheck(config: GoogleIntegrationConfig): Promise<ProviderHealthResult> {
    const directory = this.createDirectoryClient(config);

    await directory.users.list({
      domain: config.domain,
      maxResults: 1,
      orderBy: 'email',
      projection: 'full',
    });

    return {
      reachable: true,
      detail: `Connected to Google Workspace for ${config.domain}`,
    };
  }

  async syncUsers(config: GoogleIntegrationConfig): Promise<SyncUsersResult<GoogleSyncedUser>> {
    const directory = this.createDirectoryClient(config);
    const [roleMap, assignments] = await Promise.all([
      this.fetchRoleMap(directory),
      this.fetchRoleAssignments(directory),
    ]);

    const roleNamesByUserId = new Map<string, string[]>();
    for (const assignment of assignments) {
      const assigneeId = assignment.assignedTo;
      if (!assigneeId) {
        continue;
      }

      const currentRoles = roleNamesByUserId.get(assigneeId) ?? [];
      const roleName = roleMap.get(String(assignment.roleId));
      if (roleName && !currentRoles.includes(roleName)) {
        currentRoles.push(roleName);
      }
      roleNamesByUserId.set(assigneeId, currentRoles);
    }

    const users = await this.paginate<admin_directory_v1.Schema$User>(async (pageToken) => {
      const response = await directory.users.list({
        domain: config.domain,
        orderBy: 'email',
        maxResults: 500,
        pageToken,
        projection: 'full',
      });

      return {
        items: response.data.users ?? [],
        nextPageToken: response.data.nextPageToken ?? undefined,
      };
    });

    return {
      users: users
        .filter((user) => !!user.id && !!user.primaryEmail)
        .map((user) => ({
          externalId: String(user.id),
          primaryEmail: String(user.primaryEmail).toLowerCase(),
          fullName: user.name?.fullName ?? null,
          orgUnitPath: user.orgUnitPath ?? null,
          roleNames: roleNamesByUserId.get(String(user.id)) ?? [],
          lastLoginAt: this.parseGoogleDate(user.lastLoginTime),
          suspended: Boolean(user.suspended),
          archived: Boolean((user as { archived?: boolean }).archived),
          isAdmin: Boolean(user.isAdmin),
          isDelegatedAdmin: Boolean(user.isDelegatedAdmin),
          sourceStatus: Boolean(user.suspended) ? 'SUSPENDED' : 'ACTIVE',
          rawProfile: user as Record<string, unknown>,
        })),
    };
  }

  async syncPermissions(
    config: GoogleIntegrationConfig,
  ): Promise<SyncPermissionsResult<GoogleSyncedGroup, GoogleSyncedMembership>> {
    const directory = this.createDirectoryClient(config);
    const groups = await this.paginate<admin_directory_v1.Schema$Group>(async (pageToken) => {
      const response = await directory.groups.list({
        domain: config.domain,
        maxResults: 200,
        pageToken,
      });

      return {
        items: response.data.groups ?? [],
        nextPageToken: response.data.nextPageToken ?? undefined,
      };
    });

    const syncedGroups: GoogleSyncedGroup[] = [];
    const syncedMemberships: GoogleSyncedMembership[] = [];

    for (const group of groups) {
      if (!group.id || !group.email || !group.name) {
        continue;
      }

      const memberships = await this.paginate<admin_directory_v1.Schema$Member>(async (pageToken) => {
        const response = await directory.members.list({
          groupKey: String(group.id),
          maxResults: 200,
          pageToken,
        });

        return {
          items: response.data.members ?? [],
          nextPageToken: response.data.nextPageToken ?? undefined,
        };
      });

      syncedGroups.push({
        externalId: String(group.id),
        email: String(group.email).toLowerCase(),
        name: String(group.name),
        description: group.description ?? null,
        directMembersCount: memberships.length,
        rawProfile: group as Record<string, unknown>,
      });

      for (const member of memberships) {
        if (!member.id) {
          continue;
        }

        syncedMemberships.push({
          groupExternalId: String(group.id),
          memberExternalId: String(member.id),
          memberEmail: member.email?.toLowerCase() ?? null,
          memberType: member.type ?? 'USER',
          role: member.role ?? 'MEMBER',
          rawProfile: member as Record<string, unknown>,
        });
      }
    }

    return {
      groups: syncedGroups,
      memberships: syncedMemberships,
    };
  }

  async syncRoles(config: GoogleIntegrationConfig) {
    const directory = this.createDirectoryClient(config);
    const [roleMap, assignments, users] = await Promise.all([
      this.fetchRoleMap(directory),
      this.fetchRoleAssignments(directory),
      this.paginate<admin_directory_v1.Schema$User>(async (pageToken) => {
        const response = await directory.users.list({
          domain: config.domain,
          orderBy: 'email',
          maxResults: 500,
          pageToken,
          projection: 'full',
        });

        return {
          items: response.data.users ?? [],
          nextPageToken: response.data.nextPageToken ?? undefined,
        };
      }),
    ]);

    const roleNamesByUserId = new Map<string, string[]>();
    for (const assignment of assignments) {
      const assigneeId = assignment.assignedTo;
      if (!assigneeId) {
        continue;
      }

      const roleName = roleMap.get(String(assignment.roleId));
      if (!roleName) {
        continue;
      }

      const currentRoles = roleNamesByUserId.get(assigneeId) ?? [];
      if (!currentRoles.includes(roleName)) {
        currentRoles.push(roleName);
      }
      roleNamesByUserId.set(assigneeId, currentRoles);
    }

    const assignmentsByUser: GoogleSyncedRoleAssignment[] = users
      .filter((user) => !!user.id)
      .map((user) => ({
        userExternalId: String(user.id),
        roleNames: roleNamesByUserId.get(String(user.id)) ?? [],
        isAdmin: Boolean(user.isAdmin),
        isDelegatedAdmin: Boolean(user.isDelegatedAdmin),
        lastLoginAt: this.parseGoogleDate(user.lastLoginTime),
      }));

    return {
      assignments: assignmentsByUser,
    };
  }

  async addGroupMember(config: GoogleIntegrationConfig, input: ProvisionMemberInput) {
    const directory = this.createDirectoryClient(config);
    await directory.members.insert({
      groupKey: input.groupExternalId,
      requestBody: {
        email: input.memberEmail,
        role: input.role,
      },
    });
  }

  async removeGroupMember(config: GoogleIntegrationConfig, input: DeprovisionMemberInput) {
    const directory = this.createDirectoryClient(config);
    await directory.members.delete({
      groupKey: input.groupExternalId,
      memberKey: input.memberKey,
    });
  }

  private createDirectoryClient(config: GoogleIntegrationConfig) {
    const auth = new google.auth.JWT({
      email: config.serviceAccountKey.client_email,
      key: config.serviceAccountKey.private_key.replace(/\\n/g, '\n'),
      scopes: this.scopes,
      subject: config.adminEmail,
    });

    return google.admin({
      version: 'directory_v1',
      auth,
    });
  }

  private async fetchRoleMap(directory: admin_directory_v1.Admin) {
    const roles = await this.paginate<admin_directory_v1.Schema$Role>(async (pageToken) => {
      const response = await directory.roles.list({
        customer: 'my_customer',
        maxResults: 200,
        pageToken,
      });

      return {
        items: response.data.items ?? [],
        nextPageToken: response.data.nextPageToken ?? undefined,
      };
    });

    return new Map(
      roles
        .filter((role) => role.roleId && role.roleName)
        .map((role) => [String(role.roleId), String(role.roleName)]),
    );
  }

  private async fetchRoleAssignments(directory: admin_directory_v1.Admin) {
    return this.paginate<admin_directory_v1.Schema$RoleAssignment>(async (pageToken) => {
      const response = await directory.roleAssignments.list({
        customer: 'my_customer',
        maxResults: 200,
        pageToken,
      });

      return {
        items: response.data.items ?? [],
        nextPageToken: response.data.nextPageToken ?? undefined,
      };
    });
  }

  private async paginate<T>(
    fetchPage: (pageToken?: string) => Promise<{ items: T[]; nextPageToken?: string }>,
  ) {
    const items: T[] = [];
    let pageToken: string | undefined;

    do {
      const page = await fetchPage(pageToken);
      items.push(...page.items);
      pageToken = page.nextPageToken;
    } while (pageToken);

    return items;
  }

  private parseGoogleDate(value?: string | null) {
    if (!value) {
      return null;
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
}
