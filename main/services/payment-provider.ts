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
  expectedAmountMinor?: number;
  expectedCurrency?: string;
}

export interface PaymentVerifyResult {
  verified: boolean;
  orderId: string;
  paymentId: string;
  status: 'success' | 'failed';
  amountMinor?: number;
  currency?: string;
  captured?: boolean;
  message?: string;
}

export interface PaymentProvider {
  readonly providerName: 'razorpay' | 'cashfree' | 'mock';
  createSubscriptionOrder(params: PaymentOrderParams): Promise<PaymentOrderResult>;
  verifyPayment(params: PaymentVerifyParams): Promise<PaymentVerifyResult>;
}

/**
 * Razorpay Driver for Indian INR commercial subscriptions (Cards, UPI, Netbanking)
 */
export class RazorpayProvider implements PaymentProvider {
  readonly providerName = 'razorpay' as const;
  private keyId: string;
  private keySecret: string;

  constructor(keyId?: string, keySecret?: string) {
    this.keyId = keyId || process.env.OIU_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID || '';
    this.keySecret = keySecret || process.env.OIU_RAZORPAY_KEY_SECRET || process.env.RAZORPAY_KEY_SECRET || '';
  }

  public async createSubscriptionOrder(params: PaymentOrderParams): Promise<PaymentOrderResult> {
    if (!this.keyId || !this.keySecret) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('[Razorpay] Cannot create order: Razorpay API keys not configured in production environment.');
      }
      log.warn('[Razorpay] Razorpay API keys not configured. Falling back to Mock Order in development.');
      return new MockPaymentProvider().createSubscriptionOrder(params);
    }

    if (process.env.NODE_ENV === 'production' && this.keyId.startsWith('rzp_test_')) {
      throw new Error('[Razorpay] Test API keys (rzp_test_*) cannot be used in production mode.');
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

    if (!this.keyId) {
      return { verified: false, orderId: params.orderId, paymentId: params.paymentId, status: 'failed', message: 'Razorpay key ID is not configured' };
    }

    // HMAC proves the checkout callback was signed for this order/payment pair.
    // Fetch the provider record as well so only a captured payment with the
    // server-created amount, currency, and order can activate entitlements.
    const paymentResponse = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(params.paymentId)}`, {
      headers: { Authorization: `Basic ${Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64')}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!paymentResponse.ok) {
      return { verified: false, orderId: params.orderId, paymentId: params.paymentId, status: 'failed', message: 'Could not verify payment status with Razorpay' };
    }
    const payment = await paymentResponse.json() as {
      id?: string; order_id?: string; amount?: number; currency?: string; status?: string; captured?: boolean;
    };
    const amountMinor = Number(payment.amount);
    const validPayment = payment.id === params.paymentId
      && payment.order_id === params.orderId
      && payment.status === 'captured'
      && payment.captured === true
      && Number.isSafeInteger(amountMinor)
      && (params.expectedAmountMinor === undefined || amountMinor === params.expectedAmountMinor)
      && (!params.expectedCurrency || payment.currency === params.expectedCurrency);
    if (!validPayment) {
      return {
        verified: false,
        orderId: params.orderId,
        paymentId: params.paymentId,
        status: 'failed',
        amountMinor: Number.isSafeInteger(amountMinor) ? amountMinor : undefined,
        currency: payment.currency,
        captured: payment.captured === true,
        message: 'Razorpay payment is not captured or does not match the expected order amount and currency',
      };
    }

    return {
      verified: true,
      orderId: params.orderId,
      paymentId: params.paymentId,
      status: 'success',
      amountMinor,
      currency: payment.currency,
      captured: true,
      message: 'Razorpay captured payment verified successfully.',
    };
  }
}

/**
 * Mock Provider for local offline or test environments
 */
export class MockPaymentProvider implements PaymentProvider {
  readonly providerName = 'mock' as const;
  public async createSubscriptionOrder(params: PaymentOrderParams): Promise<PaymentOrderResult> {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Mock payment provider is strictly forbidden in production mode.');
    }
    const orderId = `oiu_mock_${crypto.randomUUID()}`;
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
      amountMinor: params.expectedAmountMinor,
      currency: params.expectedCurrency,
      captured: true,
      message: 'Mock payment verified successfully.',
    };
  }
}

export function getPaymentProvider(): PaymentProvider {
  const keyId = process.env.OIU_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.OIU_RAZORPAY_KEY_SECRET || process.env.RAZORPAY_KEY_SECRET;
  if (keyId && keySecret) {
    return new RazorpayProvider(keyId, keySecret);
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Commercial payment provider credentials are required in production.');
  }
  return new MockPaymentProvider();
}
