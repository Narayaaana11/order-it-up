/**
 * GST Invoice API routes
 *
 * GET /api/subscription/invoices               — List all paid subscription orders (paginated)
 * GET /api/subscription/invoices/:paymentOrderId — Download/generate GST invoice HTML
 *
 * GST Treatment (India SaaS):
 * - 18% GST applies to software SaaS in India
 * - Intra-state: 9% CGST + 9% SGST (when buyer state = seller state)
 * - Inter-state: 18% IGST (when buyer state ≠ seller state, or buyer GSTIN unknown)
 * - GST is calculated on the base amount (payment is inclusive of GST for display)
 *
 * Invoice formula:
 *   base_amount = total / 1.18        (extract base from GST-inclusive payment)
 *   gst_amount  = total - base_amount
 *
 * Invoice numbers: OIU-INV-{YYYY}-{NNNNNN}
 */

import { isOrgOwnerOrAdmin, UserMembership } from '../rbac';
import { Env } from './pairing';

// ── Seller details ────────────────────────────────────────────────────────────
// Replace SELLER_* values with your actual company details before production.
const SELLER_NAME    = 'Order It Up';
const SELLER_GSTIN   = 'GSTIN_PLACEHOLDER';    // e.g. 29ABCDE1234F1Z5
const SELLER_STATE   = 'Karnataka';
const SELLER_STATE_CODE = '29';
const SELLER_ADDRESS = 'Bengaluru, Karnataka, India';
const SELLER_EMAIL   = 'billing@orderitup.in';
const GST_RATE       = 18; // percent

// ── Helpers ──────────────────────────────────────────────────────────────────

function minorToRupees(minor: number): string {
  return (minor / 100).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
}

async function getNextInvoiceNumber(db: D1Database, year: number): Promise<string> {
  // Atomic increment using INSERT OR REPLACE
  await db.prepare(`
    INSERT INTO invoice_sequence (year, last_n) VALUES (?, 1)
    ON CONFLICT(year) DO UPDATE SET last_n = last_n + 1
  `).bind(year).run();
  const row = await db.prepare('SELECT last_n FROM invoice_sequence WHERE year = ?')
    .bind(year).first<{ last_n: number }>();
  const n = row?.last_n ?? 1;
  return `OIU-INV-${year}-${String(n).padStart(6, '0')}`;
}

