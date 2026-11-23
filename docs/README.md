# Order It Up Documentation Index

Welcome to the internal engineering documentation for **Order It Up**. This directory houses architecture specifications, operational runbooks, and design audits.

---

## 🧭 Core Documentation

- **[Architecture & Team Developer Guide](ARCHITECTURE_AND_TEAM_GUIDE.md)**: **START HERE.** The comprehensive guide for engineering teammates covering system architecture, multi-port topology (`:3001`, `:3002`, `:3003`), database migration invariants (`v1` → `v89`), multi-agent restaurant workflows, offline-first sync engine, local development, and testing conventions.
- **[Production Status](PRODUCTION_STATUS.md)**: Status of production environments, components, and health gates.
- **[Production Readiness Master Plan](PRODUCTION_READINESS_MASTER_PLAN.md)**: Master roadmap covering testing, security, performance, and scaling milestones.
- **[Production Release Runbook](PRODUCTION_RELEASE_RUNBOOK.md)**: Deployment steps, pre-flight checklists, release commands, and rollback procedures.
- **[Product Surface Audit & Acceptance](PRODUCT_SURFACE_AUDIT_AND_ACCEPTANCE.md)**: Comprehensive surface audit of POS, KDS, Cloud Portal, and Mobile companions.
- **[Security Bootstrap & Webhooks](SECURITY_BOOTSTRAP_AND_WEBHOOKS.md)**: Security specifications for tokens, secret keys, webhook signatures, and aggregator auth.
- **[Cloud D1 Baseline Reconciliation](CLOUD_D1_BASELINE_RECONCILIATION.md)**: Cloudflare D1 schema migrations, synthetic baseline testing, and rehearsal checks.
- **[Cloud Platform Admin & Subscriptions](CLOUD_PLATFORM_ADMIN_AND_SUBSCRIPTIONS.md)**: SaaS tenancy, subscription payment verification, and billing tiers.
- **[Mobile & Cloud Surface Matrix](MOBILE_CLOUD_SURFACE_MATRIX.md)**: Feature parity matrix across Desktop Electron, Web Cloud, Flutter Mobile, and Capacitor Tablet.
- **[User Access Guide](user-access-guide.md)**: Seed credentials, operator personas, and PIN authentication rules (also see [users.md](../users.md)).

---

## 🏛️ Invariant Documents & Rules

- **[Developer Guide & Safety Invariants](../AGENTS.md)**: Working rules, code conventions, PR practices, and quality standards.
- **[Multi-Agent Operational Specifications](../agents.md)**: Six operational restaurant personas and device flows.
