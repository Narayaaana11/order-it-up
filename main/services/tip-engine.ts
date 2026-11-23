import { randomUUID } from 'crypto';
import { getDatabase, now, localDateInTimezone, getSettingValue } from '../db';
import { recordAudit } from './audit';
import log from 'electron-log';

export interface TipDistributionResult {
  id: string;
  date: string;
  shift_id: string | null;
  total_tips: number;
  distribution_rule: string;
  allocations: {
    userId: string;
    staffName: string;
    role: string;
    allocatedAmount: number;
  }[];
}

export interface TipSummary {
  date: string;
  totalTipsCollected: number;
  totalTipsDistributed: number;
  pendingTips: number;
  recentDistributions: any[];
  staffBreakdown: {
    userId: string;
    staffName: string;
    role: string;
    totalEarned: number;
  }[];
}

/**
 * Distributes accumulated tips for a date or shift across active staff.
 */
export function distributeTips(params: {
  date?: string;
  shiftId?: string;
  distributionRule?: 'equal_split' | 'hours_worked' | 'points_percentage';
  staffIds?: string[];
}): TipDistributionResult {
  const db = getDatabase();
  const timezone = getSettingValue('timezone') || 'Asia/Kolkata';
  const targetDate = params.date || localDateInTimezone(new Date(), timezone);
  const rule = params.distributionRule || 'equal_split';

  // 1. Calculate undistributed tips collected on that date
  const tipAgg = db.prepare(`
    SELECT COALESCE(SUM(tip_amount), 0) AS total_tips
    FROM bills
    WHERE date(created_at) = date(?) AND tip_amount > 0 AND payment_status = 'paid'
  `).get(targetDate) as { total_tips: number };

  const totalCollected = Number(tipAgg?.total_tips || 0);

  const alreadyDistributed = db.prepare(`
    SELECT COALESCE(SUM(total_tips), 0) AS distributed
    FROM tip_distributions
    WHERE date = ?
  `).get(targetDate) as { distributed: number };

  const poolToDistribute = Math.max(0, Math.round((totalCollected - Number(alreadyDistributed?.distributed || 0)) * 100) / 100);

  if (poolToDistribute <= 0) {
    throw Object.assign(new Error(`No undistributed tips available for date ${targetDate} (Total collected: ${totalCollected})`), { statusCode: 400 });
  }

  // 2. Identify eligible staff
  let staffList: { id: string; name: string; role: string }[] = [];
  if (params.staffIds && params.staffIds.length > 0) {
    const placeholders = params.staffIds.map(() => '?').join(',');
    staffList = db.prepare(`
      SELECT id, name, role FROM users
      WHERE id IN (${placeholders}) AND is_active = 1
    `).all(...params.staffIds) as any[];
  } else {
    staffList = db.prepare(`
      SELECT id, name, role FROM users
      WHERE role IN ('server', 'waiter', 'cashier', 'chef', 'manager') AND is_active = 1
    `).all() as any[];
  }

  if (staffList.length === 0) {
    throw Object.assign(new Error('No active staff found for tip distribution'), { statusCode: 400 });
  }

  const distributionId = `tip_dist_${randomUUID()}`;
  const timestamp = now();
  const allocations: TipDistributionResult['allocations'] = [];

  db.transaction(() => {
    db.prepare(`
      INSERT INTO tip_distributions (id, date, shift_id, total_tips, distribution_rule, status, created_at)
      VALUES (?, ?, ?, ?, ?, 'completed', ?)
    `).run(distributionId, targetDate, params.shiftId || null, poolToDistribute, rule, timestamp);

    const stmtAlloc = db.prepare(`
      INSERT INTO tip_allocations (id, distribution_id, user_id, staff_name, role, allocated_amount, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    if (rule === 'points_percentage') {
      // Servers: 60% pool, Kitchen/Cashiers: 40% pool
      const frontStaff = staffList.filter(s => ['server', 'waiter'].includes(s.role));
      const backStaff = staffList.filter(s => !['server', 'waiter'].includes(s.role));

      const frontPool = backStaff.length > 0 ? poolToDistribute * 0.6 : poolToDistribute;
      const backPool = frontStaff.length > 0 ? poolToDistribute * 0.4 : poolToDistribute;

      for (const staff of frontStaff) {
        const share = Math.round((frontPool / frontStaff.length) * 100) / 100;
        const allocId = `tip_alloc_${randomUUID()}`;
        stmtAlloc.run(allocId, distributionId, staff.id, staff.name, staff.role, share, timestamp);
        allocations.push({ userId: staff.id, staffName: staff.name, role: staff.role, allocatedAmount: share });
      }
      for (const staff of backStaff) {
        const share = Math.round((backPool / backStaff.length) * 100) / 100;
        const allocId = `tip_alloc_${randomUUID()}`;
        stmtAlloc.run(allocId, distributionId, staff.id, staff.name, staff.role, share, timestamp);
        allocations.push({ userId: staff.id, staffName: staff.name, role: staff.role, allocatedAmount: share });
      }
    } else {
      // Equal split with exact penny balancing to guarantee 0 rounding leakage
      const count = staffList.length;
      const baseShare = Math.floor((poolToDistribute / count) * 100) / 100;
      let remainder = Math.round((poolToDistribute - (baseShare * count)) * 100) / 100;

      for (let i = 0; i < staffList.length; i++) {
        const staff = staffList[i];
        let share = baseShare;
        if (remainder > 0.005) {
          share = Math.round((share + 0.01) * 100) / 100;
          remainder = Math.round((remainder - 0.01) * 100) / 100;
        }
        const allocId = `tip_alloc_${randomUUID()}`;
        stmtAlloc.run(allocId, distributionId, staff.id, staff.name, staff.role, share, timestamp);
        allocations.push({ userId: staff.id, staffName: staff.name, role: staff.role, allocatedAmount: share });
      }
    }

    try {
      recordAudit(db, {
        action: 'cash_closure_close',
        entity_type: 'tip_distribution',
        entity_id: distributionId,
        after_json: { total_tips: poolToDistribute, staff_count: staffList.length, rule },
        reason: `Tip pool distributed: ${poolToDistribute} across ${staffList.length} staff`,
        severity: 'info',
      });
    } catch {}
  })();

  log.info(`[Tips] Distributed ${poolToDistribute} tips across ${staffList.length} staff members (Dist ID: ${distributionId})`);

  return {
    id: distributionId,
    date: targetDate,
    shift_id: params.shiftId || null,
    total_tips: poolToDistribute,
    distribution_rule: rule,
    allocations,
  };
}

/**
 * Returns tip collections, distributions, and staff earnings summary.
 */
export function getTipSummary(date?: string): TipSummary {
  const db = getDatabase();
  const timezone = getSettingValue('timezone') || 'Asia/Kolkata';
  const targetDate = date || localDateInTimezone(new Date(), timezone);

  const collectedRow = db.prepare(`
    SELECT COALESCE(SUM(tip_amount), 0) AS total
    FROM bills
    WHERE date(created_at) = date(?) AND tip_amount > 0 AND payment_status = 'paid'
  `).get(targetDate) as { total: number };

  const distributedRow = db.prepare(`
    SELECT COALESCE(SUM(total_tips), 0) AS total
    FROM tip_distributions
    WHERE date = ?
  `).get(targetDate) as { total: number };

  const totalCollected = Number(collectedRow?.total || 0);
  const totalDistributed = Number(distributedRow?.total || 0);

  const recentDists = db.prepare(`
    SELECT * FROM tip_distributions
    ORDER BY created_at DESC
    LIMIT 20
  `).all();

  const staffEarnings = db.prepare(`
    SELECT user_id, staff_name, role, COALESCE(SUM(allocated_amount), 0) AS total_earned
    FROM tip_allocations
    GROUP BY user_id, staff_name, role
    ORDER BY total_earned DESC
  `).all() as any[];

  return {
    date: targetDate,
    totalTipsCollected: totalCollected,
    totalTipsDistributed: totalDistributed,
    pendingTips: Math.max(0, Math.round((totalCollected - totalDistributed) * 100) / 100),
    recentDistributions: recentDists,
    staffBreakdown: staffEarnings.map(s => ({
      userId: s.user_id,
      staffName: s.staff_name,
      role: s.role,
      totalEarned: Number(s.total_earned || 0),
    })),
  };
}
