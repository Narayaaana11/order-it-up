import { Env } from './pairing';

export async function handleListTransfers(request: Request, env: Env, orgId: string): Promise<Response> {
  const rows = await env.DB.prepare(`
    SELECT
      t.*,
      sb.name as source_branch_name,
      db.name as dest_branch_name
    FROM inventory_transfers t
    JOIN branches sb ON t.source_branch_id = sb.id
    JOIN branches db ON t.dest_branch_id = db.id
    WHERE t.organization_id = ?
    ORDER BY t.created_at DESC
  `).bind(orgId).all<any>();

  const transfers = rows.results.map(r => ({
    ...r,
    items: JSON.parse(r.items_json || '[]')
  }));

  return Response.json({ transfers });
}

export async function handleCreateTransfer(request: Request, env: Env, orgId: string): Promise<Response> {
  const body = await request.json() as any;
  if (!body.source_branch_id || !body.dest_branch_id || !Array.isArray(body.items)) {
    return Response.json({ error: 'source_branch_id, dest_branch_id, and items array required' }, { status: 400 });
  }

  const branches = await env.DB.prepare('SELECT id FROM branches WHERE id IN (?, ?) AND organization_id = ?')
    .bind(body.source_branch_id, body.dest_branch_id, orgId).all();
  if (branches.results.length < 2 && body.source_branch_id !== body.dest_branch_id) {
    return Response.json({ error: 'Source or destination branch not found or belongs to another organization' }, { status: 404 });
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await env.DB.prepare(`
    INSERT INTO inventory_transfers (
      id, organization_id, source_branch_id, dest_branch_id,
      status, items_json, requested_by, notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    orgId,
    body.source_branch_id,
    body.dest_branch_id,
    'pending',
    JSON.stringify(body.items),
    body.requested_by || 'Branch Staff',
    body.notes || null,
    now,
    now
  ).run();

  return Response.json({ success: true, id, status: 'pending' });
}

export async function handleUpdateTransferStatus(request: Request, env: Env, transferId: string, orgId?: string): Promise<Response> {
  const body = await request.json() as { status: string; approved_by?: string };
  const allowed = ['pending', 'dispatched', 'received', 'rejected'];
  if (!allowed.includes(body.status)) {
    return Response.json({ error: 'Invalid transfer status' }, { status: 400 });
  }

  if (orgId) {
    const transfer = await env.DB.prepare('SELECT id FROM inventory_transfers WHERE id = ? AND organization_id = ?')
      .bind(transferId, orgId).first();
    if (!transfer) {
      return Response.json({ error: 'Transfer not found or belongs to another organization' }, { status: 404 });
    }
  }

  const now = new Date().toISOString();
  await env.DB.prepare(`
    UPDATE inventory_transfers
    SET status = ?, approved_by = COALESCE(?, approved_by), updated_at = ?
    WHERE id = ?
  `).bind(body.status, body.approved_by || null, now, transferId).run();

  return Response.json({ success: true, transfer_id: transferId, status: body.status });
}
