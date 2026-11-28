# Deploying Order It Up Unified Backend on Oracle Cloud (OCI)

This deployment bundle runs **one single Node.js 22 + SQLite WAL + WebSocket backend** (`apps/server`) behind **Caddy** (automatic HTTPS/TLS & WebSocket proxy) on an **Oracle Cloud Infrastructure (OCI) Compute VM** (ARM64 Ampere A1 Always Free or x64 Ubuntu).

## 1. OCI Compute VM & Network Setup

1. Create an **Ubuntu 22.04 / 24.04** Compute instance in OCI (recommended: `VM.Standard.A1.Flex`, 2–4 OCPUs, 12–24 GB RAM).
2. In **OCI Virtual Cloud Network (VCN) → Security Lists**, add Ingress Rules for:
   - `0.0.0.0/0` TCP port `80` (HTTP + ACME TLS challenge)
   - `0.0.0.0/0` TCP port `443` (HTTPS + WSS WebSockets)
3. SSH into the VM and open Ubuntu's local firewall (`iptables` / `ufw`):
   ```bash
   sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
   sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
   sudo netfilter-persistent save
   ```
4. Install Docker & Docker Compose:
   ```bash
   curl -fsSL https://get.docker.com | sudo sh
   sudo usermod -aG docker $USER
   newgrp docker
   ```

## 2. Configure Environment & Secrets

Generate `backend/.env.oracle` with random 64-character `JWT_SECRET`, `PLATFORM_ADMIN_JWT_SECRET`, and a valid `scrypt` `PLATFORM_ADMIN_PASSWORD_HASH`:
```bash
node scripts/bootstrap-oracle-env.cjs \
  --domain api.orderitup.in \
  --origins https://orderitup.in,https://app.orderitup.in \
  --admin-email admin@orderitup.in \
  --admin-password "<STRONG_PASSWORD>"
```
Or copy manually:
```bash
cp backend/.env.example backend/.env.oracle
```

Point your domain's DNS `A` record (`api.orderitup.in`) to the OCI VM's public IP, and set `DOMAIN=api.orderitup.in` in `backend/.env.oracle`.

## 3. Cloudflare Pages + Oracle Split Setup

When hosting `landing/` and `desktop-ui/` on **Cloudflare Pages** and this backend on **Oracle Cloud**:
- Set `FRONTEND_ORIGIN` in `backend/.env.oracle` to the exact comma-separated Cloudflare Pages / custom domain origins (no wildcards).
- In **Cloudflare DNS** for `api.orderitup.in`:
  - **Recommended:** Use **DNS-only (grey cloud)** so Caddy manages Let's Encrypt TLS and WebSockets (`/ws/kds`, `/ws/pos`) directly.
  - **If proxied (orange cloud):** Set Cloudflare **SSL/TLS → Full (Strict)** and enable **Network → WebSockets**.
- Configure GitHub Repository Variables for `.github/workflows/deploy-pages.yml`:
  - `CLOUD_API_URL` (e.g. `https://api.orderitup.in`)
  - `CF_PAGES_LANDING_PROJECT` (default `orderitup`)
  - `CF_PAGES_APP_PROJECT` (default `orderitup-app`)
  - `LANDING_PUBLIC_URL` and `APP_PUBLIC_URL`

*(Optional single-origin mode: run `npm run build:web` and uncomment the `../desktop-ui/out:/app/static:ro` mount in `backend/docker-compose.yml`.)*

## 4. Deploy

```bash
bash backend/deploy.sh
```

Or trigger `.github/workflows/deploy-oracle-backend.yml` from GitHub Actions once `ORACLE_SSH_HOST`, `ORACLE_SSH_USER`, `ORACLE_SSH_KEY`, and `ORACLE_REPO_DIR` are configured.

Verify readiness:
```bash
curl -sS https://api.orderitup.in/ready
# {"service":"orderitup-cloud-api","status":"ready"}
```

## 5. Backups & Restore

- Automated SQLite online backups run every 24 hours into the `oiu_backups` Docker volume (`/backups`).
- If `OCI_S3_*` variables are set in `.env.oracle`, backups are automatically uploaded to **OCI Object Storage** (S3-compatible API).
- Manual backup trigger (Owner/Admin JWT):
  ```bash
  curl -X POST https://api.orderitup.in/api/admin/backups -H "Authorization: Bearer <TOKEN>"
  ```
