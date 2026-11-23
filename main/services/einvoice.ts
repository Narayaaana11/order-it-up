/**
 * B2B E-Invoicing IRP Standard Schema Exporter (JSON)
 *
 * Implements standard format for Invoice Registration Portal (IRP) reporting
 * under Notification No. 10/2023-Central Tax (5 Cr+ aggregate turnover mandate).
 */

import { getDatabase, now } from '../db';
import { getTenantCurrency } from '../routes/bills';

export interface EinvoiceIrpPayload {
  Version: string;
  TranDtls: {
    TaxSch: 'GST';
    SupTyp: 'B2B';
    RegRev?: 'Y' | 'N';
    EcmGstin?: string | null;
    IgstOnIntra?: 'Y' | 'N';
  };
  DocDtls: {
    Typ: 'INV' | 'CRN' | 'DBN';
    No: string;
    Dt: string; // DD/MM/YYYY
  };
  SellerDtls: {
    Gstin: string;
    LglNm: string;
    TrdNm?: string;
    Addr1: string;
    Loc: string;
    Pin: number;
    Stcd: string;
    Ph?: string;
    Em?: string;
  };
  BuyerDtls: {
    Gstin: string;
    LglNm: string;
    TrdNm?: string;
    Pos: string;
    Addr1: string;
    Loc: string;
    Pin: number;
    Stcd: string;
    Ph?: string;
  };
  ItemList: Array<{
    SlNo: string;
    PrdDesc: string;
    IsServc: 'Y' | 'N';
    HsnCd: string;
    Qty: number;
    UnitRate: number;
    TotAmt: number;
    Discount: number;
    AssAmt: number;
    GstRt: number;
    IgstAmt: number;
    CgstAmt: number;
    SgstAmt: number;
    TotItemVal: number;
  }>;
  ValDtls: {
    AssVal: number;
    CgstVal: number;
    SgstVal: number;
    IgstVal: number;
    CesVal: number;
    RndOffAmt: number;
    TotInvVal: number;
  };
}

export function generateB2BEinvoiceJson(billId: number): EinvoiceIrpPayload {
  const db = getDatabase();
  const bill = db.prepare('SELECT * FROM bills WHERE id = ?').get(billId) as any;
  if (!bill) {
    throw Object.assign(new Error('Bill not found'), { statusCode: 404 });
  }

  if (!bill.customer_gstin) {
    throw Object.assign(new Error('Cannot generate B2B e-invoice: customer GSTIN is missing'), { statusCode: 400 });
  }

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(bill.order_id) as any;
  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ? AND status != ?').all(bill.order_id, 'cancelled') as any[];

  const settingsRows = db.prepare("SELECT key, value FROM settings WHERE key IN ('business_name', 'business_address', 'business_phone', 'tax_registration_number', 'state_code', 'postal_code')").all() as any[];
  const settings: Record<string, string> = {};
  for (const s of settingsRows) {
    settings[s.key] = s.value;
  }

  const sellerGstin = settings.tax_registration_number;
  if (!sellerGstin) {
    throw Object.assign(new Error('Store GSTIN is not configured in settings'), { statusCode: 400 });
  }

  const dateObj = new Date(bill.created_at || now());
  const formattedDate = `${String(dateObj.getDate()).padStart(2, '0')}/${String(dateObj.getMonth() + 1).padStart(2, '0')}/${dateObj.getFullYear()}`;

  const sellerStateCode = sellerGstin.substring(0, 2);
  const buyerStateCode = bill.customer_gstin.substring(0, 2);
  const isInterState = sellerStateCode !== buyerStateCode;

  let totalAssVal = 0;
  let totalCgst = 0;
  let totalSgst = 0;
  let totalIgst = 0;

  const itemList: EinvoiceIrpPayload['ItemList'] = [];

  for (let idx = 0; idx < items.length; idx++) {
    const item = items[idx];
    const product = db.prepare('SELECT hsn_sac FROM products WHERE id = ?').get(item.product_id) as any;
    const hsn = product?.hsn_sac || '996331';

    const qty = Number(item.quantity) || 1;
    const unitRate = Number(item.unit_price) || 0;
    const totAmt = Number((qty * unitRate).toFixed(2));
    const discount = Number(item.discount_amount || 0);
    const assAmt = Number(Math.max(0, totAmt - discount).toFixed(2));

    // Determine GST rate: default to 5% for restaurant services
    const gstRate = 5;
    let cgst = 0;
    let sgst = 0;
    let igst = 0;

    if (isInterState) {
      igst = Number(((assAmt * gstRate) / 100).toFixed(2));
    } else {
      cgst = Number(((assAmt * (gstRate / 2)) / 100).toFixed(2));
      sgst = Number(((assAmt * (gstRate / 2)) / 100).toFixed(2));
    }

    const totItemVal = Number((assAmt + cgst + sgst + igst).toFixed(2));

    totalAssVal += assAmt;
    totalCgst += cgst;
    totalSgst += sgst;
    totalIgst += igst;

    itemList.push({
      SlNo: String(idx + 1),
      PrdDesc: item.product_name || 'Food & Beverage',
      IsServc: 'Y',
      HsnCd: hsn,
      Qty: qty,
      UnitRate: unitRate,
      TotAmt: totAmt,
      Discount: discount,
      AssAmt: assAmt,
      GstRt: gstRate,
      IgstAmt: igst,
      CgstAmt: cgst,
      SgstAmt: sgst,
      TotItemVal: totItemVal,
    });
  }

  const roundOff = Number(bill.round_off || 0);
  const totalInvVal = Number(bill.total || (totalAssVal + totalCgst + totalSgst + totalIgst + roundOff));

  return {
    Version: '1.1',
    TranDtls: {
      TaxSch: 'GST',
      SupTyp: 'B2B',
      RegRev: 'N',
      IgstOnIntra: 'N',
    },
    DocDtls: {
      Typ: 'INV',
      No: bill.bill_number,
      Dt: formattedDate,
    },
    SellerDtls: {
      Gstin: sellerGstin,
      LglNm: settings.business_name || 'Restaurant Outlet',
      Addr1: settings.business_address || 'Outlet Address',
      Loc: 'City',
      Pin: Number(settings.postal_code) || 560001,
      Stcd: sellerStateCode,
      Ph: settings.business_phone || undefined,
    },
    BuyerDtls: {
      Gstin: bill.customer_gstin,
      LglNm: bill.customer_legal_name || 'Corporate Customer',
      Pos: buyerStateCode,
      Addr1: 'Customer Registered Address',
      Loc: 'City',
      Pin: Number(buyerStateCode + '0001') || 110001,
      Stcd: buyerStateCode,
    },
    ItemList: itemList,
    ValDtls: {
      AssVal: Number(totalAssVal.toFixed(2)),
      CgstVal: Number(totalCgst.toFixed(2)),
      SgstVal: Number(totalSgst.toFixed(2)),
      IgstVal: Number(totalIgst.toFixed(2)),
      CesVal: 0,
      RndOffAmt: roundOff,
      TotInvVal: totalInvVal,
    },
  };
}
