import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import axios from 'axios';
import { RpcException } from '@nestjs/microservices';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async sendNotification(data: { type: string; recipient: string; content: string }) {
    this.logger.log(`Sending ${data.type} notification to ${data.recipient}`);

    try {
      if (data.type === 'email') {
        await this.sendEmail(data.recipient, data.content);
      } else if (data.type === 'slack') {
        await this.sendSlack(data.content);
      } else {
        throw new RpcException(`Unsupported notification type: ${data.type}`);
      }

      return { success: true, timestamp: new Date() };
    } catch (error) {
      this.logger.error(`Notification failure: ${error.message}`);
      throw new RpcException(`Failed to send notification: ${error.message}`);
    }
  }

  private async sendEmail(to: string, text: string) {
    if (!process.env.SMTP_HOST) {
      this.logger.warn('SMTP_HOST not configured, skipping email');
      return;
    }
    await this.transporter.sendMail({
      from: '"IDMatr Security" <security@idmatr.io>',
      to,
      subject: 'Security Notification',
      text,
    });
  }

  private async sendSlack(text: string) {
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (!webhookUrl) {
      this.logger.warn('SLACK_WEBHOOK_URL not configured, skipping slack');
      return;
    }
    await axios.post(webhookUrl, { text });
  }
}
