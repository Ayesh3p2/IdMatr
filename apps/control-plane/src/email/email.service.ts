import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

export interface WelcomeEmailData {
  tenantName: string;
  adminEmail: string;
  adminName: string;
  onboardingUrl: string;
  frameworks: string[];
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    const host = process.env.SMTP_HOST;
    if (host) {
      this.transporter = nodemailer.createTransport({
        host,
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
      this.logger.log(`Email service configured: ${host}:${process.env.SMTP_PORT || 587}`);
    } else {
      this.logger.warn('SMTP_HOST not configured; onboarding links will not be emailed');
    }
  }

  async sendWelcomeEmail(data: WelcomeEmailData): Promise<boolean> {
    const subject = `Welcome to IDMatr – Complete Secure Onboarding`;
    const frameworkList = data.frameworks.length
      ? data.frameworks.map((framework) => `  - ${framework.toUpperCase()}`).join('\n')
      : '  - None selected';

    const text = `
Welcome to IDMatr, ${data.adminName}.

Your tenant environment "${data.tenantName}" is ready for onboarding.

Complete onboarding:
${data.onboardingUrl}

This one-time link expires in 15 minutes and can only be used once.

Selected compliance frameworks:
${frameworkList}

Security steps:
1. Open the onboarding link.
2. Set a strong password.
3. Enable MFA after your first sign-in if you are a tenant administrator.
4. Configure your identity providers and integrations.

If you did not request this account, contact your platform administrator immediately.
`.trim();

    const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #060b16; color: #e2e8f0; margin: 0; padding: 0; }
  .container { max-width: 620px; margin: 40px auto; background: #0f1629; border-radius: 14px; border: 1px solid #1e3a5f; overflow: hidden; }
  .header { padding: 30px 36px; border-bottom: 1px solid #1e3a5f; background: linear-gradient(135deg, #0d2137 0%, #0a1628 100%); }
  .header h1 { margin: 0; color: #0d9488; font-size: 24px; }
  .body { padding: 30px 36px; }
  .section { border: 1px solid rgba(30,58,95,0.7); border-radius: 10px; padding: 18px 20px; margin-bottom: 18px; background: rgba(15,23,42,0.55); }
  .button { display: inline-block; background: #0d9488; color: #fff !important; text-decoration: none; padding: 12px 22px; border-radius: 8px; font-weight: 700; }
  .note { font-size: 12px; color: #fbbf24; }
  .framework { display: inline-block; margin: 4px 6px 0 0; padding: 4px 10px; border-radius: 999px; border: 1px solid rgba(129,140,248,0.3); color: #818cf8; font-size: 11px; font-weight: 700; }
  .footer { border-top: 1px solid #1e3a5f; padding: 18px 36px; font-size: 11px; color: #64748b; }
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <h1>IDMatr</h1>
    <div style="margin-top:6px;color:#94a3b8;font-size:13px">Enterprise Identity Security Platform</div>
  </div>
  <div class="body">
    <p style="margin-top:0">Welcome, <strong>${data.adminName}</strong>. Your tenant <strong>${data.tenantName}</strong> is ready for secure onboarding.</p>

    <div class="section">
      <div style="font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:.08em;margin-bottom:12px">Secure Onboarding</div>
      <a class="button" href="${data.onboardingUrl}">Complete Onboarding</a>
      <p class="note">This one-time link expires in 15 minutes and is invalid after first use.</p>
    </div>

    <div class="section">
      <div style="font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:.08em;margin-bottom:12px">Compliance Scope</div>
      ${data.frameworks.map((framework) => `<span class="framework">${framework}</span>`).join('')}
    </div>

    <div class="section">
      <div style="font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:.08em;margin-bottom:12px">Next Steps</div>
      <ol style="margin:0;padding-left:20px;color:#cbd5e1">
        <li>Set your password from the onboarding link.</li>
        <li>Sign in to the tenant portal.</li>
        <li>Enable MFA if you are a privileged user.</li>
        <li>Connect identity providers and approved integrations.</li>
      </ol>
    </div>
  </div>
  <div class="footer">IDMatr · Secure onboarding links are never logged or reissued without administrator action.</div>
</div>
</body>
</html>`;

    if (!this.transporter) {
      this.logger.warn(`Welcome email not sent to ${data.adminEmail}; SMTP is not configured`);
      return false;
    }

    try {
      await this.transporter.sendMail({
        from: process.env.SMTP_FROM || '"IDMatr Platform" <noreply@idmatr.io>',
        to: data.adminEmail,
        subject,
        text,
        html,
      });
      this.logger.log(`Welcome onboarding email sent to ${data.adminEmail}`);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to send welcome email to ${data.adminEmail}: ${message}`);
      return false;
    }
  }

  async sendRegeneratedCredentialsEmail(data: {
    tenantName: string;
    adminEmail: string;
    adminName: string;
    onboardingUrl: string;
    loginUrl: string;
  }): Promise<boolean> {
    if (!this.transporter) {
      this.logger.warn(`Regenerated onboarding link not emailed to ${data.adminEmail}; SMTP is not configured`);
      return false;
    }

    try {
      await this.transporter.sendMail({
        from: process.env.SMTP_FROM || '"IDMatr Platform" <noreply@idmatr.io>',
        to: data.adminEmail,
        subject: `IDMatr – New secure onboarding link for ${data.tenantName}`,
        text: `
Your IDMatr onboarding link has been regenerated.

Onboarding link:
${data.onboardingUrl}

Fallback login page:
${data.loginUrl}

This link expires in 15 minutes and can only be used once.
`.trim(),
      });
      this.logger.log(`Regenerated onboarding email sent to ${data.adminEmail}`);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to send regenerated onboarding email to ${data.adminEmail}: ${message}`);
      return false;
    }
  }
}
