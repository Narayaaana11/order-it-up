/**
 * License Heartbeat Service
 *
 * Checks in with the cloud licensing server every 24 hours to synchronize
 * the local subscription state from Cloudflare D1. Operates in the background
 * and is completely transparent to the user.
 *
 * Offline-first guarantees:
 * - If the cloud is unreachable, the last-known state remains operational
 *   until the offline cache is older than OFFLINE_GRACE_DAYS (7 days).
 * - After OFFLINE_GRACE_DAYS, the app logs a warning but continues operating
 *   to avoid punishing legitimate connectivity outages.
 * - Hard enforcement is left to the cloud-side lifecycle transitions, not to
 *   the client-side timer, to avoid race conditions.
 */
import log from 'electron-log';
import { getDatabase, now } from '../db';
import { subscriptionService, type CloudSubscriptionPayload } from './subscription';

const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const OFFLINE_GRACE_DAYS = 7;
const REQUEST_TIMEOUT_MS = 15_000;

const SETTING_LAST_CHECKED = 'subscription_last_checked_at';
const SETTING_CLOUD_URL    = 'cloud_base_url';
const SETTING_CLOUD_TOKEN  = 'cloud_auth_token';

function readSetting(key: string): string | null {
  try {
    const db = getDatabase();
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
    return row?.value ?? null;
  } catch {
    return null;
  }
}

function writeSetting(key: string, value: string): void {
  try {
    const db = getDatabase();
    db.prepare(`
      INSERT INTO settings (key, value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `).run(key, value, now());
  } catch {
    // Non-fatal — the in-memory state is still valid
  }
}

function daysSince(isoDate: string | null): number {
  if (!isoDate) return Infinity;
  const diff = Date.now() - new Date(isoDate).getTime();
  return diff / (1000 * 60 * 60 * 24);
}

export class LicenseHeartbeat {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private checking = false;

  /** Start the periodic heartbeat. Call once after the app is ready. */
  start(): void {
    // Run immediately on startup, then every 24 hours
    void this.check();
    this.intervalId = setInterval(() => { void this.check(); }, CHECK_INTERVAL_MS);
    log.info('[LicenseHeartbeat] Started (24h interval)');
  }

  /** Stop the heartbeat (called on app shutdown). */
  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    log.info('[LicenseHeartbeat] Stopped');
  }

  /** Force an immediate check (e.g., after a manual subscription purchase). */
  async forceCheck(): Promise<void> {
    await this.check();
  }

  private async check(): Promise<void> {
    if (this.checking) return; // Prevent overlapping checks
    this.checking = true;
    try {
      await this.doCheck();
    } finally {
      this.checking = false;
    }
  }

  private async doCheck(): Promise<void> {
    const cloudBaseUrl = readSetting(SETTING_CLOUD_URL);
    const authToken    = readSetting(SETTING_CLOUD_TOKEN);
    const lastChecked  = readSetting(SETTING_LAST_CHECKED);

    if (!cloudBaseUrl || !authToken) {
      // Not registered with cloud — running in fully local mode
      log.debug('[LicenseHeartbeat] No cloud credentials; skipping check');
      return;
    }

    const hoursSince = daysSince(lastChecked) * 24;
    if (hoursSince < 23.5) {
      // Already checked in the last ~24h — skip to avoid unnecessary API calls
      log.debug('[LicenseHeartbeat] Recent check found (%.1f h ago); skipping', hoursSince);
      return;
    }

    log.info('[LicenseHeartbeat] Checking subscription status with cloud...');

    let payload: CloudSubscriptionPayload;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      const response = await fetch(`${cloudBaseUrl}/api/subscription`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        log.warn('[LicenseHeartbeat] Cloud returned HTTP %d; keeping cached state', response.status);
        this.handleOfflineGrace(lastChecked);
        return;
      }

      payload = await response.json() as CloudSubscriptionPayload;
    } catch (err) {
      log.warn('[LicenseHeartbeat] Network error:', err instanceof Error ? err.message : String(err));
      this.handleOfflineGrace(lastChecked);
      return;
    }

    const changed = subscriptionService.syncFromCloud(payload);
    writeSetting(SETTING_LAST_CHECKED, new Date().toISOString());
    log.info('[LicenseHeartbeat] Sync complete (changed=%s)', changed);
  }

  private handleOfflineGrace(lastChecked: string | null): void {
    const staleDays = daysSince(lastChecked);
    if (staleDays > OFFLINE_GRACE_DAYS) {
      log.warn(
        '[LicenseHeartbeat] Offline cache is %.1f days old (grace = %d days). ' +
        'Subscription status may be stale — advise user to reconnect.',
        staleDays,
        OFFLINE_GRACE_DAYS,
      );
      // We deliberately do NOT hard-lock here. Legitimate outages should not
      // brick a restaurant mid-service. The cloud lifecycle transitions handle
      // enforcement when connectivity is restored.
    } else {
      log.info(
        '[LicenseHeartbeat] Offline (%.1f days since last check). Cached state remains valid.',
        staleDays,
      );
    }
  }
}

export const licenseHeartbeat = new LicenseHeartbeat();
