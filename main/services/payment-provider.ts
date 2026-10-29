import * as crypto from 'node:crypto';
import log from 'electron-log';

export interface PaymentOrderParams {
  amount: number;
  currency: string;
  receipt: string;
  notes?: Record<string, string>;
  customerPhone?: string;
}

export interface PaymentOrderResult {
  provider: 'razorpay' | 'cashfree' | 'mock';
  orderId: string;
  amount: number;
  currency: string;
  status: 'created' | 'paid' | 'failed';
  keyId?: string;
  checkoutUrl?: string;
}

export interface PaymentVerifyParams {
  orderId: string;
  paymentId: string;
  signature?: string;
}

export interface PaymentVerifyResult {
  verified: boolean;
  orderId: string;
  paymentId: string;
  status: 'success' | 'failed';
  message?: string;
}

export interface PaymentProvider {
  createSubscriptionOrder(params: PaymentOrderParams): Promise<PaymentOrderResult>;
  verifyPayment(params: PaymentVerifyParams): Promise<PaymentVerifyResult>;
}

/**
 * Razorpay Driver for Indian INR commercial subscriptions (Cards, UPI, Netbanking)
 */
export class RazorpayProvider implements PaymentProvider {
  private keyId: string;
  private keySecret: string;

  constructor(keyId?: string, keySecret?: string) {
    this.keyId = keyId || process.env.OIU_RAZORPAY_KEY_ID || '';
    this.keySecret = keySecret || process.env.OIU_RAZORPAY_KEY_SECRET || '';
  }

  public async createSubscriptionOrder(params: PaymentOrderParams): Promise<PaymentOrderResult> {
    if (!this.keyId || !this.keySecret) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('[Razorpay] Cannot create order: Razorpay API keys not configured in production environment.');
      }
      log.warn('[Razorpay] Razorpay API keys not configured. Falling back to Mock Order in development.');
      return new MockPaymentProvider().createSubscriptionOrder(params);
    }

    // In production, invoke https://api.razorpay.com/v1/orders
    const authHeader = `Basic ${Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64')}`;
    const res = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify({
        amount: Math.round(params.amount * 100), // paise
        currency: params.currency || 'INR',
        receipt: params.receipt,
        notes: params.notes,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Razorpay order API failed (${res.status}): ${errText}`);
    }

    const data = await res.json() as { id: string };
    return {
      provider: 'razorpay',
      orderId: data.id,
      amount: params.amount,
      currency: params.currency || 'INR',
      status: 'created',
      keyId: this.keyId,
    };
  }

  public async verifyPayment(params: PaymentVerifyParams): Promise<PaymentVerifyResult> {
    if (!this.keySecret) {
      return {
        verified: false,
        orderId: params.orderId,
        paymentId: params.paymentId,
        status: 'failed',
        message: 'Razorpay secret key not configured',
      };
    }

    if (!params.signature || typeof params.signature !== 'string') {
      return {
        verified: false,
        orderId: params.orderId,
        paymentId: params.paymentId,
        status: 'failed',
        message: 'Missing payment signature',
      };
    }

    // Cryptographic signature verification with timing-safe HMAC SHA256 (orderId + "|" + paymentId)
    const expectedSignature = crypto
      .createHmac('sha256', this.keySecret)
      .update(`${params.orderId}|${params.paymentId}`)
      .digest('hex');

    const sigBuf = Buffer.from(params.signature, 'utf8');
    const expBuf = Buffer.from(expectedSignature, 'utf8');

    const isValid = sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf);
    if (!isValid) {
      return {
        verified: false,
        orderId: params.orderId,
        paymentId: params.paymentId,
        status: 'failed',
        message: 'Invalid payment signature: HMAC verification failed',
      };
    }

    return {
      verified: true,
      orderId: params.orderId,
      paymentId: params.paymentId,
      status: 'success',
      message: 'Razorpay signature verified successfully.',
    };
  }
}

/**
 * Mock Provider for local offline or test environments
 */
export class MockPaymentProvider implements PaymentProvider {
  public async createSubscriptionOrder(params: PaymentOrderParams): Promise<PaymentOrderResult> {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Mock payment provider is strictly forbidden in production mode.');
    }
    const orderId = `oiu_mock_${Date.now()}`;
    return {
      provider: 'mock',
      orderId,
      amount: params.amount,
      currency: params.currency || 'INR',
      status: 'created',
      checkoutUrl: `https://checkout.orderitup.in/pay/${orderId}`,
    };
  }

  public async verifyPayment(params: PaymentVerifyParams): Promise<PaymentVerifyResult> {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Mock payment verification is strictly forbidden in production mode.');
    }
    if (!params.orderId || !params.paymentId || params.signature === 'invalid') {
      return {
        verified: false,
        orderId: params.orderId,
        paymentId: params.paymentId,
        status: 'failed',
        message: 'Mock verification rejected invalid credentials',
      };
    }
    return {
      verified: true,
      orderId: params.orderId,
      paymentId: params.paymentId || `pay_mock_${Date.now()}`,
      status: 'success',
      message: 'Mock payment verified successfully.',
    };
  }
}

export function getPaymentProvider(): PaymentProvider {
  if (process.env.OIU_RAZORPAY_KEY_ID && process.env.OIU_RAZORPAY_KEY_SECRET) {
    return new RazorpayProvider();
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Commercial payment provider credentials are required in production.');
  }
  return new MockPaymentProvider();
}
