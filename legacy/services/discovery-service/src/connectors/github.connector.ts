import { Injectable, Logger } from '@nestjs/common';

export interface GitHubDiscoveredIdentity {
  email: string;
  name: string;
  externalId: string;
  app: string;
  permissions: string[];
  isAdmin: boolean;
  status: string;
}

/**
 * GitHub connector — discovers organisation members and their roles.
 *
 * Required env vars:
 *   GITHUB_TOKEN — Personal access token or GitHub App token
 *                  Scopes required: read:org, read:user, user:email
 *   GITHUB_ORG   — GitHub organisation login (e.g. "my-company")
 */
@Injectable()
export class GitHubConnector {
  private readonly logger = new Logger(GitHubConnector.name);

  isConfigured(): boolean {
    return !!(process.env.GITHUB_TOKEN && process.env.GITHUB_ORG);
  }

  async scan(): Promise<GitHubDiscoveredIdentity[]> {
    if (!this.isConfigured()) {
      this.logger.warn(
        'GitHub connector not configured. ' +
          'Set GITHUB_TOKEN and GITHUB_ORG to enable it.'
      );
      return [];
    }

    const org = process.env.GITHUB_ORG!;
    this.logger.log(`Starting GitHub scan for organisation: ${org}`);

    try {
      const members = await this.listOrgMembers(org);
      const adminLogins = await this.getOrgAdmins(org);

      return members.map((m: any) => ({
        email: m.email || `${m.login}@github`,
        name: m.name || m.login,
        externalId: String(m.id),
        app: 'GitHub',
        permissions: this.mapPermissions(m.login, adminLogins),
        isAdmin: adminLogins.has(m.login),
        status: 'active',
      }));
    } catch (err) {
      this.logger.error(`GitHub scan failed: ${(err as Error).message}`);
      throw err;
    }
  }

  private async listOrgMembers(org: string): Promise<any[]> {
    const allMembers: any[] = [];
    let page = 1;

    while (true) {
      const res = await fetch(
        `https://api.github.com/orgs/${org}/members?per_page=100&page=${page}`,
        { headers: this.headers() }
      );

      if (!res.ok) {
        throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
      }

      const members = (await res.json()) as any[];
      if (!members.length) break;

      // Fetch detailed user info for email
      const detailed = await Promise.all(
        members.map((m) => this.getUserDetail(m.login))
      );
      allMembers.push(...detailed);
      page++;
    }

    return allMembers;
  }

  private async getUserDetail(login: string): Promise<any> {
    try {
      const res = await fetch(`https://api.github.com/users/${login}`, {
        headers: this.headers(),
      });
      return await res.json();
    } catch {
      return { login };
    }
  }

  private async getOrgAdmins(org: string): Promise<Set<string>> {
    const admins = new Set<string>();
    try {
      let page = 1;
      while (true) {
        const res = await fetch(
          `https://api.github.com/orgs/${org}/members?role=admin&per_page=100&page=${page}`,
          { headers: this.headers() }
        );
        const members = (await res.json()) as any[];
        if (!members.length) break;
        members.forEach((m: any) => admins.add(m.login));
        page++;
      }
    } catch {
      this.logger.warn('Could not fetch GitHub org admins');
    }
    return admins;
  }

  private headers() {
    return {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };
  }

  private mapPermissions(login: string, adminLogins: Set<string>): string[] {
    return adminLogins.has(login) ? ['Owner'] : ['Member'];
  }
}
