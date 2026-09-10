# Order It Up (OIU) — Deployment Guide

## 1. Local POS Deployment (Windows / Linux)
1. **Prerequisites**: Node.js 22 LTS, npm 10+.
2. **Installation**:
   ```bash
   npm install
   ```
3. **Build Frontend & Backend**:
   ```bash
   npm run build:frontend
   npm run build
   ```
4. **Package Windows Installer**:
   ```bash
   npm run release:win
   ```
   The installer will be generated in the `dist/` directory as `order-it-up-1.0.0-win-x64.exe`.

## 2. Cloud Infrastructure Deployment
1. **MongoDB Atlas**: Create a MongoDB M10+ cluster in region `ap-south-1` (Mumbai).
2. **Amazon S3**: Create a private S3 bucket with default KMS AES-256 encryption.
3. **OIU Cloud API**: Deploy containerized Node.js service (`docker/Dockerfile.cloud`) to AWS ECS or DigitalOcean App Platform.
4. **Admin Dashboard**: Deploy Next.js admin control plane to Vercel or containerized environment.
