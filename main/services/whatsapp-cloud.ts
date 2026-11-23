/**
 * Official Meta WhatsApp Cloud API Provider
 *
 * Implements the official Meta Graph API v21.0 for WhatsApp Business Platform:
 * - Direct HTTPS messaging with Meta servers (Zero ban risk, fully compliant with Meta Terms of Service)
 * - Supports approved templates (e.g. order confirmation, digital bills) and direct session messages
 * - Built-in sandbox / mock mode for development, offline testing, and automated test runners
 */

export interface WhatsAppCloudConfig {
  phoneNumberId?: string;
  businessAccountId?: string;
  accessToken?: string;
  mockMode?: boolean;
}

export interface WhatsAppCloudSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  mock?: boolean;
  timestamp: string;
}

export interface WhatsAppTemplateMessageOptions {
  to: string; // E.164 phone number, e.g. +919876543210
  templateName: string;
  languageCode?: string; // default: 'en_US' or 'en'
  components?: Array<{
    type: 'header' | 'body' | 'button';
    parameters: Array<{
      type: 'text' | 'currency' | 'date_time' | 'image' | 'document';
      text?: string;
      [key: string]: any;
    }>;
  }>;
}

export interface WhatsAppTextMessageOptions {
  to: string;
  body: string;
  previewUrl?: boolean;
}

export class WhatsAppCloudService {
  private config: WhatsAppCloudConfig;
  private recordedMessages: Array<any> = [];

  constructor(config: WhatsAppCloudConfig = {}) {
    this.config = {
      mockMode: config.mockMode ?? true,
      ...config,
    };
  }

  public updateConfig(newConfig: Partial<WhatsAppCloudConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  public getConfig(): Readonly<WhatsAppCloudConfig> {
    return { ...this.config };
  }

  public getRecordedMessages(): any[] {
    return [...this.recordedMessages];
  }

  public clearRecordedMessages(): void {
    this.recordedMessages = [];
  }

  /**
   * Sanitizes phone number to E.164 digits format (Meta requires digits without '+').
   */
  public sanitizePhoneNumber(phone: string): string {
    return phone.replace(/[^0-9]/g, '');
  }

  /**
   * Sends an official pre-approved WhatsApp Business template message.
   */
  public async sendTemplate(options: WhatsAppTemplateMessageOptions): Promise<WhatsAppCloudSendResult> {
    const recipientDigits = this.sanitizePhoneNumber(options.to);
    const timestamp = new Date().toISOString();

    if (!recipientDigits) {
      return { success: false, error: 'Recipient phone number is invalid or empty', timestamp };
    }

    if (!options.templateName) {
      return { success: false, error: 'templateName is required for WhatsApp Cloud API', timestamp };
    }

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: recipientDigits,
      type: 'template',
      template: {
        name: options.templateName,
        language: { code: options.languageCode || 'en_US' },
        components: options.components || [],
      },
    };

    // If mock mode is active or credentials are not configured, simulate delivery
    if (this.config.mockMode || !this.config.accessToken || !this.config.phoneNumberId) {
      const mockMessageId = `wamid.HBgL${Date.now()}${recipientDigits.slice(-4)}`;
      this.recordedMessages.push({
        type: 'template',
        payload,
        messageId: mockMessageId,
        timestamp,
      });

      return {
        success: true,
        messageId: mockMessageId,
        mock: true,
        timestamp,
      };
    }

    // Live Meta Graph API Call
    try {
      const url = `https://graph.facebook.com/v21.0/${this.config.phoneNumberId}/messages`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json() as any;

      if (!response.ok) {
        const errorMsg = data?.error?.message || `HTTP ${response.status} from Meta Graph API`;
        return { success: false, error: errorMsg, timestamp };
      }

      const messageId = data?.messages?.[0]?.id || `wamid.HBgL${Date.now()}`;
      return { success: true, messageId, mock: false, timestamp };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error reaching Meta Cloud API', timestamp };
    }
  }

  /**
   * Sends a direct text message (allowed within 24-hour customer service window).
   */
  public async sendText(options: WhatsAppTextMessageOptions): Promise<WhatsAppCloudSendResult> {
    const recipientDigits = this.sanitizePhoneNumber(options.to);
    const timestamp = new Date().toISOString();

    if (!recipientDigits) {
      return { success: false, error: 'Recipient phone number is invalid', timestamp };
    }

    if (!options.body) {
      return { success: false, error: 'Message body cannot be empty', timestamp };
    }

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: recipientDigits,
      type: 'text',
      text: {
        preview_url: options.previewUrl ?? false,
        body: options.body,
      },
    };

    if (this.config.mockMode || !this.config.accessToken || !this.config.phoneNumberId) {
      const mockMessageId = `wamid.HBgL${Date.now()}${recipientDigits.slice(-4)}`;
      this.recordedMessages.push({
        type: 'text',
        payload,
        messageId: mockMessageId,
        timestamp,
      });

      return {
        success: true,
        messageId: mockMessageId,
        mock: true,
        timestamp,
      };
    }

    try {
      const url = `https://graph.facebook.com/v21.0/${this.config.phoneNumberId}/messages`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json() as any;

      if (!response.ok) {
        const errorMsg = data?.error?.message || `HTTP ${response.status} from Meta Graph API`;
        return { success: false, error: errorMsg, timestamp };
      }

      const messageId = data?.messages?.[0]?.id || `wamid.HBgL${Date.now()}`;
      return { success: true, messageId, mock: false, timestamp };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error reaching Meta Cloud API', timestamp };
    }
  }
}

export const defaultWhatsAppCloud = new WhatsAppCloudService();
