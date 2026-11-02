# Order It Up — production status

**As of:** 2026-11-03  
**Branch:** `feat/tablet-pos-and-role-dashboard-foundation`  
**Scope:** verified source state in this checkout. This is not a deployment certification.

## Bottom line

The product surface is implemented and locally verified across desktop, Cloud, web, landing, tablet, waiter and mobile contracts. Production is **not** ready: no remote database migration, no deployed Worker/Pages, no live payment credentials, no signed desktop installer, and no Android device build have been performed here.

## Verified now (all passing locally)

| Check | Result |
|---|---|
| `npm run verify:cloud` (9 suites) | pass — auth, 9-part E2E, restaurant ops, catalog, customers, staff, menu CSV, mobile compat, guest payments |
| Migration chain 0001–0025 | pass |
| `cloud-public-qr` | pass |
| `cloud-terminal-pairing` | 76/76 |
| `cloud-saas-subscription-payments` | pass |
| Landing Cloud workspace browser E2E | pass (waiter → kitchen → cashier → accountant) |
| `npm run check:mobile-cloud` | 36 endpoints: 30 Cloud, 5 local-only, 1 partner-gated, 0 unclassified |
| `npm run check:tablet-android` | 9/9 hardening checks |
| `npm run check:cloud-release` | 41/41 |
| `npm run check:d1-rehearsal` | 8/8 — synthetic legacy baseline: naive replay fails closed, ledger-baseline + 0008–0025 applies, membership repair and readiness pass |
| `npm run test:release-config` | pass — desktop draft-release workflow, Electron runtime xattr, release asset verifier, release gate |
| `npm run verify:platform` | pass — one command running release inputs, D1 rehearsal, all Cloud suites, release gates, mobile parity, tablet hardening and the Worker bundle |
| `npm run check:cloud-worker` | bundles at ~511 KiB / ~99 KiB gzip |
| React/web export, landing build, backend build, Electron runtime/artifact checks | pass |
| Desktop `electron-builder --dir` packaging | pass (unpacked Windows app) |

## Surface status

| Surface | Status | Evidence / gap |
|---|---|---|
| Desktop POS (Electron + local Express + SQLite) | Implemented; draft-release workflow + packaging pass | Signed installer needs certificate secrets; macOS/MAS and auto-update pipelines absent |
| Cloud API (Worker + D1) | Implemented; bundle pass | Remote D1 unreconciled; secrets/domains absent |
| Landing marketing + dashboards | Live workspace role tabs pass E2E | Demo preview remains sample data by design |
| Web dashboards (products, staff, customers, tables, inventory, expenses, reservations, reports) | Cloud-backed routes exist | Orders/settings/aggregator screens are partially desktop-only |
| QR customer ordering | Cloud routes + tracking + POS delivery tested | Live cross-network QR not verified |
| SaaS subscriptions | Razorpay order/capture/webhook tests pass | Live merchant credentials unconfigured |
| Pilot onboarding + platform admin | Tested locally | Remote migration/deploy pending |
| React tablet POS | Build + capability-aware payments | APK/device verification pending |
| React waiter station | Build + shared contracts | Device verification pending |
| Flutter mobile | Cloud/API contracts verified statically; CI gate | Flutter SDK absent locally; card/UPI correctly fails closed without provider |
| Payments (guest) | Intent + verify + signed webhook implemented | Cash-only in production until live keys; UI wired on landing + tablet |
| Aggregators / WhatsApp / AI / local settings | Deliberately unavailable in Cloud | Partner-gated or LAN-only |

## Production blockers (in order)

1. **D1 reconciliation and backup** — review `CLOUD_D1_BASELINE_RECONCILIATION.md`, restore-test, apply 0008–0025 to staging first.
2. **Secrets** — `JWT_SECRET`, platform-admin email/hash/separate JWT secret, Razorpay key id/secret/webhook secret.
3. **Deploy** — Worker, then Pages via the guarded workflow; verify `/ready`, login, dashboards, QR from an external phone.
4. **Desktop release** — `.github/workflows/desktop-release.yml` builds and drafts a Windows installer; provision `WINDOWS_CERTIFICATE`/`WINDOWS_CERTIFICATE_PASSWORD`, verify the artifact, then publish manually. macOS/MAS, the upgrade matrix and auto-update monitoring are still absent.
5. **Android** — build the APK in CI/with an SDK, install on a tablet, verify role routing, offline outbox, and Razorpay checkout in the WebView.
6. **Printing/offline parity** — receipt/KOT printing and durable offline storage are still Electron/local-server capabilities.
7. **Provider certification** — sandbox then live Razorpay capture/refund/webhook certification.

## Explicitly not claimed

- That production is deployed, migrated, or serving customers.
- That card/UPI collection works in production (it fails closed until configured and certified).
- That signed desktop installers, macOS/MAS builds, the upgrade matrix or auto-update exist.
- That the Android APK has been built or tested on a device.
- That aggregator/WhatsApp integrations are live.
