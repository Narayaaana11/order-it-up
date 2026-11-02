# Order It Up (OIU) — Deployment Guide

## 1. Local POS Deployment (Windows / Linux)
1. **Prerequisites**: Node.js 22 LTS, npm 10+.
2. **Installation**:
   ```bash
   npm install
   ```
3. **Build Frontend & Backend**:
   ```bash
   npm run build:frontend
   npm run build
   ```
4. **Package Windows Installer**:
   ```bash
   npm run release:win
   ```
   The installer will be generated in the `dist/` directory as `order-it-up-1.0.0-win-x64.exe`.

## 2. Cloudflare Worker and D1

The cloud API runs as a Cloudflare Worker backed by D1. Before production changes, review [the D1 baseline reconciliation](docs/CLOUD_D1_BASELINE_RECONCILIATION.md). The production database currently has an empty migration ledger and schema drift; do not apply the checked-in migrations to production until the reconciliation is reviewed, exercised on an isolated restore, and authorized.

Install and inspect the Cloud API package:

```bash
cd apps/cloud-api
npm ci
npx wrangler whoami
```

Provision the Worker secrets through Cloudflare's secret manager. `JWT_SECRET`, `PLATFORM_ADMIN_EMAIL`, `PLATFORM_ADMIN_PASSWORD_HASH` (scrypt), and a distinct `PLATFORM_ADMIN_JWT_SECRET` are required for `/ready` to succeed. SaaS subscription checkout additionally requires live `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET` after merchant onboarding. Keep staging credentials isolated from production. See [the security and webhook setup](docs/SECURITY_BOOTSTRAP_AND_WEBHOOKS.md) for constraints.

After reviewed migrations have been applied and staging workflows have passed, deploy the Worker from `apps/cloud-api` with `npx wrangler deploy`. Then confirm `https://orderitup-cloud-api.narayaaana11.workers.dev/ready` returns HTTP 200 and `{"status":"ready"}`. The custom API domain can replace this URL after DNS and routing are verified. `/health` is only a liveness check; it does not verify D1 schema readiness.

## 3. Cloudflare Pages web and QR app

The static Cloud dashboard and customer QR experience are built from `frontend/` into `frontend/out/`:

```bash
npm ci --prefix frontend
npm run build:web
```

The build fails if `frontend/out/qr/index.html` is missing. Production Pages publishing is available only through the manually dispatched **Deploy Cloudflare Pages** GitHub Actions workflow on `main`. It requires the `production` environment secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`, a checked deployment confirmation, a ready Cloud API, and a successful post-deployment check of `https://orderitup.pages.dev/qr/`.

The Pages workflow does not deploy the Worker or migrate D1. Reconcile and validate the Worker/D1 release first; a successful static export alone does not establish that QR ordering works against production data.
