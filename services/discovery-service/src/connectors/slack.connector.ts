import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class SlackConnector {
  private readonly logger = new Logger(SlackConnector.name);

  async scan() {
    this.logger.log('Scanning Slack workspace...');
    // In production: use Slack Web API with bot token (SLACK_BOT_TOKEN)
    // Endpoint: https://slack.com/api/users.list
    // For now, returns simulated discovery data including shadow IT detection.
    return [
      {
        email: 'john.doe@idmatr.com',
        app: 'Slack',
        permissions: ['workspace_admin', 'channel_manager'],
        lastActivity: new Date(),
        isAdmin: true,
        source: 'slack',
        shadowIt: false,
      },
      {
        email: 'jane.smith@idmatr.com',
        app: 'Slack',
        permissions: ['member'],
        lastActivity: new Date(),
        isAdmin: false,
        source: 'slack',
        shadowIt: false,
      },
      {
        email: 'contractor.a@external.com',
        app: 'Slack',
        permissions: ['guest'],
        lastActivity: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // 90 days ago
        isAdmin: false,
        source: 'slack',
        shadowIt: true, // External contractor using without formal approval
      },
      {
        email: 'personal.user@gmail.com',
        app: 'Slack',
        permissions: ['member'],
        lastActivity: new Date(),
        isAdmin: false,
        source: 'slack',
        shadowIt: true, // Personal email in corporate workspace = shadow IT
      },
    ];
  }
}
