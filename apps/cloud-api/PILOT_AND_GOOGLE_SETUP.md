# Google sign-in and pilot enquiry deployment setup

The code in this repository implements Google Identity Services ID-token sign-in and stores pilot enquiries in Cloudflare D1. These features are not live until the provider settings and migration below have been applied.

## 1. Apply the Cloudflare D1 migration

From `apps/cloud-api`:

```bash
npm run d1:migrate:remote
```

This applies migration `0008_google_auth_and_pilot_applications.sql`, which adds a unique Google subject to cloud users and creates the pilot applications table. Back up the production database before applying migrations.

## 2. Configure Google sign-in

1. In Google Cloud Console, configure an OAuth consent screen for Order It Up.
2. Create an OAuth 2.0 **Web application** client.
3. Add the exact production frontend origins under **Authorized JavaScript origins** (for example, the deployed app domain), plus localhost origins used for development.
4. Set `NEXT_PUBLIC_GOOGLE_CLIENT_ID` in the frontend hosting/build environment to the client ID.
5. Set `GOOGLE_CLIENT_ID` in the Cloudflare Worker environment to the same client ID.
6. Deploy the frontend and Cloud Worker after setting the values.

The browser sends a Google ID token to `POST /api/auth/google`. The Worker verifies the signature against Google's published signing keys and validates issuer, audience, expiry and verified email before linking or creating an account. Do not put a Google client secret in browser code. Existing accounts are linked only when Google asserts the same verified email address.

New Google sign-ups must provide restaurant and owner details. Existing users can sign in from the login screen.

## 3. Configure pilot enquiry notifications

The public form posts to `POST /api/pilot-applications`. Submissions are validated, rate-limited and stored in D1. The Worker sends a notification through Resend when all three values below are configured:

- `RESEND_API_KEY` — add as a Worker secret.
- `PILOT_NOTIFICATION_EMAIL` — monitored inbox or comma-separated inbox list.
- `PILOT_FROM_EMAIL` — sender address on a domain verified in Resend.

Set `PILOT_ADMIN_EMAILS` to a comma-separated allowlist of signed-in Order It Up administrator email addresses. Those identities can retrieve the newest requests from `GET /api/pilot-applications`; all other authenticated users receive 403.

Example secret command:

```bash
npx wrangler secret put RESEND_API_KEY
```

Set the non-secret Worker variables in Cloudflare Worker settings. If Resend is not configured or a notification fails, the request is still saved and the form explicitly tells the applicant that automatic notification is pending; it does not claim that the team was emailed.

## 4. Configure the landing form

The landing site uses this default Worker endpoint:

`https://orderitup-cloud-api.narayaaana11.workers.dev`

To override it at build time, set `NEXT_PUBLIC_OIU_CLOUD_API_URL` in the Cloudflare Pages environment. Keep `https://orderitup.pages.dev` in the Worker `FRONTEND_ORIGIN` allowlist.

## 5. Deploy

After setting the variables and applying the migration, deploy the Worker from `apps/cloud-api` with:

```bash
npm run deploy
```

Then rebuild/redeploy the frontend so `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is included in its bundle. Verify the full flow using a real Google account and a test pilot enquiry before sharing the site publicly.
