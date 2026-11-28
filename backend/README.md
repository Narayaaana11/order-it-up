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

```bash
cp deploy/oracle/.env.oracle.example deploy/oracle/.env.oracle
```

Generate distinct 64-character secrets for `JWT_SECRET` and `PLATFORM_ADMIN_JWT_SECRET`:
```bash
openssl rand -hex 32
openssl rand -hex 32
```

Point your domain's DNS `A` record (`api.orderitup.in`) to the OCI VM's public IP, and set `DOMAIN=api.orderitup.in` in `.env.oracle`.

## 3. Build Static Web Frontends (Optional, for Single-Origin Hosting)

To serve the POS, KDS, QR ordering, and Landing dashboards directly from the Oracle VM:
```bash
npm run build:web
```

## 4. Deploy

```bash
bash deploy/oracle/deploy.sh
```

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
