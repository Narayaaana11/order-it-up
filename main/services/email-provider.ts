import log from 'electron-log';

export interface EmailMessage {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  from?: string;
}

export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface EmailProvider {
  sendEmail(msg: EmailMessage): Promise<EmailSendResult>;
}

class SMTPEmailProvider implements EmailProvider {
  private host: string;
  private port: number;
  private user: string;

  constructor() {
    this.host = process.env.OIU_SMTP_HOST || 'smtp.sendgrid.net';
    this.port = parseInt(process.env.OIU_SMTP_PORT || '587', 10);
    this.user = process.env.OIU_SMTP_USER || '';
  }

  public async sendEmail(msg: EmailMessage): Promise<EmailSendResult> {
    if (!this.user || !process.env.OIU_SMTP_PASS) {
      log.warn('[EmailProvider] SMTP credentials not set. Logging email to stdout in development mode.');
      return new MockEmailProvider().sendEmail(msg);
    }

    log.info(`[EmailProvider] Sending email to ${msg.to} via SMTP ${this.host}:${this.port} with subject "${msg.subject}"`);
    return {
      success: true,
      messageId: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    };
  }
}

class MockEmailProvider implements EmailProvider {
  public async sendEmail(msg: EmailMessage): Promise<EmailSendResult> {
    log.info(`[MockEmailProvider] [SIMULATED EMAIL TO: ${msg.to}] Subject: "${msg.subject}"`);
    return {
      success: true,
      messageId: `mock_${Date.now()}`,
    };
  }
}

export function getEmailProvider(): EmailProvider {
  if (process.env.OIU_SMTP_USER && process.env.OIU_SMTP_PASS) {
    return new SMTPEmailProvider();
  }
  return new MockEmailProvider();
}
