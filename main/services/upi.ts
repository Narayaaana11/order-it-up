/**
 * Dynamic UPI QR & Payment Reconciliation Service
 *
 * Implements NPCI Unified Payments Interface (UPI) deep link specifications,
 * VPA validation, and real-time payment reconciliation for Indian restaurants.
 */

import { getDatabase, now } from '../db';
import { recordAudit } from './audit';
import { notifyKdsUpdate } from './kds';
import { Decimal } from 'decimal.js';

export interface UpiUriOptions {
  vpa: string;
  merchantName: string;
  amount: number | string;
  billNumber: string;
  note?: string;
  tr?: string;
  merchantCode?: string;
}

/**
 * Validates Virtual Payment Address (VPA / UPI ID) according to NPCI standards:
 * Format: username@bankhandle (e.g. restaurant@icici, store99@oksbi)
 */
export function isValidVpa(vpa: string): boolean {
  if (!vpa || typeof vpa !== 'string') return false;
  const trimmed = vpa.trim();
  const vpaRegex = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z0-9]{2,64}$/;
  return vpaRegex.test(trimmed);
}

/**
 * Generates canonical NPCI UPI deep link URI string.
 */
export function generateUpiUri(options: UpiUriOptions): string {
  const vpa = options.vpa.trim();
  const cleanMerchant = options.merchantName.replace(/[^a-zA-Z0-9 ]/g, '').trim() || 'Restaurant';
  const amountStr = typeof options.amount === 'number'
    ? options.amount.toFixed(2)
    : new Decimal(options.amount).toFixed(2);
  const note = (options.note || `Bill ${options.billNumber}`).substring(0, 80);
  const tr = (options.tr || options.billNumber).substring(0, 35);
  const mc = options.merchantCode ? `&mc=${encodeURIComponent(options.merchantCode)}` : '';

  return `upi://pay?pa=${encodeURIComponent(vpa)}&pn=${encodeURIComponent(cleanMerchant)}&am=${amountStr}&cu=INR&tn=${encodeURIComponent(note)}&tr=${encodeURIComponent(tr)}${mc}`;
}

export interface UpiReconciliationInput {
  billId?: number | string;
  billNumber?: string;
  amount: number | string;
  utr: string; // Unique Transaction Reference (12-digit bank reference)
  payerVpa?: string;
  status: 'SUCCESS' | 'FAILURE';
  soundboxId?: string;
}

export interface UpiReconciliationResult {
  success: boolean;
  billId?: number;
  billNumber?: string;
  amount?: number;
  utr?: string;
  alreadyPaid?: boolean;
  error?: string;
}

/**
 * Reconciles an incoming UPI payment notification (from Soundbox, Webhook, or Payment Gateway).
 * Atomically marks the bill paid and registers the payment in SQLite.
 */
export function reconcileUpiPayment(input: UpiReconciliationInput): UpiReconciliationResult {
  const { billId, billNumber, amount, utr, payerVpa, status } = input;

  if (status !== 'SUCCESS') {
    return { success: false, error: 'Cannot reconcile failed transaction' };
  }

  if (!utr || typeof utr !== 'string') {
    return { success: false, error: 'UTR / transaction reference is required' };
  }

  const db = getDatabase();
  const timestamp = now();
  const receivedAmount = new Decimal(amount || 0);

  if (receivedAmount.lte(0)) {
    return { success: false, error: 'Payment amount must be greater than zero' };
  }

  let matchedBill: any = null;

  if (billId) {
    matchedBill = db.prepare('SELECT * FROM bills WHERE id = ?').get(billId);
  } else if (billNumber) {
    matchedBill = db.prepare('SELECT * FROM bills WHERE bill_number = ?').get(billNumber);
  }

  if (!matchedBill) {
    return { success: false, error: `Bill not found for reference (id: ${billId}, number: ${billNumber})` };
  }

  const totalDue = new Decimal(matchedBill.total || 0);

  // Check if already paid
  if (matchedBill.payment_status === 'paid') {
    return {
      success: true,
      billId: matchedBill.id,
      billNumber: matchedBill.bill_number,
      amount: totalDue.toNumber(),
      utr,
      alreadyPaid: true,
    };
  }

  // Verify amount matches within tolerance (0.05 rupee)
  if (receivedAmount.lt(totalDue.minus(0.05))) {
    return {
      success: false,
      error: `Received amount ₹${receivedAmount.toFixed(2)} is less than bill total ₹${totalDue.toFixed(2)}`,
    };
  }

  // Atomically apply payment
  db.transaction(() => {
    const existingPaymentsJson = matchedBill.payment_details;
    let paymentList: any[] = [];
    try {
      if (existingPaymentsJson) {
        const parsed = JSON.parse(existingPaymentsJson);
        paymentList = Array.isArray(parsed) ? parsed : [parsed];
      }
    } catch {
      paymentList = [];
    }

    const upiPaymentRecord = {
      method: 'upi',
      amount: receivedAmount.toNumber(),
      utr,
      payer_vpa: payerVpa || null,
      timestamp,
      soundbox_id: input.soundboxId || null,
    };
    paymentList.push(upiPaymentRecord);

    db.prepare(`
      UPDATE bills
      SET payment_status = 'paid',
          paid_amount = ?,
          balance = 0,
          payment_details = ?,
          paid_at = ?,
          updated_at = ?
      WHERE id = ?
    `).run(receivedAmount.toNumber(), JSON.stringify(paymentList), timestamp, timestamp, matchedBill.id);

    // Update parent order
    db.prepare(`
      UPDATE orders
      SET status = CASE WHEN status = 'pending' THEN 'completed' ELSE status END,
          updated_at = ?
      WHERE id = ?
    `).run(timestamp, matchedBill.order_id);

    // Record audit trail
    recordAudit({
      action: 'BILL_PAYMENT',
      entity_type: 'bill',
      entity_id: String(matchedBill.id),
      actor_user_id: 'SYSTEM_UPI',
      actor_role: 'system',
      before_json: { payment_status: matchedBill.payment_status, total: matchedBill.total },
      after_json: { payment_status: 'paid', payment_method: 'upi', utr, amount: receivedAmount.toNumber() },
      reason: `UPI payment reconciled via UTR ${utr}`,
      severity: 'info',
    });
  })();

  notifyKdsUpdate();

  return {
    success: true,
    billId: matchedBill.id,
    billNumber: matchedBill.bill_number,
    amount: receivedAmount.toNumber(),
    utr,
    alreadyPaid: false,
  };
}
