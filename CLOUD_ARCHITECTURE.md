# Order It Up (OIU) — Cloud Architecture

## High-Level Topology
The cloud architecture serves as an asynchronous synchronization, backup, licensing, and remote reporting backbone. It never sits in the critical path of local POS transactions.

## Components
1. **Local Operational Store (SQLite)**:
   - Low latency (<1ms)
   - Zero external network dependency
   - Local ACID transactions
2. **Cloud Synchronization (MongoDB Atlas)**:
   - Incremental change-log replication
   - Multi-tenant data segregation by `tenant_id`
   - Real-time aggregation for web dashboards
3. **Disaster Recovery (Amazon S3)**:
   - Automated compressed database snapshots
   - SHA-256 integrity checksum verification
   - Point-in-time recovery
4. **OIU Cloud API**:
   - Device registration and heartbeat monitoring
   - Secure webhook processing for subscription payments
   - First-party support ticket ingestion
