# Licensing Architecture & Commercial Options Analysis

> [!NOTE]
> This analysis resolves **Defect D9**: Addressing the tension between the existing `LICENSE` (MIT) and the commercial positioning, multi-location licensing, and subscription feature gates in Order It Up.
>
> In accordance with the Rules of Engagement: **No unapproved license mutations.** The current `LICENSE` file remains unchanged until an explicit business owner decision is recorded.

---

## 1. Context & The Defect

- **Current Repository State:** The root `LICENSE` file is standard **MIT License**.
- **Commercial Code Features:** The codebase includes subscription gates (`main/middleware/subscription-gate.ts`), Cloud SaaS synchronization (`apps/cloud-api`), multi-tenant billing, and paid add-on capabilities.
- **The Conflict:** Under MIT, any third party or competitor can legally fork the entire repository, comment out `subscription-gate.ts`, rebrand the product, and host or resell it without paying license fees or contributing changes back.

---

## 2. Licensing Model Options

| Option | License Model | How It Works | Pros | Cons / Trade-offs | Recommended Action |
|---|---|---|---|---|---|
| **Option A** | **Open-Core (MIT + Proprietary)** | Core desktop POS + SQLite remain permissive MIT. Cloud synchronization (`apps/cloud-api`), aggregator connectors, AI copilot, and multi-location dashboard remain under a proprietary commercial license. | Welcomes community developers, easy adoption by independent single-location diners, transparent security. | Sophisticated competitors can still build around the MIT core desktop engine. | **Safe Starting Point** |
| **Option B** | **Business Source License (BSL 1.1 / FSL)** | Source code is fully public and visible. Free for single-outlet restaurants or self-hosted non-competing use. Commercial license required for SaaS hosting or revenue > threshold. Converts to MIT/Apache after 3-4 years. | Used by CockroachDB, Sentry, MariaDB. Prevents AWS/SaaS cloud free-riding while preserving developer trust. | Not strictly OSI-approved "Open Source" (classified as Source-Available). | **Recommended for Long-Term Commercial Success** |
| **Option C** | **AGPLv3 Dual Licensing** | GNU Affero GPL v3 copyleft for public use; commercial proprietary license for enterprise customers who want closed-source deployments or SaaS hosting exemptions. | Standard model used by MongoDB (historically), Grafana, Ghost. Any online service using modified code must publish full source code. | Some corporate restaurant chains have legal policies restricting AGPL binaries on their LAN. | Viable Alternative |
| **Option D** | **Proprietary Commercial EULA** | Traditional closed/commercial software license with terms of service. No open-source rights granted. | Maximum IP protection and monopoly on commercial distribution. | Reduces organic tester and developer adoption; friction for community audits. | High friction |

---

## 3. Decision Recommendation for the Business Owner

1. **Short-Term (Current Pre-Release Phase):**
   - Retain **Option A (Open-Core)**: Keep the desktop POS offline-first core under permissive licensing to foster early tester adoption (<100 restaurants).
   - Guard Cloud API and proprietary aggregator bridges behind subscription entitlements.
2. **Post-Commercial Launch (Scale Phase):**
   - Migrate to **BSL 1.1** with a "Change Date" of 3 years and an "Additional Use Grant" allowing single-outlet restaurants with <₹50 Lakhs annual turnover to use all features free of charge.