function buildInvoiceHtml(params: {
  invoiceNumber: string;
  invoiceDate: string;
  planCode: string;
  billingCycle: string;
  totalMinor: number;
  baseMinor: number;
  gstMinor: number;
  cgstMinor: number;
  sgstMinor: number;
  igstMinor: number;
  isInterState: boolean;
  buyerName: string;
  buyerGstin: string | null;
  buyerAddress: string;
  paymentId: string;
  orderId: string;
}): string {
  const {
    invoiceNumber, invoiceDate, planCode, billingCycle,
    totalMinor, baseMinor, gstMinor, cgstMinor, sgstMinor, igstMinor,
    isInterState, buyerName, buyerGstin, buyerAddress,
    paymentId, orderId,
  } = params;

  const planLabel = `${planCode.charAt(0).toUpperCase() + planCode.slice(1)} Plan`;
  const cycleLabel = billingCycle === 'yearly' ? 'Annual' : 'Monthly';
  const description = `Order It Up ${planLabel} – ${cycleLabel} Subscription`;

  const gstBreakdown = isInterState
    ? `<tr><td>IGST (18%)</td><td style="text-align:right">₹${minorToRupees(igstMinor)}</td></tr>`
    : `
      <tr><td>CGST (9%)</td><td style="text-align:right">₹${minorToRupees(cgstMinor)}</td></tr>
      <tr><td>SGST (9%)</td><td style="text-align:right">₹${minorToRupees(sgstMinor)}</td></tr>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tax Invoice ${invoiceNumber}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #1e293b; background: #fff; padding: 32px; max-width: 800px; margin: 0 auto; }
    h1 { font-size: 22px; font-weight: 800; color: #ea580c; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 28px; border-bottom: 2px solid #ea580c; padding-bottom: 20px; }
    .seller-block { font-size: 12px; color: #64748b; line-height: 1.6; }
    .invoice-meta { text-align: right; }
    .invoice-meta h2 { font-size: 14px; font-weight: 700; color: #1e293b; margin-bottom: 6px; }
    .invoice-meta p { font-size: 12px; color: #64748b; line-height: 1.6; }
    .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px; }
    .party h3 { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8; margin-bottom: 6px; }
    .party p { font-size: 12px; line-height: 1.6; color: #334155; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px; }
    th { background: #f8fafc; font-weight: 700; padding: 10px 12px; text-align: left; border: 1px solid #e2e8f0; color: #475569; }
    td { padding: 10px 12px; border: 1px solid #e2e8f0; vertical-align: top; color: #334155; }
    .totals-table td { border: none; padding: 4px 12px; }
    .totals-table .total-row td { font-weight: 800; font-size: 14px; border-top: 2px solid #1e293b; padding-top: 10px; color: #1e293b; }
    .footer { margin-top: 32px; border-top: 1px solid #e2e8f0; padding-top: 16px; font-size: 11px; color: #94a3b8; line-height: 1.6; }
    .badge { display: inline-block; background: #fef3c7; color: #92400e; border: 1px solid #fcd34d; border-radius: 4px; padding: 2px 8px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 8px; }
    @media print { body { padding: 16px; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="badge">Tax Invoice</div>
      <h1>Order It Up</h1>
      <div class="seller-block">
        <p>${SELLER_ADDRESS}</p>
        <p>GSTIN: ${SELLER_GSTIN}</p>
        <p>${SELLER_EMAIL}</p>
      </div>
    </div>
    <div class="invoice-meta">
      <h2>${invoiceNumber}</h2>
      <p>Invoice Date: ${formatDate(invoiceDate)}</p>
      <p>Payment ID: ${paymentId}</p>
      <p>Order ID: ${orderId}</p>
    </div>
  </div>

  <div class="parties">
    <div class="party">
      <h3>Bill From</h3>
      <p><strong>${SELLER_NAME}</strong></p>
      <p>${SELLER_ADDRESS}</p>
      <p>GSTIN: ${SELLER_GSTIN}</p>
      <p>State: ${SELLER_STATE} (${SELLER_STATE_CODE})</p>
    </div>
    <div class="party">
      <h3>Bill To</h3>
      <p><strong>${buyerName || 'Restaurant Owner'}</strong></p>
      <p>${buyerAddress || 'India'}</p>
      ${buyerGstin ? `<p>GSTIN: ${buyerGstin}</p>` : '<p>Unregistered Dealer</p>'}
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Description</th>
        <th>HSN/SAC</th>
        <th>Amount (₹)</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>1</td>
        <td>${description}</td>
        <td>998314</td>
        <td style="text-align:right">₹${minorToRupees(baseMinor)}</td>
      </tr>
    </tbody>
  </table>

  <table class="totals-table" style="max-width:320px;margin-left:auto">
    <tbody>
      <tr><td>Sub Total (before GST)</td><td style="text-align:right">₹${minorToRupees(baseMinor)}</td></tr>
      ${gstBreakdown}
      <tr class="total-row"><td>Total Amount</td><td style="text-align:right">₹${minorToRupees(totalMinor)}</td></tr>
    </tbody>
  </table>

  <p style="margin-top:16px;font-size:12px;color:#64748b">
    Amount in words: <strong>Rupees ${amountInWords(totalMinor)} only</strong>
  </p>

  <div class="footer">
    <p>SAC Code 998314 — Online software subscription services</p>
    <p>This is a computer-generated invoice and does not require a physical signature.</p>
    <p>For billing queries: ${SELLER_EMAIL} | GST: ${GST_RATE}% (${isInterState ? 'IGST' : 'CGST + SGST'})</p>
  </div>
</body>
</html>`;
}

/** Rudimentary number-to-words for the invoice total (handles up to crores). */
function amountInWords(minor: number): string {
  const rupees = Math.floor(minor / 100);
  const paise  = minor % 100;
  const ones   = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
                   'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
                   'Seventeen', 'Eighteen', 'Nineteen'];
  const tens   = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convert(n: number): string {
    if (n === 0) return '';
    if (n < 20) return ones[n] + ' ';
    if (n < 100) return tens[Math.floor(n / 10)] + ' ' + convert(n % 10);
    if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred ' + convert(n % 100);
    if (n < 100000) return convert(Math.floor(n / 1000)) + 'Thousand ' + convert(n % 1000);
    if (n < 10000000) return convert(Math.floor(n / 100000)) + 'Lakh ' + convert(n % 100000);
    return convert(Math.floor(n / 10000000)) + 'Crore ' + convert(n % 10000000);
  }

  const rupeePart = rupees === 0 ? '' : convert(rupees).trim() + ' Rupees';
  const paisePart = paise === 0 ? '' : ' and ' + convert(paise).trim() + ' Paise';
  return (rupeePart + paisePart).trim() || 'Zero Rupees';
}

// ── Route handlers ────────────────────────────────────────────────────────────

export async function handleListInvoices(
  request: Request,
  env: Env,
  orgId: string,
  memberships: UserMembership[],
): Promise<Response> {
  if (!isOrgOwnerOrAdmin(memberships)) {
    return Response.json({ error: 'Only organization owners can view invoices' }, { status: 403 });
  }

  const url = new URL(request.url);
  const page  = Math.max(1, Number(url.searchParams.get('page') ?? '1'));
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get('limit') ?? '20')));
  const offset = (page - 1) * limit;

  const rows = await env.DB.prepare(`
    SELECT
      COALESCE(i.id, po.id) AS id,
      COALESCE(i.invoice_number, 'INV-' || substr(po.id, 1, 8)) AS invoice_number,
      COALESCE(i.invoice_date, COALESCE(po.captured_at, po.created_at)) AS invoice_date,
      po.plan_code,
      po.billing_cycle,
      po.amount_minor AS total_amount_minor,
      po.currency,
      i.buyer_gstin,
      po.id AS payment_order_id,
      po.provider_payment_id,
      po.provider_order_id
    FROM saas_subscription_payment_orders po
    LEFT JOIN subscription_invoices i ON i.payment_order_id = po.id
    WHERE po.organization_id = ? AND po.status = 'captured'
    ORDER BY COALESCE(po.captured_at, po.created_at) DESC
    LIMIT ? OFFSET ?
  `).bind(orgId, limit, offset).all<any>();

  const total = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM saas_subscription_payment_orders WHERE organization_id = ? AND status = 'captured'"
  ).bind(orgId).first<{ n: number }>();

  return Response.json({
    invoices: rows.results ?? [],
    total: total?.n ?? 0,
    page,
    limit,
  });
}

