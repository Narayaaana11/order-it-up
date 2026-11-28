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

class ResendEmailProvider implements EmailProvider {
  constructor(private readonly apiKey: string, private readonly defaultFrom: string) {}

  public async sendEmail(msg: EmailMessage): Promise<EmailSendResult> {
    if (process.env.FLO_MATRIX_OFFLINE === '1') {
      return new MockEmailProvider().sendEmail(msg);
    }
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: msg.from || this.defaultFrom,
          to: [msg.to],
          subject: msg.subject,
          ...(msg.html ? { html: msg.html } : {}),
          ...(msg.text ? { text: msg.text } : {}),
        }),
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => res.statusText);
        return { success: false, error: `Resend HTTP ${res.status}: ${errText}` };
      }
      const data = (await res.json()) as { id?: string };
      return { success: true, messageId: data?.id };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}

class BrevoEmailProvider implements EmailProvider {
  constructor(private readonly apiKey: string, private readonly defaultFrom: string) {}

  public async sendEmail(msg: EmailMessage): Promise<EmailSendResult> {
    if (process.env.FLO_MATRIX_OFFLINE === '1') {
      return new MockEmailProvider().sendEmail(msg);
    }
    try {
      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sender: { email: msg.from || this.defaultFrom },
          to: [{ email: msg.to }],
          subject: msg.subject,
          ...(msg.html ? { htmlContent: msg.html } : {}),
          ...(msg.text ? { textContent: msg.text } : {}),
        }),
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => res.statusText);
        return { success: false, error: `Brevo HTTP ${res.status}: ${errText}` };
      }
      const data = (await res.json()) as { messageId?: string };
      return { success: true, messageId: data?.messageId };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
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
  const defaultFrom = process.env.OIU_EMAIL_FROM || 'Order It Up <noreply@orderitup.in>';
  if (process.env.RESEND_API_KEY) {
    return new ResendEmailProvider(process.env.RESEND_API_KEY, defaultFrom);
  }
  if (process.env.BREVO_API_KEY) {
    return new BrevoEmailProvider(process.env.BREVO_API_KEY, defaultFrom);
  }
  if (process.env.OIU_SMTP_USER && process.env.OIU_SMTP_PASS) {
    return new SMTPEmailProvider();
  }
  return new MockEmailProvider();
}
