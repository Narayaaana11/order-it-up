# Order It Up (OIU) — Environment Configuration

## Overview
Order It Up strictly adheres to twelve-factor configuration practices. Sensitive credentials are never committed to version control.

## Environment Variables Reference

| Variable Name | Environment | Required? | Description | Example / Default |
| :--- | :--- | :--- | :--- | :--- |
| `NODE_ENV` | All | Yes | Node execution mode | `production` or `development` |
| `PORT` | Local POS | No | Local Express server port | `3001` |
| `OIU_CLOUD_API_URL` | Local POS | Optional | First-party Cloud Sync endpoint | `https://api.orderitup.in` |
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
