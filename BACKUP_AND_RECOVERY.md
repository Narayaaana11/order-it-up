# Order It Up (OIU) — Backup and Disaster Recovery

## Automated Local Backups
- The POS automatically generates a compressed snapshot of `flo.db` upon daily shift closure and during application shutdown.
- Stored locally in `backups/local/` with 14-day rolling retention.

## Automated Amazon S3 Cloud Backups
- Encrypted upload to private AWS S3 bucket (`ap-south-1`).
- Storage path: `backups/{tenant_id}/{outlet_id}/{YYYY-MM-DD-HHmmss}.sqlite.gz`.
- Checksum verification: SHA-256 hash calculated before upload and verified against S3 ETag.

## Disaster Recovery Procedure
1. Install fresh Order It Up application on replacement hardware.
2. Enter restaurant credentials and authentication key.
3. System downloads latest verified S3 snapshot.
4. Checksum is verified locally before decompression.
5. SQLite database restored; POS is operational in under 2 minutes.
