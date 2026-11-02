# Order It Up (OIU) — Environment Configuration

## Overview
Order It Up strictly adheres to twelve-factor configuration practices. Sensitive credentials are never committed to version control.

## Environment Variables Reference

| Variable Name | Environment | Required? | Description | Example / Default |
| :--- | :--- | :--- | :--- | :--- |
| `NODE_ENV` | All | Yes | Node execution mode | `production` or `development` |
| `PORT` | Local POS | No | Local Express server port | `3001` |
| `OIU_CLOUD_API_URL` | Local POS | Optional | First-party Cloud Sync endpoint | `https://orderitup-cloud-api.narayaaana11.workers.dev` |
| `ALLOW_SELF_SERVICE_REGISTRATION` | Cloud API | No | Public signup switch; keep `false` for the approved pilot invitation flow | `false` |
| `NEXT_PUBLIC_OIU_CLOUD_PORTAL_URL` | Landing build | No | Cloud Portal sign-in destination after pilot setup | `https://app.orderitup.in/auth/login` |
| `NEXT_PUBLIC_OIU_PILOT_ACCESS_URL` | Portal build | No | Public pilot request form destination | `https://orderitup.in/request-access` |
| `RESEND_API_KEY` | Cloud API secret | No | Resend API key used to email approved pilot setup invitations; without it the admin copies the one-time link | Set with Wrangler secret management |
| `PILOT_INVITATION_FROM` | Cloud API | No | Verified sender identity for pilot invitation emails | `Order It Up <pilot@orderitup.in>` |
| `PILOT_INVITATION_BASE_URL` | Cloud API | No | HTTPS landing origin used in pilot setup links sent by email | `https://orderitup.in` |
| `MONGODB_URI` | Cloud API | Yes | MongoDB Atlas connection URI | `mongodb+srv://...` |
| `AWS_REGION` | Cloud / POS | Yes | AWS Datacenter Region | `ap-south-1` (Mumbai) |
| `AWS_S3_BUCKET` | Cloud / POS | Yes | Private S3 Bucket for DB backups | `order-it-up-backups-prod` |
| `AWS_ACCESS_KEY_ID` | Cloud / POS | Yes | AWS IAM Access Key ID | Set in `.env` |
| `AWS_SECRET_ACCESS_KEY`| Cloud / POS | Yes | AWS IAM Secret Access Key | Set in `.env` |
| `JWT_SECRET` | All | Yes | Secret for signing auth tokens | 64-char random hex string |
| `ENCRYPTION_KEY` | All | Yes | Master AES encryption key | 32-byte random hex string |
| `RAZORPAY_KEY_ID` | Cloud API | Optional | Razorpay payment key | For India subscriptions |
| `RAZORPAY_KEY_SECRET` | Cloud API | Optional | Razorpay webhook secret | For webhook signature verification |

## Local Development
Copy `.env.example` to `.env`. In development mode, the local POS operates completely offline without requiring any cloud or AWS credentials.
