# End-to-End `free-for.dev` Toolkit for Order It Up

> **Status:** REFERENCE  
> **Source Catalog:** [`ripienaar/free-for-dev`](https://github.com/ripienaar/free-for-dev) ([`free-for.dev`](https://free-for.dev/#/))  
> **Scope:** End-to-end mapping of free-tier developer, cloud, CI/CD, security, observability, mobile, AI, and support services to Order It Up's architecture and [production blockers](PRODUCTION_STATUS.md).

---

## Commercial Eligibility Legend

Because Order It Up is a commercial POS and SaaS product, every entry is tagged with its free-tier eligibility:

| Tag | Meaning |
| --- | --- |
| **Commercial-allowed** | Free tier generally permits commercial/SaaS use (always verify current pricing/ToS before production launch). |
| **OSS / Non-commercial only** | Free tier is restricted to open-source or personal/non-commercial projects (usable only for internal dev/OSS, not production SaaS). |
| **Verify ToS** | Free tier has regional, rate, or commercial-use nuances that should be checked before production adoption. |

---

## 1. Core Cloud, Edge & Compute

Order It Up already targets **Cloudflare** (`apps/cloud-api`, Pages) and **Oracle Cloud** (`backend/`). These free tiers cover edge APIs, static web hosting, and always-on backend compute.

| Service | Free Tier Limits | Eligibility | Fit in Order It Up |
| --- | --- | --- | --- |
| [Cloudflare Workers](https://developers.cloudflare.com/workers/) | 100k requests/day | Commercial-allowed | Powers `apps/cloud-api` (Hono edge API). |
| [Cloudflare Pages](https://developers.cloudflare.com/pages/) | 500 builds/mo, 100 custom domains, unlimited seats/previews, SSL | Commercial-allowed | Hosts static Next.js web export & landing (`deploy-pages.yml`). |
| [Cloudflare Application Services](https://www.cloudflare.com/plans/) | Unlimited domains DNS, DDoS, CDN, SSL, WAF, 1 rate-limit rule/domain | Commercial-allowed | Protects Cloud API, QR ordering domain, and Pages. |
| [Cloudflare Zero Trust](https://www.cloudflare.com/plans/zero-trust-services/) | Up to 50 users, 3 network locations | Commercial-allowed | Secures internal admin/staging dashboards without VPN overhead. |
| [Oracle Cloud Always Free](https://www.oracle.com/cloud/free/) | 2 AMD VMs (1/8 OCPU, 1 GB RAM) + Ampere A1 (up to 2 cores, 12 GB RAM), 200 GB block volume, 10 TB egress/mo, 10 Mbps LB | Commercial-allowed | Hosts `backend/` unified Node.js 22 + SQLite WAL + WebSocket server (`deploy-oracle-backend.yml`). *Note: idle instances may be reclaimed.* |
| [Google Cloud Run](https://cloud.google.com/run) | 2M requests/mo, 360k GB-sec, 180k vCPU-sec, 1 GB egress/mo | Commercial-allowed | Optional containerized microservice (e.g., PDF/receipt rendering or heavy webhooks). |
| [Vercel](https://vercel.com/) | Free SSL, global CDN, preview URLs on `git push` | Verify ToS (Hobby is non-commercial) | Good for personal/OSS previews; use Cloudflare Pages for commercial Next.js static hosting. |
| [Render](https://render.com) / [Koyeb](https://www.koyeb.com/) | Free web services & Postgres (550 hrs/mo on Koyeb; Render sleeps on idle) | Verify ToS | Staging environments for `backend/` or webhook workers. |

---

## 2. Databases, Sync & Object Storage / Backups

Addresses **D1**, **SQLite backups**, **MongoDB sync** (`main/services/mongodb-sync.ts`), and **S3 storage** (`main/services/amazon-s3.ts`).

| Service | Free Tier Limits | Eligibility | Fit in Order It Up |
| --- | --- | --- | --- |
| [Cloudflare D1](https://developers.cloudflare.com/d1/) | 5M rows read/day, 100k rows written/day, 1 GB storage | Commercial-allowed | Primary relational DB for `apps/cloud-api` (`0001`–`0025` migrations). |
| [Cloudflare R2](https://developers.cloudflare.com/r2/) | 10 GB/mo, 1M Class A ops, 10M Class B ops, zero egress fees | Commercial-allowed | S3-compatible storage for `amazon-s3.ts`, merchant assets, and offsite DB backups. |
| [Backblaze B2](https://www.backblaze.com/b2/) | 10 GB S3-compatible object storage forever | Commercial-allowed | Secondary offsite backup target for SQLite WAL snapshots and D1 exports. |
| [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) | 512 MB shared cluster | Commercial-allowed | Cloud target for `main/services/mongodb-sync.ts` testing and small-tier sync. |
| [Turso (libSQL)](https://turso.tech/) | 9 GB storage, 500 DBs, 3 locations, 1B row reads/mo, local SQLite support | Commercial-allowed | Edge SQLite replication if per-tenant branch DBs are needed beyond D1. |
| [Upstash](https://upstash.com/) | Serverless Redis: 500K commands/mo, 256 MB, 20 concurrent connections | Commercial-allowed | Distributed rate limiting, OTP/pairing codes, or session revocation cache. |
| [Neon](https://neon.com) / [Prisma Postgres](https://prisma.io/postgres) | 0.5–1.01 GB Postgres, branching (Neon includes 5 GB S3 storage) | Commercial-allowed | Relational staging/analytics DB if moving beyond SQLite/D1. |
| [BorgBase](https://www.borgbase.com/) | 10 GB backup space, 2 repos | Commercial-allowed | Encrypted offsite Borg backups for Oracle Cloud `backend/` SQLite files. |
| [BackupDrill](https://backupdrill.com) | Weekly backups + scheduled restore drills to your own S3/R2/B2 bucket (1 project) | Commercial-allowed | Automates backup restore verification (addresses D1/SQLite restore testing). |

---

## 3. Tunneling, Webhooks & Local Network Testing

Critical for testing **QR ordering**, **Razorpay webhooks**, and **LAN POS/KDS/Waiter** flows from external phones.

| Service | Free Tier Limits | Eligibility | Fit in Order It Up |
| --- | --- | --- | --- |
| [Cloudflare Tunnel](https://www.cloudflare.com/products/tunnel/) | Unlimited Quick Tunnels (`trycloudflare.com`, no account) + Zero Trust Free | Commercial-allowed | Expose local `:3001`/`:3002`/`:3003` to external phones for QR ordering & Razorpay webhook tests. |
| [Hookdeck](https://hookdeck.com/pricing) | 100K requests & 100K attempts/mo, 3-day retention | Commercial-allowed | Reliable webhook gateway, retry queue, and replay for Razorpay & aggregator webhooks. |
| [UseWebhook.com](https://usewebhook.com) / [Webhook.site](https://webhook.site) | Free browser webhook capture, localhost forwarding (UseWebhook) | Commercial-allowed | Quick inspection of outbound POS/Cloud webhook payloads during dev. |
| [ngrok](https://ngrok.com/) / [Pinggy](https://pinggy.io) | Public HTTPS/TCP tunnels to localhost (Pinggy: 60-min sessions, no install) | Verify ToS | Ad-hoc local Express API exposure for mobile device testing. |
| [ZeroTier](https://www.zerotier.com) | Encrypted virtual Ethernet for up to 25 clients | Commercial-allowed (up to 25) | Connect remote test POS terminals, KDS, and tablets on a virtual LAN. |
| [Tailscale](https://tailscale.com/) | 100 devices, 3 users (Personal plan) | OSS / Non-commercial only | Personal/dev team mesh VPN for accessing Oracle Cloud or test POS machines. |

---

## 4. CI/CD, Code Quality & Release Automation

Directly supports `.github/workflows/` (`ci.yml`, `desktop-release.yml`, `mobile-release.yml`, `deploy-cloud-api.yml`, `deploy-oracle-backend.yml`).

| Service | Free Tier Limits | Eligibility | Fit in Order It Up |
| --- | --- | --- | --- |
| [GitHub](https://github.com/) | Unlimited public/private repos, Actions, Pages, Packages | Commercial-allowed | Current VCS, CI/CD, and Pages host (private repos have 2,000 Actions mins/mo). |
| [CircleCI](https://circleci.com/) | 6,000 mins/mo (30 parallel jobs, Linux/Docker/Windows/macOS/ARM); 80k mins for OSS | Commercial-allowed | Offloads heavy Windows/macOS `electron-builder` or E2E suites if GitHub Actions minutes run tight. |
| [Codemagic](https://codemagic.io/) | 500 build mins/mo including Mac Mini instance | Commercial-allowed | Builds **Flutter mobile** and **Capacitor iOS/Android** apps without a local Mac. |
| [BuildPulse Runners](https://buildpulse.io/products/runners) / [Shipfox](https://www.shipfox.io/) | 3,000 free mins/mo faster GitHub Actions runners | Verify ToS | Drop-in speedup for `verify:platform` and Playwright E2E jobs. |
| [CodeRabbit](https://coderabbit.ai) | 200 files/hr, 3 reviews/hr, 50 chats/hr (unlimited for OSS) | Commercial-allowed | Automated PR review (already referenced in `AGENTS.md`). |
| [Codecov](https://codecov.io/) | 1 private repo free; unlimited for OSS | Commercial-allowed | Track test coverage trends across `main/`, `apps/cloud-api`, and `desktop-ui/`. |
| [DeepSource](https://deepsource.com/) | Continuous static analysis for JS/TS, security & anti-patterns | Verify ToS | Automated PR checks for TypeScript/React code quality. |
| [AppVeyor](https://www.appveyor.com/) / [SonarQube Cloud](https://sonarsouce.com) | Free for Open Source projects only | OSS / Non-commercial only | Usable only if parts of Order It Up are open-sourced. |

---

## 5. Security, Secrets Management & PKI

Addresses **Production Blocker #2 (Secrets)** (`JWT_SECRET`, platform-admin secrets, Razorpay keys) and **Windows/macOS code signing & SSL**.

| Service | Free Tier Limits | Eligibility | Fit in Order It Up |
| --- | --- | --- | --- |
| [Doppler](https://doppler.com/) | 5 users, universal secrets manager with cloud/CI sync | Commercial-allowed | Centralize `.env` & GitHub Actions secrets (`JWT_SECRET`, Razorpay keys) across dev/staging/prod. |
| [Infisical](https://infisical.com/) | Up to 5 developers, open-source & self-hostable | Commercial-allowed | Open-source alternative to Doppler for syncing secrets to Cloudflare Workers & Oracle Cloud. |
| [GitGuardian](https://www.gitguardian.com) | Free for teams <=25 devs, scans 350+ secret types | Commercial-allowed | Prevents accidental commits of Razorpay keys, `.env`, or tokens. |
| [Semgrep](https://semgrep.dev) | Up to 10 contributors, 10 private repos (SAST + SCA) | Commercial-allowed | Static security scanning for Express, Hono Worker, and SQLite queries. |
| [Aikido.dev](https://www.aikido.dev) | 2 users, 10 repos, 1 cloud, 1 domain (SAST, SCA, DAST, secrets) | Commercial-allowed | All-in-one AppSec dashboard for small engineering teams. |
| [Socket](https://socket.dev) | Free supply-chain CLI & GitHub app for npm | Commercial-allowed | Guards `package.json`, `desktop-ui`, and `apps/cloud-api` against malicious npm packages. |
| [Let's Encrypt](https://letsencrypt.org/) | Unlimited trusted SSL/TLS certificates | Commercial-allowed | TLS for Oracle Cloud `backend/` and custom domains. |
| [CertAvert](https://certavert.com/monitoring) / [Otterwatch](https://otterwatch.dev/) | 15 domains (CertAvert) / 5 domains (Otterwatch) SSL expiry alerts | Commercial-allowed | Alerts before API, Pages, or custom domain certificates expire. |
| [Mozilla Observatory](https://observatory.mozilla.org/) / [SSL Labs](https://www.ssllabs.com/ssltest/) | Unlimited free security header & TLS audits | Commercial-allowed | Verify CSP, HSTS, and TLS posture on Cloud & Pages endpoints. |
| [IntoDNS.ai](https://intodns.ai) | Free SPF, DKIM, DMARC, DNSSEC check (no signup) | Commercial-allowed | Ensure transactional receipt/onboarding emails don't land in spam. |

---

## 6. Testing, Browser E2E & API QA

Complements existing Playwright (`test:e2e:browser`, `test:e2e:electron`) and API security suites.

| Service | Free Tier Limits | Eligibility | Fit in Order It Up |
| --- | --- | --- | --- |
| [Checkly](https://checklyhq.com) | 10K API & 1.5K Playwright browser check runs/mo (1 user) | Commercial-allowed | Run synthetic Playwright & `/ready` API checks against deployed Cloud Worker & Pages. |
| [Appetize](https://appetize.io) | 2 concurrent sessions, 30 mins/mo, no app size limit | Commercial-allowed | Test Android Tablet APK & Flutter builds directly in a browser without physical hardware. |
| [VibeView](https://vibeview.io) | 2 concurrent iOS/Android simulator sessions, 30 mins/mo | Verify ToS | AI-assisted mobile flow testing (bring your own API key). |
| [Requestly](https://requestly.com/) | Up to 10 rules free (HTTP intercept, mock server, API client) | Commercial-allowed | Mock Razorpay/aggregator responses and debug CORS in `desktop-ui`. |
| [CORS-Tester](https://cors-error.dev/cors-tester/) | Free online CORS gap checker | Commercial-allowed | Validate `cors-security.test.ts` behavior on live Cloud Worker URLs. |
| [UI Verify](https://uiverify.ai) / [Percy](https://percy.io) | 10K snapshots/mo (UI Verify) / 5K snapshots/mo (Percy) | Commercial-allowed | Visual regression testing for POS, KDS, and landing dashboards. |
| [Loadmill](https://www.loadmill.com/) | Simulate 50 concurrent users for 60 mins/mo | Verify ToS | Load test Cloud Worker & Oracle backend before pilot onboarding. |

---

## 7. Mobile & Tablet App Distribution & MDM

Addresses **Production Blocker #5 (Android APK)**, **Flutter mobile**, and **restaurant tablet fleet management**.

| Service | Free Tier Limits | Eligibility | Fit in Order It Up |
| --- | --- | --- | --- |
| [BetaLobby](https://betalobby.com) | Free closed testing for 16-dev teams, tracks 14-day/12-tester Play Store rule | Commercial-allowed | Directly satisfies Google Play's mandatory 12-tester closed-testing gate for Android POS/Mobile. |
| [DistApp](https://distapp.app) | 2 apps, 100 MB storage, unlimited downloads (Android, iOS, Desktop) | Commercial-allowed | Distribute pre-release Android APKs and Electron installers to pilot restaurants. |
| [Diawi](https://www.diawi.com) / [InstallOnAir](https://www.installonair.com) | Free OTA mobile test link distribution (10 installs / 2–60 day expiry) | Commercial-allowed | Quick QR-code APK/IPA installs onto test tablets and phones. |
| [FlutLab](https://flutlab.io/) | Free online Flutter IDE & iOS/Android cloud builder | Verify ToS | Build Flutter iOS/Android artifacts without local Flutter SDK or Mac. |
| [Esper](https://esper.io) | 100 Android devices free, 1 user, 25 MB app storage | Commercial-allowed | Kiosk/MDM management for dedicated restaurant Android POS & KDS tablets. |
| [Miradore](https://miradore.com) | Unlimited devices (basic MDM features) | Commercial-allowed | Lightweight device inventory and basic lockdown for pilot tablets. |
| [Semaphr](https://semaphr.com) | Free mobile app kill switch | Verify ToS | Force-disable broken/outdated mobile POS client versions remotely. |

---

## 8. Observability, Error Tracking, Logs & Uptime/Status

Complements `main/services/telemetry.ts` and provides production visibility across Electron, Cloud Workers, Oracle, and Mobile.

| Service | Free Tier Limits | Eligibility | Fit in Order It Up |
| --- | --- | --- | --- |
| [Sentry](https://sentry.io/) | 5K errors/mo, 1 user; unlimited if self-hosted | Commercial-allowed | Unified crash/exception tracking for Electron, Next.js, Hono Worker, and Flutter. |
| [GlitchTip](https://glitchtip.com/) | 1K events/mo hosted, or unlimited self-hosted (Sentry-SDK compatible) | Commercial-allowed | Lightweight open-source Sentry alternative (self-hostable on Oracle Cloud). |
| [Bugsink](https://www.bugsink.com/) | 5K errors/mo hosted, unlimited self-hosted (Sentry-SDK compatible) | Commercial-allowed | Low-overhead error tracking for `backend/` and Electron. |
| [Embrace](https://embrace.io/) / [Measure.sh](https://measure.sh/) | 1M sessions/yr (Embrace); 5 GB/mo or unlimited self-hosted (Measure.sh) | Commercial-allowed | Mobile-specific crash, ANR, and performance monitoring for Android/Flutter. |
| [Better Stack](https://betterstack.com/better-uptime) | 10 monitors (3-min interval), status page + 3 GB ClickHouse logs (3d) | Commercial-allowed | Monitor Cloud API `/ready`, Oracle backend, and publish a merchant status page. |
| [Pulsetic](https://pulsetic.com) / [RealUptime](https://realuptime.io) | 10 monitors, custom domain status pages (RealUptime explicitly allows commercial) | Commercial-allowed | Public status page + multi-region uptime alerts for POS cloud services. |
| [Grafana Cloud](https://grafana.com/products/cloud/) | 3 users, 10 dashboards, 10K Prometheus series, 50 GB Loki logs (14d) | Commercial-allowed | Centralized metrics & logs for Oracle Cloud `backend/` and POS telemetry. |
| [OpenObserve](https://openobserve.ai/) / [Axiom](https://axiom.co/) | 200 GB logs/mo (OpenObserve, 15d) / 500 GB/mo (Axiom, 30d) | Commercial-allowed | High-volume structured log ingestion for Cloud Workers & `telemetry.ts`. |
| [Healthchecks.io](https://healthchecks.io) / [Watchgoose](https://watchgoose.com) | 20 checks (Healthchecks) / 10 checks (Watchgoose) | Commercial-allowed | Dead-man's switch alerts if scheduled SQLite/D1 backups or sync jobs fail. |

---

## 9. Email, Push Notifications, SMS & Localization (i18n)

Supports `main/services/email-provider.ts`, customer/kitchen notifications, and `npm run i18n:check`.

| Service | Free Tier Limits | Eligibility | Fit in Order It Up |
| --- | --- | --- | --- |
| [Resend](https://resend.com) | 3,000 emails/mo (100/day), 1 custom domain | Commercial-allowed | Modern REST API for transactional bills, SaaS onboarding, and password resets. |
| [Brevo](https://www.brevo.com/) / [Mailjet](https://www.mailjet.com/) | 9,000/mo (300/day) on Brevo; 6,000/mo (200/day) on Mailjet | Commercial-allowed | Higher daily volume SMTP/API for `email-provider.ts` e-receipts. |
| [Emitlo](https://emitlo.com) / [Maileroo](https://maileroo.com) | 12,000/mo (Emitlo) / 5,000/mo + unlimited domains (Maileroo) | Commercial-allowed | Multi-domain transactional email & SMTP relay without credit card. |
| [Mailtrap](https://mailtrap.io/) / [EtherealMail](https://ethereal.email) | 50 sandbox test emails/mo (Mailtrap); unlimited fake SMTP (Ethereal) | Commercial-allowed | Safe email testing in CI and local dev without emailing real customers. |
| [OneSignal](https://onesignal.com/) | Unlimited mobile/web push notifications + 10K emails/mo | Commercial-allowed | Push alerts for Mobile/Waiter/QR order ready notifications. |
| [Novu](https://novu.co) | 30,000 notifications/mo (Email, SMS, Push, In-App), open-source | Commercial-allowed | Unified notification orchestration across email, push, and in-app alerts. |
| [Pusher Beams](https://pusher.com/beams) | Unlimited push for 2,000 MAU (iOS & Android) | Commercial-allowed | Dedicated mobile push delivery for Flutter/Capacitor apps. |
| [httpSMS](https://httpsms.com) / [SMSGate](https://sms-gate.app) | 200 SMS/mo (httpSMS) or free cloud routing via your own Android phone | Verify ToS | Low-cost local SMS OTP/order-ready fallback in regions without WhatsApp. |
| [Lingo.dev](https://lingo.dev) | Open-source AI localization CLI, 10,000 free words/mo | Commercial-allowed | Automate new language JSON generation for `npm run i18n:add`. |
| [Localazy](https://localazy.com) / [Loco](https://localise.biz/) | 1,000 strings (Localazy) / 2,000 translations (Loco) | Commercial-allowed | Manage `desktop-ui` & mobile translation keys with contributors. |
| [Crowdin](https://crowdin.com/) | Unlimited projects & strings for Open Source | OSS / Non-commercial only | Only if localization files are managed as an open-source project. |

---

## 10. Generative AI & LLM Observability

Supports `main/services/openrouter.ts` and `main/services/ai-tools.ts` (AI copilot, menu parsing/OCR).

| Service | Free Tier Limits | Eligibility | Fit in Order It Up |
| --- | --- | --- | --- |
| [OpenRouter](https://openrouter.ai/models?q=free) | Free rate-limited models (DeepSeek R1/V3, Llama, etc.) | Commercial-allowed (check per-model license) | Already integrated in `openrouter.ts` for zero-cost AI copilot testing & fallback. |
| [Google AI Studio](https://aistudio.google.com/) | Gemini Flash (5 RPM, 20 RPD, 250k TPM) & Gemma 4 (30 RPM, 14.4k RPD) | Verify ToS (free tier may log prompts) | Fast multimodal menu/receipt OCR prototyping; use paid tier for merchant PII. |
| [Langfuse](https://langfuse.com/) | 50K observations/mo free forever, open-source | Commercial-allowed | Trace, debug, and measure latency/cost of `ai-tools.ts` prompts. |
| [Arize AX](https://arize.com/) / [Portkey](https://portkey.ai/) | 25K spans/mo (Arize); 10K gateway requests/mo (Portkey) | Commercial-allowed | AI gateway failover & prompt evaluation for copilot reliability. |

---

## 11. Product Analytics, Feature Flags, Support, Forms & Docs

Covers post-launch operations, merchant onboarding, and product feedback.

| Service | Free Tier Limits | Eligibility | Fit in Order It Up |
| --- | --- | --- | --- |
| [Aptabase](https://aptabase.com) | 20K events/mo, open-source, privacy-friendly, Electron & Flutter SDKs | Commercial-allowed | Purpose-built for **Electron desktop** + **Flutter mobile** POS usage analytics. |
| [PostHog](https://posthog.com) | 1M events/mo, in-app surveys (250 responses/mo), session replay | Commercial-allowed | Full product analytics & funnels for web dashboards and landing page. |
| [Microsoft Clarity](https://clarity.microsoft.com/) | Unlimited session recordings & heatmaps | Commercial-allowed | Spot UX friction in QR ordering and landing workspace demos. |
| [GrowthBook](https://growthbook.io) / [Flagsmith](https://flagsmith.com) | Unlimited flags, up to 3 users (GrowthBook); open-source & self-hostable | Commercial-allowed | Safely gate beta features (e.g., aggregators, new print templates) per restaurant tenant. |
| [Statsig](https://www.statsig.com) | Unlimited seats/flags, 1M metered events/mo | Commercial-allowed | Feature flags + A/B testing for SaaS pricing & onboarding flows. |
| [Zoho Desk](https://zoho.com/desk) + [Zoho Assist](https://www.zoho.com/assist) | 3 support agents, KB, tickets + 1 remote support tech & 5 unattended PCs | Commercial-allowed | Merchant helpdesk + remote desktop troubleshooting on restaurant Windows POS terminals. |
| [UserJot](https://userjot.com) | Unlimited posts/users, 2 feedback boards, roadmap, changelog, live chat | Commercial-allowed | Public merchant feature-request board and release changelog. |
| [GhostChat](https://ghostchat.dev) / [Knocket](https://trtc.io/solutions/knocket) | Cookie-free live chat widget (1 site, unlimited messages) | Commercial-allowed | Lightweight support widget for the landing site and web portal. |
| [Tally.so](https://tally.so/) / [Web3Forms](https://web3forms.com) | Unlimited forms/submissions (Tally); 250/mo static endpoint (Web3Forms) | Commercial-allowed | Pilot restaurant onboarding, demo requests, and feedback forms on static Pages. |
| [GitBook](https://www.gitbook.com/) / [ReadTheDocs](https://readthedocs.com/) | Free individual/OSS docs hosting | Verify ToS / OSS | Host merchant user guides and API docs alongside `docs/`. |

---

## 12. Prioritized Adoption Roadmap for Order It Up

1. **Immediate (Unblocks Production Launch):**
   - **Secrets:** Set up **Doppler** or **Infisical** + **GitGuardian** to manage `JWT_SECRET`, platform-admin secrets, and Razorpay keys.
   - **Storage & Backups:** Configure **Cloudflare R2** (or **Backblaze B2**) with `amazon-s3.ts` + **Healthchecks.io** to monitor automated D1/SQLite backups.
   - **Email:** Wire **Resend** or **Brevo** into `email-provider.ts` and verify SPF/DKIM/DMARC with **IntoDNS.ai**.
   - **Uptime & Errors:** Add **Sentry** (or **GlitchTip**) + **Better Stack** / **RealUptime** for `/ready` monitoring and a public status page.
   - **Mobile Release:** Use **Codemagic** (CI builds) + **BetaLobby** (Android 12-tester Play Store gate) + **Appetize** (browser tablet verification).
2. **Short-Term Quick Wins:**
   - **Webhook & QR Debugging:** Use **Cloudflare Tunnel** + **Hookdeck** for Razorpay/aggregator webhook certification.
   - **Support & Analytics:** Add **Aptabase** (Electron + Flutter), **PostHog** (Web/QR), and **Zoho Assist** (remote POS terminal support).
   - **Feature Rollouts:** Add **GrowthBook** or **Flagsmith** for tenant-level feature flags.
3. **Optional / Growth Stage:**
   - **MDM:** **Esper** for managing dedicated restaurant Android tablets.
   - **AI Observability:** **Langfuse** for tracing `openrouter.ts` and `ai-tools.ts` in production.
   - **Localization:** **Lingo.dev** / **Localazy** as new restaurant languages are added via `npm run i18n:add`.
