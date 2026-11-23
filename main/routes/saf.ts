import { Router, Request, Response } from 'express';
import { requireRole } from '../middleware/security';
import { ROLE_ACCESS } from '../../shared/role-permissions';
import { asyncHandler } from '../middleware/async-handler';
import {
  queueOfflineCardPayment,
  processPendingSafTransactions,
  getSafLimits,
  listSafTransactions,
} from '../services/saf-engine';

const router = Router();

// ── Status and Risk Limits ──────────────────────────────────────────────────

router.get('/status', requireRole(...ROLE_ACCESS.ownerManagerCashier), asyncHandler(async (_req: Request, res: Response) => {
  const limits = getSafLimits();
  res.json({ ok: true, limits });
}));

// ── List Queued Transactions ────────────────────────────────────────────────

router.get('/transactions', requireRole(...ROLE_ACCESS.ownerManagerCashier), asyncHandler(async (req: Request, res: Response) => {
  const { status, limit } = req.query;
  const transactions = listSafTransactions(
    typeof status === 'string' ? status : undefined,
    Number(limit) || 50
  );
  res.json({ ok: true, transactions });
}));

// ── Queue Offline Card Payment ──────────────────────────────────────────────

router.post('/queue', requireRole(...ROLE_ACCESS.ownerManagerCashier), asyncHandler(async (req: Request, res: Response) => {
  try {
    const { order_id, bill_id, amount, currency, card_last4, card_brand, auth_code, entry_mode } = req.body || {};

    const tx = queueOfflineCardPayment({
      orderId: Number(order_id),
      billId: Number(bill_id),
      amount: Number(amount),
      currency,
      cardLast4: card_last4,
      cardBrand: card_brand,
      authCode: auth_code,
      entryMode: entry_mode,
    });

    res.status(201).json({ ok: true, transaction: tx });
  } catch (err: any) {
    const status = err?.statusCode || 400;
    res.status(status).json({ error: err?.message || 'Failed to queue SAF transaction' });
  }
}));

// ── Trigger Batch Forward Settlement ────────────────────────────────────────

router.post('/forward-batch', requireRole(...ROLE_ACCESS.ownerManager), asyncHandler(async (_req: Request, res: Response) => {
  const result = await processPendingSafTransactions();
  res.json({ ok: true, result });
}));

export const safRoutes = router;
