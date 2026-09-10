# Order It Up (OIU) — Security Policy

## Security Model & Principles
Order It Up is a commercial Point of Sale and restaurant management platform. Security is designed around three distinct trust boundaries:
1. **Local Terminal (Offline POS)**: Highly resilient, runs on premise, zero external trust dependency.
2. **Cloud Bridge (Sync & Backup)**: Encrypted, signed, authenticated data transmission to private MongoDB and Amazon S3 infrastructure.
3. **Central Admin Control Plane**: Segregated SaaS management portal with strict role-based access control (RBAC).

## Threat Mitigations
- **SQL Injection**: Prevented via parameterized queries on all SQLite statements using `better-sqlite3`.
- **Cross-Site Scripting (XSS)**: Strict Content Security Policy (CSP) blocking inline scripts and external untrusted origins.
- **Electron Hardening**: `contextIsolation: true`, `nodeIntegration: false`, sandboxed webPreferences on secondary windows, and whitelisted IPC APIs.
- **Data Privacy**: No customer personal identifying information (PII) or credit card numbers are ever transmitted to third parties.
- **Local Network Isolation**: KDS and Tableside servers bind to local LAN interfaces with CORS restrictions.

## Reporting a Vulnerability
To report a security vulnerability in Order It Up, please email security@orderitup.in. We take all reports seriously and will respond within 48 hours.
