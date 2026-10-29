import { Env } from './pairing';

export async function handleAccountantClosures(request: Request, env: Env, orgId: string): Promise<Response> {
  const url = new URL(request.url);
  const branchId = url.searchParams.get('branch_id');
  const dateFrom = url.searchParams.get('from') || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
  const dateTo = url.searchParams.get('to') || new Date().toISOString().split('T')[0];

  let query = `
    SELECT
      c.*,
      b.name as branch_name,
      b.code as branch_code
    FROM synced_cash_closures c
    JOIN branches b ON c.branch_id = b.id
    WHERE c.organization_id = ?
      AND c.closure_date >= ? AND c.closure_date <= ?
  `;
  const params: any[] = [orgId, dateFrom, dateTo];

  if (branchId) {
    query += ' AND c.branch_id = ?';
    params.push(branchId);
  }

  query += ' ORDER BY c.closure_date DESC, c.closed_at DESC';

  const rows = await env.DB.prepare(query).bind(...params).all();

  return Response.json({
    closures: rows.results,
    count: rows.results.length,
    date_from: dateFrom,
    date_to: dateTo,
  });
}

export async function handleAccountantTaxSummary(request: Request, env: Env, orgId: string): Promise<Response> {
  const url = new URL(request.url);
  const dateFrom = url.searchParams.get('from') || new Date(Date.now() - 30 * 86400000).toISOString();
  const dateTo = url.searchParams.get('to') || new Date().toISOString();

  const taxRows = await env.DB.prepare(`
    SELECT
      o.branch_id,
      b.name as branch_name,
      b.code as branch_code,
      COUNT(o.id) as total_bills,
      SUM(o.subtotal) as taxable_amount,
      SUM(o.tax_total) as tax_collected,
      SUM(o.discount_total) as total_discounts,
      SUM(o.grand_total) as gross_turnover
    FROM synced_orders o
    JOIN branches b ON o.branch_id = b.id
    WHERE o.organization_id = ?
      AND o.ordered_at >= ? AND o.ordered_at <= ?
      AND o.status != 'cancelled'
    GROUP BY o.branch_id
    ORDER BY gross_turnover DESC
  `).bind(orgId, dateFrom, dateTo).all();

  return Response.json({
    date_from: dateFrom,
    date_to: dateTo,
    tax_by_branch: taxRows.results
  });
}

export async function handleTallyExport(request: Request, env: Env, orgId: string): Promise<Response> {
  const url = new URL(request.url);
  const branchId = url.searchParams.get('branch_id');
  const dateFrom = url.searchParams.get('from') || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
  const dateTo = url.searchParams.get('to') || new Date().toISOString().split('T')[0];

  let query = `
    SELECT c.*, b.name as branch_name
    FROM synced_cash_closures c
    JOIN branches b ON c.branch_id = b.id
    WHERE c.organization_id = ? AND c.closure_date >= ? AND c.closure_date <= ?
  `;
  const params: any[] = [orgId, dateFrom, dateTo];
  if (branchId) {
    query += ' AND c.branch_id = ?';
    params.push(branchId);
  }

  const rows = await env.DB.prepare(query).bind(...params).all<any>();

  // Generate Tally-compatible XML voucher format
  let xml = `<?xml version="1.0" encoding="utf-8"?>\n<ENVELOPE>\n  <HEADER>\n    <TALLYREQUEST>Import Data</TALLYREQUEST>\n  </HEADER>\n  <BODY>\n    <IMPORTDATA>\n      <REQUESTDESC>\n        <REPORTNAME>Vouchers</REPORTNAME>\n      </REQUESTDESC>\n      <REQUESTDATA>\n`;

  for (const row of rows.results) {
    const formattedDate = row.closure_date.replace(/-/g, '');
    xml += `        <TALLYMESSAGE xmlns:UDF="TallyUDF">\n`;
    xml += `          <VOUCHER VCHTYPE="Receipt" ACTION="Create">\n`;
    xml += `            <DATE>${formattedDate}</DATE>\n`;
    xml += `            <NARRATION>Daily POS Sales - ${row.branch_name} (${row.closure_date})</NARRATION>\n`;
    xml += `            <VOUCHERNUMBER>POS-${row.branch_name}-${row.closure_date}</VOUCHERNUMBER>\n`;
    xml += `            <ALLLEDGERENTRIES.LIST>\n`;
    xml += `              <LEDGERNAME>Cash Account</LEDGERNAME>\n`;
    xml += `              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>\n`;
    xml += `              <AMOUNT>-${row.cash_sales || 0}</AMOUNT>\n`;
    xml += `            </ALLLEDGERENTRIES.LIST>\n`;
    xml += `            <ALLLEDGERENTRIES.LIST>\n`;
    xml += `              <LEDGERNAME>Bank / UPI Account</LEDGERNAME>\n`;
    xml += `              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>\n`;
    xml += `              <AMOUNT>-${(row.card_sales || 0) + (row.upi_sales || 0)}</AMOUNT>\n`;
    xml += `            </ALLLEDGERENTRIES.LIST>\n`;
    xml += `            <ALLLEDGERENTRIES.LIST>\n`;
    xml += `              <LEDGERNAME>Restaurant Sales</LEDGERNAME>\n`;
    xml += `              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>\n`;
    xml += `              <AMOUNT>${(row.cash_sales || 0) + (row.card_sales || 0) + (row.upi_sales || 0) + (row.other_sales || 0)}</AMOUNT>\n`;
    xml += `            </ALLLEDGERENTRIES.LIST>\n`;
    xml += `          </VOUCHER>\n`;
    xml += `        </TALLYMESSAGE>\n`;
  }

  xml += `      </REQUESTDATA>\n    </IMPORTDATA>\n  </BODY>\n</ENVELOPE>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Content-Disposition': `attachment; filename="tally_export_${dateFrom}_${dateTo}.xml"`
    }
  });
}
