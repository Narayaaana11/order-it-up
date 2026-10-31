## 2026-10-31T11:14:18Z
You are a versatile implementation worker (teamwork_worker).
Your working directory is: d:\narayana\order-it-up\.agents\teamwork\teamwork_worker_m4_s3
Your parent orchestrator conversation ID is: 0f278f7c-ec06-48f6-9c2f-e89c1978e9bf

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

First, read the user request at:
d:\narayana\order-it-up\.agents\teamwork\ORIGINAL_REQUEST.md
Also read the survey report at:
- d:\narayana\order-it-up\PROJECT.md
- d:\narayana\order-it-up\.agents\teamwork\teamwork_explorer_survey3_3\handoff.md

Your mission is Milestone M4: Cloud Data Storage & S3 Bucket Management Service (R5).

Exclusive File Ownership:
You own exclusively:
- `main/services/amazon-s3.ts`
- `main/routes/amazon-s3.ts`
- `frontend/src/components/settings/AmazonS3Settings.tsx`
- Any new test file in `tests/` specifically testing S3 data management (e.g. `tests/s3-data-management.test.ts`)
Do NOT modify files outside this set.

Tasks:
1. S3 Bucket Configuration & Multi-Cloud Compatibility:
   - In `main/services/amazon-s3.ts`:
     Expand `S3ServiceConfig` to support:
     ```typescript
     export interface S3ServiceConfig {
       bucketName: string;
       region: string;
       accessKeyId: string;
       secretAccessKey: string;
       endpoint?: string;        // Support custom endpoints (Cloudflare R2, MinIO, Wasabi, LocalStack)
       forcePathStyle?: boolean; // Support path-style addressing for MinIO/LocalStack
       enabled: boolean;
       retentionDays: number;
       mockMode?: boolean;       // Enable local filesystem mock adapter when offline or credentials omitted
     }
     ```
     Initialize `S3Client` passing `endpoint` and `forcePathStyle` if configured.
2. S3 Data Management Service & Multi-Domain Storage:
   - Provide methods to manage software platform data, user accounts, payment records, and media:
     - `uploadPlatformRelease(version, filename, streamOrBuffer, contentType)` -> `platform/releases/{filename}`
     - `uploadUserAccountArchive(tenantId, filename, data)` -> `tenants/{tenantId}/users/{filename}`
     - `uploadPaymentRecord(tenantId, filename, data)` -> `tenants/{tenantId}/payments/{filename}`
     - `uploadMediaAsset(tenantId, category, filename, streamOrBuffer, contentType)` -> `tenants/{tenantId}/media/{category}/{filename}`
     - `uploadDatabaseBackup(tenantId, dateStr, streamOrBuffer)` -> `tenants/{tenantId}/backups/order-it-up-{dateStr}.db`
     - `listTenantObjects(tenantId, domain)` -> lists keys under `tenants/{tenantId}/{domain}/`
3. Strict Customer Operational Data Segregation:
   - Strictly segregate customer operational records across tenants by enforcing the `tenants/{tenantId}/...` prefix hierarchy.
   - Ensure requests attempting to read/write outside their assigned tenant prefix are rejected.
4. Offline Resilience & Mock Mode:
   - When `mockMode === true` or credentials are not configured, use a local filesystem mock adapter writing to local storage (`userData/mock-s3/` or `.mock-s3/`) with identical interface contracts and response objects.
   - Maintain an offline outbox queue so network failures during S3 uploads queue locally without interrupting billing or POS operations.
5. S3 Settings API & UI:
   - In `main/routes/amazon-s3.ts`: Add endpoints for testing connection, updating config (including `endpoint`, `forcePathStyle`), uploading platform data / payment records, and fetching tenant storage usage metrics.
   - In `frontend/src/components/settings/AmazonS3Settings.tsx`: Add inputs for custom S3 Endpoint and Path-Style Addressing toggle, and display data categories (Backups, Users, Payments, Media).
6. Build & Test Verification:
   - Run `npm run lint`
   - Run `npm run build`
   - Run existing or new S3 test suite (e.g. `npx ts-node --transpile-only -P tests/tsconfig.json tests/mongodb-s3-integration.test.ts` or custom S3 data management test)
   - Document commands, terminal output, and test results in your handoff.
