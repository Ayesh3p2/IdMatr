import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';

// Lazy import to avoid startup failure when googleapis is not installed
let google: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  google = require('googleapis').google;
} catch {
  // Not installed — connector will throw a clear error at scan time
}

export interface DiscoveredIdentity {
  email: string;
  name: string;
  externalId: string;
  app: string;
  permissions: string[];
  isAdmin: boolean;
  lastActivity: Date | null;
  status: string;
  orgUnit: string;
}

@Injectable()
export class GoogleConnector {
  private readonly logger = new Logger(GoogleConnector.name);

  /** Returns true when all required env vars are set */
  isConfigured(): boolean {
    return !!(
      process.env.GOOGLE_SERVICE_ACCOUNT_KEY &&
      process.env.GOOGLE_ADMIN_EMAIL &&
      process.env.GOOGLE_DOMAIN
    );
  }

  /**
   * Build a Google JWT auth client using a service account with
   * domain-wide delegation enabled.
   *
   * GOOGLE_SERVICE_ACCOUNT_KEY — path to a .json key file OR the raw JSON string
   * GOOGLE_ADMIN_EMAIL         — super-admin email to impersonate
   */
  private getAuth(scopes: string[]) {
    if (!google) {
      throw new Error(
        'googleapis package is not installed. Run: npm install googleapis'
      );
    }

    const keyEnv = process.env.GOOGLE_SERVICE_ACCOUNT_KEY!;
    const adminEmail = process.env.GOOGLE_ADMIN_EMAIL!;

    let key: Record<string, string>;
    // Support both a file path and an inline JSON string
    if (keyEnv.trimStart().startsWith('{')) {
      key = JSON.parse(keyEnv);
    } else {
      const resolved = keyEnv.startsWith('/')
        ? keyEnv
        : `${process.cwd()}/${keyEnv}`;
      key = JSON.parse(fs.readFileSync(resolved, 'utf-8'));
    }

    return new google.auth.JWT({
      email: key['client_email'],
      key: key['private_key'],
      scopes,
      subject: adminEmail, // domain-wide delegation
    });
  }

  /**
   * Scan Google Workspace and return discovered identities + app metadata.
   */
  async scan(): Promise<DiscoveredIdentity[]> {
    if (!this.isConfigured()) {
      this.logger.warn(
        'Google Workspace connector not configured. ' +
          'Set GOOGLE_SERVICE_ACCOUNT_KEY, GOOGLE_ADMIN_EMAIL, GOOGLE_DOMAIN to enable it.'
      );
      return [];
    }

    this.logger.log(
      `Starting Google Workspace scan for domain: ${process.env.GOOGLE_DOMAIN}`
    );

    const auth = this.getAuth([
      'https://www.googleapis.com/auth/admin.directory.user.readonly',
      'https://www.googleapis.com/auth/admin.directory.group.readonly',
    ]);

    const admin = google.admin({ version: 'directory_v1', auth });
    const domain = process.env.GOOGLE_DOMAIN!;

    // ── Fetch all users ────────────────────────────────────────────────
    const allUsers: any[] = [];
    let pageToken: string | undefined;

    do {
      const resp = await admin.users.list({
        domain,
        maxResults: 500,
        projection: 'full',
        orderBy: 'email',
        pageToken,
      });
      allUsers.push(...(resp.data.users || []));
      pageToken = resp.data.nextPageToken || undefined;
    } while (pageToken);

    this.logger.log(`Discovered ${allUsers.length} users in Google Workspace`);

    // Build a set of admin emails for fast lookup
    const adminEmails = new Set<string>(
      allUsers
        .filter((u) => u.isAdmin || u.isDelegatedAdmin)
        .map((u) => u.primaryEmail as string)
    );

    // ── Map to internal format ─────────────────────────────────────────
    const results: DiscoveredIdentity[] = allUsers.map((user) => ({
      email: user.primaryEmail,
      name: user.name?.fullName || user.primaryEmail,
      externalId: user.id,
      app: 'Google Workspace',
      permissions: this.mapPermissions(user),
      isAdmin: adminEmails.has(user.primaryEmail),
      lastActivity: user.lastLoginTime ? new Date(user.lastLoginTime) : null,
      status: user.suspended ? 'inactive' : 'active',
      orgUnit: user.orgUnitPath || '/',
    }));

    return results;
  }

  /**
   * Fetch the list of OAuth-authorised third-party applications
   * for the domain (requires Reports API scope).
   */
  async discoverOAuthApps(): Promise<string[]> {
    if (!this.isConfigured()) return [];

    try {
      const auth = this.getAuth([
        'https://www.googleapis.com/auth/admin.reports.audit.readonly',
      ]);
      const reports = google.admin({ version: 'reports_v1', auth });

      const yesterday = new Date(Date.now() - 86_400_000)
        .toISOString()
        .slice(0, 10);

      const resp = await reports.activities.list({
        userKey: 'all',
        applicationName: 'token',
        startTime: `${yesterday}T00:00:00.000Z`,
        maxResults: 1000,
      });

      const apps = new Set<string>();
      for (const event of resp.data.items || []) {
        for (const e of event.events || []) {
          const appName = e.parameters?.find(
            (p: any) => p.name === 'app_name'
          )?.value;
          if (appName) apps.add(appName);
        }
      }

      return Array.from(apps);
    } catch (err) {
      this.logger.warn(`Reports API unavailable: ${(err as Error).message}`);
      return [];
    }
  }

  /** Map raw Google user object to permission labels */
  private mapPermissions(user: any): string[] {
    const perms: string[] = [];
    if (user.isAdmin) perms.push('Super Admin');
    if (user.isDelegatedAdmin) perms.push('Delegated Admin');
    if (user.isMailboxSetup) perms.push('Gmail.Access');
    if (user.aliases?.length > 0) perms.push('Gmail.Aliases');
    if (!user.isAdmin && !user.isDelegatedAdmin) perms.push('User');
    return perms.length ? perms : ['User'];
  }
}
