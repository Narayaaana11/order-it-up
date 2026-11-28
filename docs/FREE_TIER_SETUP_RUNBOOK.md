# Free-Tier Integration Setup Runbook

This runbook explains how to activate the zero-dependency free-tier integrations wired into Order It Up. Every integration is **offline-first** and **no-ops gracefully** when its environment variables are omitted.

---

## 1. Transactional Email (Resend / Brevo)
- **Code:** [email-provider.ts](file:///d:/narayana/order-it-up/main/services/email-provider.ts)
- **Setup:**
  1. Sign up at [Resend](https://resend.com) (3,000 emails/mo) or [Brevo](https://www.brevo.com/) (9,000 emails/mo).
  2. Verify your sending domain's SPF/DKIM/DMARC records using [IntoDNS.ai](https://intodns.ai).
  3. Set `RESEND_API_KEY` (or `BREVO_API_KEY`) and `OIU_EMAIL_FROM` in `.env` and Cloudflare Worker secrets (`npx wrangler secret put RESEND_API_KEY`).

## 2. Offsite Backups (Cloudflare R2 / Backblaze B2 + Healthchecks.io)
- **Code:** [amazon-s3.ts](file:///d:/narayana/order-it-up/main/services/amazon-s3.ts), [backup-service.ts](file:///d:/narayana/order-it-up/backend/src/services/backup-service.ts), [index.ts](file:///d:/narayana/order-it-up/apps/cloud-api/src/index.ts)
- **Setup:**
  1. Create a bucket in **Cloudflare R2** (10 GB/mo free, zero egress) or **Backblaze B2** (10 GB free).
  2. Configure S3 credentials + custom endpoint in POS backup settings or `.env`.
  3. Create two checks in [Healthchecks.io](https://healthchecks.io) (20 checks free):
     - Set `HEALTHCHECKS_BACKUP_URL` in Oracle Cloud `backend/` `.env`.
     - Set `HEALTHCHECKS_CRON_URL` via `npx wrangler secret put HEALTHCHECKS_CRON_URL` for the Cloud Worker daily cron (`17 3 * * *`).

## 3. Error Tracking & Crash Reporting (Sentry / GlitchTip / Bugsink)
- **Code:** [free-tier-observability.ts](file:///d:/narayana/order-it-up/main/services/free-tier-observability.ts)
- **Setup:**
  1. Create a project in [Sentry](https://sentry.io/) (5K errors/mo), [GlitchTip](https://glitchtip.com/), or [Bugsink](https://www.bugsink.com/).
  2. Copy the DSN and set `OIU_SENTRY_DSN` in `.env`.

## 4. Product Analytics & Feature Flags (Aptabase / PostHog / GrowthBook)
- **Code:** [free-tier-observability.ts](file:///d:/narayana/order-it-up/main/services/free-tier-observability.ts), [telemetry.ts](file:///d:/narayana/order-it-up/main/services/telemetry.ts)
- **Setup:**
  1. **Aptabase** (Electron & Flutter): Set `OIU_APTABASE_APP_KEY` in `.env`.
  2. **PostHog** (Web/QR): Set `OIU_POSTHOG_API_KEY` in `.env`.
  3. **GrowthBook** (Feature Flags): Set `OIU_GROWTHBOOK_CLIENT_KEY` in `.env`.

## 5. LLM Tracing (Langfuse)
- **Code:** [openrouter.ts](file:///d:/narayana/order-it-up/main/services/openrouter.ts)
- **Setup:**
  1. Create a project in [Langfuse](https://langfuse.com/) (50K observations/mo free).
  2. Set `LANGFUSE_PUBLIC_KEY` and `LANGFUSE_SECRET_KEY` in `.env`.

## 6. Local QR & Webhook Testing (Cloudflare Tunnel)
- **Command:** `npm run tunnel:dev`
- Exposes `http://localhost:3001` via a temporary `trycloudflare.com` HTTPS URL with zero account setup for testing mobile QR ordering and Razorpay webhooks.

## 7. Security & Mobile CI/CD
- **Security CI:** [.github/workflows/security.yml](file:///d:/narayana/order-it-up/.github/workflows/security.yml) runs Gitleaks, Semgrep, and `npm audit`. Optionally add `SEMGREP_APP_TOKEN` to GitHub Repository Secrets.
- **Mobile CI:** Connect the repo in [Codemagic](https://codemagic.io/) using [codemagic.yaml](file:///d:/narayana/order-it-up/mobile/codemagic.yaml) for Android APK/AAB and unsigned iOS IPA builds.
