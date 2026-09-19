import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { getDatabase, now, getSettingValue, localDateInTimezone } from '../db';
import { requireRole } from '../middleware/security';
import { ROLE_ACCESS } from '../../shared/role-permissions';
import { asyncHandler } from '../middleware/async-handler';

const router = Router();

function tenantTimezone(): string {
  return getSettingValue('timezone') || 'Asia/Kolkata';
}

function todayDate(): string {
  return localDateInTimezone(new Date(), tenantTimezone());
}

router.get('/', requireRole(...ROLE_ACCESS.ownerManagerCashier), asyncHandler(async (req: Request, res: Response) => {
  const db = getDatabase();
  const { date, status } = req.query;
  const targetDate = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : todayDate();

  let sql = `
    SELECT r.*, t.number as table_number, t.capacity as table_capacity
    FROM table_reservations r
    LEFT JOIN tables t ON t.id = r.table_id
    WHERE r.reservation_date = ?
  `;
  const params: any[] = [targetDate];

  if (status && typeof status === 'string') {
    sql += ' AND r.status = ?';
    params.push(status);
  }

  sql += ' ORDER BY r.reservation_time ASC';
  const reservations = db.prepare(sql).all(...params);

  res.json({ ok: true, date: targetDate, reservations });
}));

router.post('/', requireRole(...ROLE_ACCESS.ownerManagerCashier), asyncHandler(async (req: Request, res: Response) => {
  const { table_id, customer_name, customer_phone, guest_count, reservation_date, reservation_time, notes } = req.body || {};

  if (!customer_name || !customer_phone || !reservation_time) {
    return res.status(400).json({ error: 'customer_name, customer_phone, and reservation_time are required' });
  }

  const db = getDatabase();
  const resId = `res_${randomUUID()}`;
  const resDate = typeof reservation_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(reservation_date) ? reservation_date : todayDate();
  const guests = Math.max(1, Number(guest_count) || 2);
  const timestamp = now();

  db.transaction(() => {
    db.prepare(`
      INSERT INTO table_reservations (id, table_id, customer_name, customer_phone, guest_count, reservation_date, reservation_time, status, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'confirmed', ?, ?, ?)
    `).run(
      resId,
      table_id || null,
      customer_name.trim(),
      customer_phone.trim(),
      guests,
      resDate,
      reservation_time,
      notes || null,
      timestamp,
      timestamp
    );

    // If assigned to a table for today, update table status to reserved
    if (table_id && resDate === todayDate()) {
      db.prepare(`
        UPDATE tables
        SET status = 'reserved', updated_at = ?
        WHERE id = ? AND status = 'available'
      `).run(timestamp, table_id);
    }
  })();

  const created = db.prepare(`
    SELECT r.*, t.number as table_number
    FROM table_reservations r
    LEFT JOIN tables t ON t.id = r.table_id
    WHERE r.id = ?
  `).get(resId);

  res.status(201).json({ ok: true, reservation: created });
}));

router.patch('/:id/status', requireRole(...ROLE_ACCESS.ownerManagerCashier), asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body || {};
  const validStatuses = ['confirmed', 'seated', 'completed', 'cancelled', 'no_show'];

  if (!status || !validStatuses.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${validStatuses.join(', ')}` });
  }

  const db = getDatabase();
  const resRow = db.prepare('SELECT * FROM table_reservations WHERE id = ?').get(id) as any;
  if (!resRow) return res.status(404).json({ error: 'Reservation not found' });

  const timestamp = now();

  db.transaction(() => {
    db.prepare('UPDATE table_reservations SET status = ?, updated_at = ? WHERE id = ?')
      .run(status, timestamp, id);

    if (resRow.table_id) {
      if (status === 'seated') {
        db.prepare("UPDATE tables SET status = 'occupied', updated_at = ? WHERE id = ?")
          .run(timestamp, resRow.table_id);
      } else if (status === 'completed' || status === 'cancelled' || status === 'no_show') {
        db.prepare("UPDATE tables SET status = 'available', updated_at = ? WHERE id = ?")
          .run(timestamp, resRow.table_id);
      }
    }
  })();

  const updated = db.prepare('SELECT * FROM table_reservations WHERE id = ?').get(id);
  res.json({ ok: true, reservation: updated });
}));

export const reservationRoutes = router;
