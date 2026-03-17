import { Injectable, Logger } from '@nestjs/common';

export interface MsDiscoveredIdentity {
  email: string;
  name: string;
  externalId: string;
  app: string;
  permissions: string[];
  isAdmin: boolean;
  lastActivity: Date | null;
  status: string;
}

/**
 * Microsoft 365 / Azure AD connector.
 *
 * Required env vars:
 *   MS365_TENANT_ID      — Azure AD tenant ID
 *   MS365_CLIENT_ID      — App registration client ID
 *   MS365_CLIENT_SECRET  — App registration client secret
 *
 * Required Microsoft Graph API permissions (Application):
 *   User.Read.All, Group.Read.All, Directory.Read.All, AuditLog.Read.All
 */
@Injectable()
export class MicrosoftConnector {
  private readonly logger = new Logger(MicrosoftConnector.name);

  isConfigured(): boolean {
    return !!(
      process.env.MS365_TENANT_ID &&
      process.env.MS365_CLIENT_ID &&
      process.env.MS365_CLIENT_SECRET
    );
  }

  async scan(): Promise<MsDiscoveredIdentity[]> {
    if (!this.isConfigured()) {
      this.logger.warn(
        'Microsoft 365 connector not configured. ' +
          'Set MS365_TENANT_ID, MS365_CLIENT_ID, MS365_CLIENT_SECRET to enable it.'
      );
      return [];
    }

    this.logger.log('Starting Microsoft 365 / Azure AD scan...');

    try {
      const token = await this.getAccessToken();
      const users = await this.listUsers(token);
      const adminIds = await this.getGlobalAdminIds(token);

      return users.map((user: any) => ({
        email: user.userPrincipalName,
        name: user.displayName,
        externalId: user.id,
        app: 'Microsoft 365',
        permissions: this.mapPermissions(user, adminIds),
        isAdmin: adminIds.has(user.id),
        lastActivity: user.signInActivity?.lastSignInDateTime
          ? new Date(user.signInActivity.lastSignInDateTime)
          : null,
        status: user.accountEnabled ? 'active' : 'inactive',
      }));
    } catch (err) {
      this.logger.error(`Microsoft 365 scan failed: ${(err as Error).message}`);
      throw err;
    }
  }

  private async getAccessToken(): Promise<string> {
    const { MS365_TENANT_ID, MS365_CLIENT_ID, MS365_CLIENT_SECRET } =
      process.env;

    const url = `https://login.microsoftonline.com/${MS365_TENANT_ID}/oauth2/v2.0/token`;
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: MS365_CLIENT_ID!,
      client_secret: MS365_CLIENT_SECRET!,
      scope: 'https://graph.microsoft.com/.default',
    });

    const res = await fetch(url, {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    if (!res.ok) {
      throw new Error(`Token request failed: ${res.status} ${res.statusText}`);
    }

    const data = (await res.json()) as { access_token: string };
    return data.access_token;
  }

  private async listUsers(token: string): Promise<any[]> {
    const allUsers: any[] = [];
    let url =
      'https://graph.microsoft.com/v1.0/users?' +
      '$select=id,displayName,userPrincipalName,accountEnabled,signInActivity' +
      '&$top=999';

    while (url) {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        throw new Error(`Users list failed: ${res.status}`);
      }
      const data = (await res.json()) as {
        value: any[];
        '@odata.nextLink': string;
      };
      allUsers.push(...(data.value || []));
      url = data['@odata.nextLink'] || '';
    }

    return allUsers;
  }

  private async getGlobalAdminIds(token: string): Promise<Set<string>> {
    const ids = new Set<string>();
    try {
      // Well-known template ID for Global Administrator role
      const roleUrl =
        'https://graph.microsoft.com/v1.0/directoryRoles?' +
        "$filter=roleTemplateId eq '62e90394-69f5-4237-9190-012177145e10'";
      const roleRes = await fetch(roleUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const roleData = (await roleRes.json()) as { value: any[] };
      const roleId = roleData.value?.[0]?.id;

      if (roleId) {
        const membersRes = await fetch(
          `https://graph.microsoft.com/v1.0/directoryRoles/${roleId}/members`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const members = (await membersRes.json()) as { value: any[] };
        (members.value || []).forEach((m: any) => ids.add(m.id));
      }
    } catch {
      this.logger.warn('Could not fetch Global Admin role members');
    }
    return ids;
  }

  private mapPermissions(user: any, adminIds: Set<string>): string[] {
    const perms: string[] = [];
    if (adminIds.has(user.id)) perms.push('Global Admin');
    if (!perms.length) perms.push('User');
    return perms;
  }
}
