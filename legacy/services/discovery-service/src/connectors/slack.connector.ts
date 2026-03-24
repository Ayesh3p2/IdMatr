import { Injectable, Logger } from '@nestjs/common';

export interface SlackDiscoveredIdentity {
  email: string;
  name: string;
  externalId: string;
  app: string;
  permissions: string[];
  isAdmin: boolean;
  status: string;
}

/**
 * Slack connector — discovers workspace members and their roles.
 *
 * Required env vars:
 *   SLACK_TOKEN — Bot/user OAuth token with scopes:
 *                 users:read, users:read.email, admin.users:read
 */
@Injectable()
export class SlackConnector {
  private readonly logger = new Logger(SlackConnector.name);

  isConfigured(): boolean {
    return !!process.env.SLACK_TOKEN;
  }

  async scan(): Promise<SlackDiscoveredIdentity[]> {
    if (!this.isConfigured()) {
      this.logger.warn(
        'Slack connector not configured. Set SLACK_TOKEN to enable it.'
      );
      return [];
    }

    this.logger.log('Starting Slack workspace scan...');

    try {
      const members = await this.listMembers();
      return members
        .filter((m: any) => !m.is_bot && !m.deleted && m.id !== 'USLACKBOT')
        .map((m: any) => ({
          email: m.profile?.email || '',
          name: m.real_name || m.name,
          externalId: m.id,
          app: 'Slack',
          permissions: this.mapPermissions(m),
          isAdmin: !!(m.is_admin || m.is_owner),
          status: m.deleted ? 'inactive' : 'active',
        }));
    } catch (err) {
      this.logger.error(`Slack scan failed: ${(err as Error).message}`);
      throw err;
    }
  }

  private async listMembers(): Promise<any[]> {
    const allMembers: any[] = [];
    let cursor: string | undefined;

    do {
      const params = new URLSearchParams({ limit: '200' });
      if (cursor) params.set('cursor', cursor);

      const res = await fetch(
        `https://slack.com/api/users.list?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.SLACK_TOKEN}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const data = (await res.json()) as {
        ok: boolean;
        members: any[];
        response_metadata?: { next_cursor: string };
        error?: string;
      };

      if (!data.ok) {
        throw new Error(`Slack API error: ${data.error}`);
      }

      allMembers.push(...(data.members || []));
      cursor = data.response_metadata?.next_cursor || undefined;
    } while (cursor);

    return allMembers;
  }

  private mapPermissions(member: any): string[] {
    const perms: string[] = [];
    if (member.is_owner) perms.push('Workspace Owner');
    if (member.is_admin) perms.push('Admin');
    if (member.is_restricted) perms.push('Guest');
    if (!perms.length) perms.push('Member');
    return perms;
  }
}
