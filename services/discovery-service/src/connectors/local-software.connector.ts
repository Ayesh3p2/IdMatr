import { Injectable, Logger } from '@nestjs/common';

export interface LocalSoftwareRecord {
  deviceId: string;
  hostname: string;
  software: string;
  version: string;
  publisher: string;
  installedDate: Date;
  users: string[];
  isManagedByIT: boolean;
}

@Injectable()
export class LocalSoftwareConnector {
  private readonly logger = new Logger(LocalSoftwareConnector.name);

  async scan() {
    this.logger.log('Scanning local software telemetry...');
    // In production: integrate with MDM solutions (Jamf, Intune, etc.)
    // or collect telemetry from endpoint agents.
    // Data sources:
    //   - macOS: system_profiler SPApplicationsDataType
    //   - Windows: HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall
    //   - Linux: dpkg --list or rpm -qa
    //   - MDM APIs: Jamf Pro API, Microsoft Intune API
    // For now, returns simulated endpoint telemetry.
    const shadowItApps = [
      { name: 'Dropbox', publisher: 'Dropbox Inc.', riskLevel: 'high', shadowIt: true },
      { name: 'Notion', publisher: 'Notion Labs Inc.', riskLevel: 'medium', shadowIt: true },
      { name: 'Zoom', publisher: 'Zoom Video Communications', riskLevel: 'low', shadowIt: false },
      { name: 'Grammarly', publisher: 'Grammarly Inc.', riskLevel: 'medium', shadowIt: true },
      { name: 'LastPass', publisher: 'LastPass', riskLevel: 'high', shadowIt: true },
      { name: '1Password', publisher: 'AgileBits Inc.', riskLevel: 'low', shadowIt: false },
      { name: 'Tor Browser', publisher: 'Tor Project', riskLevel: 'critical', shadowIt: true },
      { name: 'TeamViewer', publisher: 'TeamViewer AG', riskLevel: 'high', shadowIt: true },
    ];

    return shadowItApps.map((app, index) => ({
      email: ['john.doe@idmatr.com', 'jane.smith@idmatr.com', 'alice.brown@idmatr.com'][index % 3],
      app: app.name,
      permissions: ['local_install', 'user_data_access'],
      lastActivity: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
      isAdmin: false,
      source: 'local-software',
      shadowIt: app.shadowIt,
      riskLevel: app.riskLevel,
      publisher: app.publisher,
    }));
  }
}
