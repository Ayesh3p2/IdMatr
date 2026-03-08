import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  async sendNotification(data: { type: string; recipient: string; content: string }) {
    this.logger.log(`Sending ${data.type} notification to ${data.recipient}: ${data.content}`);
    // Real implementation: Email (Nodemailer), Slack (Webhook), Push, etc.
    return { status: 'sent', timestamp: new Date() };
  }
}
