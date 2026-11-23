/**
 * System Diagnostics & Health API
 *
 * Provides real-time operational diagnostics for offline-first restaurant deployments:
 * SQLite WAL checkpoint status, database integrity, file sizes, outbox queue lag,
 * and memory metrics.
 */

import { Router, Request, Response } from 'express';
import { getDatabase, getCurrentSchemaVersion, getDbPath, now } from '../db';
import { requireRole } from '../middleware/security';
import { ROLE_ACCESS } from '../../shared/role-permissions';
import { asyncHandler } from '../middleware/async-handler';
import fs from 'fs';
import path from 'path';

const router = Router();

export interface SystemHealthReport {
  status: 'ok' | 'degraded' | 'error';
  timestamp: string;
  uptime_seconds: number;
  database: {
    ok: boolean;
    schema_version: number;
    path: string;
    size_bytes: number;
    wal_size_bytes: number;
    integrity: string;
    wal_checkpoint: {
      busy: number;
      log: number;
      checkpointed: number;
    };
  };
  queues: {
    aggregator_outbox_pending: number;
    cloud_sync_outbox_pending: number;
    support_tickets_pending: number;
    diagnostics_pending: number;
  };
  memory: {
    rss_bytes: number;
    heap_used_bytes: number;
    heap_total_bytes: number;
  };
}

export function generateSystemHealthReport(): SystemHealthReport {
  const db = getDatabase();
  const dbPath = getDbPath();
  const walPath = `${dbPath}-wal`;

  let sizeBytes = 0;
  let walSizeBytes = 0;
  try {
    if (fs.existsSync(dbPath)) sizeBytes = fs.statSync(dbPath).size;
    if (fs.existsSync(walPath)) walSizeBytes = fs.statSync(walPath).size;
  } catch {
    // Non-fatal if stat fails
  }

  // Database integrity check
  let integrity = 'unknown';
  try {
    const row = db.prepare('PRAGMA integrity_check').get() as { integrity_check?: string } | undefined;
    integrity = row?.integrity_check || 'unknown';
  } catch (err: any) {
    integrity = `error: ${err.message}`;
  }

  // Passive WAL checkpoint status query
  let walCheckpoint = { busy: 0, log: 0, checkpointed: 0 };
  try {
    const cpRow = db.prepare('PRAGMA wal_checkpoint(PASSIVE)').get() as any;
    if (cpRow) {
      walCheckpoint = {
        busy: Number(cpRow.busy || 0),
        log: Number(cpRow.log || 0),
        checkpointed: Number(cpRow.checkpointed || 0),
      };
    }
  } catch {
    // Non-fatal
  }

  // Queue lags
  let aggregatorPending = 0;
  try {
    const row = db.prepare("SELECT COUNT(*) as c FROM aggregator_outbox WHERE status = 'pending'").get() as any;
    aggregatorPending = row?.c || 0;
  } catch {
    aggregatorPending = 0;
  }

  let cloudPending = 0;
  try {
    const row = db.prepare('SELECT COUNT(*) as c FROM cloud_sync_outbox').get() as any;
    cloudPending = row?.c || 0;
  } catch {
    cloudPending = 0;
  }

  let supportPending = 0;
  try {
    const row = db.prepare('SELECT COUNT(*) as c FROM support_ticket_outbox').get() as any;
    supportPending = row?.c || 0;
  } catch {
    supportPending = 0;
  }

  let diagPending = 0;
  try {
    const row = db.prepare('SELECT COUNT(*) as c FROM store_diagnostics_outbox').get() as any;
    diagPending = row?.c || 0;
  } catch {
    diagPending = 0;
  }

  const mem = process.memoryUsage();
  const isHealthy = integrity === 'ok';

  return {
    status: isHealthy ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime_seconds: Math.floor(process.uptime()),
    database: {
      ok: isHealthy,
      schema_version: getCurrentSchemaVersion(),
      path: dbPath,
      size_bytes: sizeBytes,
      wal_size_bytes: walSizeBytes,
      integrity,
      wal_checkpoint: walCheckpoint,
    },
    queues: {
      aggregator_outbox_pending: aggregatorPending,
      cloud_sync_outbox_pending: cloudPending,
      support_tickets_pending: supportPending,
      diagnostics_pending: diagPending,
    },
    memory: {
      rss_bytes: mem.rss,
      heap_used_bytes: mem.heapUsed,
      heap_total_bytes: mem.heapTotal,
    },
  };
}

// GET /api/system/health - Comprehensive system diagnostics report
router.get('/health', requireRole(...ROLE_ACCESS.ownerManagerCashier), asyncHandler(async (_req: Request, res: Response) => {
  const report = generateSystemHealthReport();
  res.status(report.status === 'ok' ? 200 : 503).json(report);
}));

// POST /api/system/wal-checkpoint - Truncate and flush WAL log to main DB file
router.post('/wal-checkpoint', requireRole(...ROLE_ACCESS.ownerManager), asyncHandler(async (_req: Request, res: Response) => {
  const db = getDatabase();
  try {
    const result = db.prepare('PRAGMA wal_checkpoint(TRUNCATE)').get() as any;
    res.json({
      ok: true,
      checkpoint: {
        busy: Number(result?.busy || 0),
        log: Number(result?.log || 0),
        checkpointed: Number(result?.checkpointed || 0),
      },
    });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message || 'WAL checkpoint failed' });
  }
}));

export const systemRoutes = router;