export async function handleGetInvoice(
  _request: Request,
  env: Env,
  orgId: string,
  memberships: UserMembership[],
  paymentOrderId: string,
): Promise<Response> {
  if (!isOrgOwnerOrAdmin(memberships)) {
    return Response.json({ error: 'Only organization owners can download invoices' }, { status: 403 });
  }

  const db = env.DB;

  // Check for cached invoice
  const existing = await db.prepare(`
    SELECT id, invoice_number, invoice_date, plan_code, billing_cycle,
           base_amount_minor, gst_amount_minor, total_amount_minor, invoice_html,
           buyer_gstin, buyer_name, buyer_state_code
    FROM subscription_invoices
    WHERE payment_order_id = ? AND organization_id = ?
  `).bind(paymentOrderId, orgId).first<any>();

  if (existing?.invoice_html) {
    return new Response(existing.invoice_html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `attachment; filename="${existing.invoice_number}.html"`,
        'Cache-Control': 'private, max-age=86400',
      },
    });
  }

  // Generate a new invoice
  const order = await db.prepare(`
    SELECT po.id, po.plan_code, po.billing_cycle, po.amount_minor, po.currency,
           po.provider_payment_id, po.provider_order_id, po.created_at,
           o.name AS org_name
    FROM saas_subscription_payment_orders po
    JOIN organizations o ON o.id = po.organization_id
    WHERE po.id = ? AND po.organization_id = ? AND po.status = 'captured'
  `).bind(paymentOrderId, orgId).first<any>();

  if (!order) {
    return Response.json({ error: 'Invoice not found or payment not captured' }, { status: 404 });
  }

  const year = new Date(order.created_at).getFullYear();
  const invoiceNumber = existing?.invoice_number ?? await getNextInvoiceNumber(db, year);
  const invoiceDate   = order.created_at;
  const totalMinor    = Number(order.amount_minor);

  // GST extraction: payment amount is GST-inclusive
  // base = total / 1.18, gst = total - base
  const baseMinor = Math.round(totalMinor / 1.18);
  const gstMinor  = totalMinor - baseMinor;
  const halfGst   = Math.round(gstMinor / 2);

  // Determine inter/intra-state: default to inter-state (IGST) unless buyer GSTIN is provided
  // and starts with Karnataka state code (29) — matching seller state
  const buyerGstin     = existing?.buyer_gstin ?? null;
  const buyerStateCode = existing?.buyer_state_code ?? (buyerGstin?.substring(0, 2) ?? null);
  const isInterState   = buyerStateCode !== SELLER_STATE_CODE;

  const html = buildInvoiceHtml({
    invoiceNumber,
    invoiceDate,
    planCode:    order.plan_code,
    billingCycle: order.billing_cycle,
    totalMinor,
    baseMinor,
    gstMinor,
    cgstMinor:   isInterState ? 0 : halfGst,
    sgstMinor:   isInterState ? 0 : gstMinor - halfGst,
    igstMinor:   isInterState ? gstMinor : 0,
    isInterState,
    buyerName:   existing?.buyer_name ?? order.org_name ?? 'Restaurant Owner',
    buyerGstin,
    buyerAddress: 'India',
    paymentId:   order.provider_payment_id ?? '',
    orderId:     order.provider_order_id ?? '',
  });

  // Persist the generated invoice
  const invoiceId = crypto.randomUUID();
  const nowIso    = new Date().toISOString();
  if (!existing) {
    await db.prepare(`
      INSERT OR IGNORE INTO subscription_invoices (
        id, organization_id, payment_order_id, invoice_number, invoice_date,
        plan_code, billing_cycle, base_amount_minor, gst_rate_percent, gst_amount_minor,
        total_amount_minor, currency, buyer_name, buyer_gstin, buyer_state_code,
        invoice_html, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      invoiceId, orgId, paymentOrderId, invoiceNumber, invoiceDate,
      order.plan_code, order.billing_cycle, baseMinor, GST_RATE, gstMinor,
      totalMinor, order.currency ?? 'INR',
      order.org_name ?? null, buyerGstin, buyerStateCode,
      html, nowIso, nowIso,
    ).run();
  } else {
    // Cache the HTML on the existing record
    await db.prepare(
      'UPDATE subscription_invoices SET invoice_html = ?, updated_at = ? WHERE id = ?'
    ).bind(html, nowIso, existing.id).run();
  }

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': `attachment; filename="${invoiceNumber}.html"`,
      'Cache-Control': 'private, max-age=86400',
    },
  });
}
