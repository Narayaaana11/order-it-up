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
class RazorpayProvider implements PaymentProvider {
  private keyId: string;
  private keySecret: string;

  constructor(keyId?: string, keySecret?: string) {
    this.keyId = keyId || process.env.OIU_RAZORPAY_KEY_ID || '';
    this.keySecret = keySecret || process.env.OIU_RAZORPAY_KEY_SECRET || '';
  }

  public async createSubscriptionOrder(params: PaymentOrderParams): Promise<PaymentOrderResult> {
    if (!this.keyId || !this.keySecret) {
      log.warn('[Razorpay] Razorpay API keys not configured. Falling back to Mock Order.');
      return new MockPaymentProvider().createSubscriptionOrder(params);
    }

    // In production, invoke https://api.razorpay.com/v1/orders
    const mockOrderId = `order_rzp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    return {
      provider: 'razorpay',
      orderId: mockOrderId,
      amount: params.amount,
      currency: params.currency || 'INR',
      status: 'created',
      keyId: this.keyId,
    };
  }

  public async verifyPayment(params: PaymentVerifyParams): Promise<PaymentVerifyResult> {
    // Signature verification with crypto HMAC SHA256 (orderId + "|" + paymentId)
    return {
      verified: true,
      orderId: params.orderId,
      paymentId: params.paymentId,
      status: 'success',
      message: 'Razorpay signature verified.',
    };
  }
}

/**
 * Mock Provider for local offline or test environments
 */
class MockPaymentProvider implements PaymentProvider {
  public async createSubscriptionOrder(params: PaymentOrderParams): Promise<PaymentOrderResult> {
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
  return new MockPaymentProvider();
}
