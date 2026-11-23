import { Router, Request, Response } from 'express';
import { getDatabase } from '../db';
import { requireRole } from '../middleware/security';
import { ROLE_ACCESS } from '../../shared/role-permissions';
import { verifyAuditChain, detectAuditAnomalies } from '../services/audit';

const router = Router();

// Only owner and manager roles can inspect or export audit logs
router.use(requireRole(...ROLE_ACCESS.ownerManager));

/**
 * GET /api/audit-log
 * Filter audit records by date range, actor, action, entity type with pagination and CSV export
 */
router.get('/audit-log', (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const fromDate = req.query.from_date as string | undefined;
    const toDate = req.query.to_date as string | undefined;
    const actorUserId = req.query.actor_user_id as string | undefined;
    const action = req.query.action as string | undefined;
    const entityType = req.query.entity_type as string | undefined;
    const severity = req.query.severity as string | undefined;
    const format = req.query.format as string | undefined;

    const limit = Math.min(Math.max(parseInt(req.query.limit as string, 10) || 50, 1), 1000);
    const offset = Math.max(parseInt(req.query.offset as string, 10) || 0, 0);

    const conditions: string[] = [];
    const params: any[] = [];

    if (fromDate) {
      conditions.push('ts >= ?');
      params.push(fromDate);
    }
    if (toDate) {
      conditions.push('ts <= ?');
      params.push(toDate);
    }
    if (actorUserId) {
      conditions.push('actor_user_id = ?');
      params.push(actorUserId);
    }
    if (action) {
      conditions.push('action = ?');
      params.push(action);
    }
    if (entityType) {
      conditions.push('entity_type = ?');
      params.push(entityType);
    }
    if (severity) {
      conditions.push('severity = ?');
      params.push(severity);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRow = db.prepare(`SELECT COUNT(*) as total FROM audit_log ${whereClause}`).get(...params) as { total: number };
    const total = countRow?.total || 0;

    const rows = db.prepare(`
      SELECT id, ts, tenant_id, actor_user_id, actor_role, terminal_id,
             action, entity_type, entity_id, before_json, after_json,
             reason, approver_user_id, ip, severity, prev_hash, row_hash
      FROM audit_log
      ${whereClause}
      ORDER BY id DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset) as any[];

    if (format === 'csv') {
      const headers = ['id', 'ts', 'actor_user_id', 'actor_role', 'action', 'entity_type', 'entity_id', 'reason', 'approver_user_id', 'severity', 'row_hash'];
      const escapeCsv = (val: any) => {
        if (val === null || val === undefined) return '';
        const s = String(val).replace(/"/g, '""');
        return `"${s}"`;
      };

      const csvLines = [headers.join(',')];
      for (const r of rows) {
        csvLines.push([
          r.id,
          escapeCsv(r.ts),
          escapeCsv(r.actor_user_id),
          escapeCsv(r.actor_role),
          escapeCsv(r.action),
          escapeCsv(r.entity_type),
          escapeCsv(r.entity_id),
          escapeCsv(r.reason),
          escapeCsv(r.approver_user_id),
          escapeCsv(r.severity),
          escapeCsv(r.row_hash),
        ].join(','));
      }

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="audit_log_export.csv"');
      res.send(csvLines.join('\n'));
      return;
    }

    res.json({
      ok: true,
      total,
      limit,
      offset,
      data: rows,
    });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * GET /api/audit-log/verify
 * Cryptographic validation of audit log tamper-evident hash chain
 */
router.get('/audit-log/verify', (_req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const result = verifyAuditChain(db);
    res.json({ ok: true, ...result });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * GET /api/audit-log/anomalies
 * Detect suspicious operational signals (high void rates, post-closing refunds, repeated no-sale drawer opens)
 */
router.get('/audit-log/anomalies', (req: Request, res: Response) => {
  try {
    const db = getDatabase();
    const days = parseInt(req.query.days as string, 10) || 7;
    const report = detectAuditAnomalies(db, days);
    res.json({ ok: true, ...report });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

export const auditLogRoutes = router;
