# 🚨 Disaster Recovery Plan

Comprehensive disaster recovery procedures for the Mycelix Music platform.

## Table of Contents

1. [Overview](#overview)
2. [Backup Strategy](#backup-strategy)
3. [Recovery Procedures](#recovery-procedures)
4. [Failure Scenarios](#failure-scenarios)
5. [Contact Information](#contact-information)
6. [Testing & Drills](#testing--drills)

---

## Overview

### Recovery Objectives

- **RTO (Recovery Time Objective)**: 4 hours
- **RPO (Recovery Point Objective)**: 24 hours (daily backups)
- **Service Availability Target**: 99.5% uptime

### Components

```
┌──────────────────────────────────────────────┐
│  Critical Components                         │
├──────────────────────────────────────────────┤
│  1. Smart Contracts (immutable on blockchain)│
│  2. PostgreSQL Database (user data, catalog) │
│  3. Redis Cache (ephemeral, recoverable)     │
│  4. IPFS Files (music files, metadata)       │
│  5. API Server (stateless, redeployable)     │
│  6. Frontend (stateless, redeployable)       │
└──────────────────────────────────────────────┘
```

---

## Backup Strategy

### Automated Daily Backups

**Database Backups:**
- **Frequency**: Daily at 2 AM UTC
- **Retention**: 30 days local + 90 days S3
- **Location**:
  - Local: `/var/backups/mycelix/`
  - S3: `s3://mycelix-music-backups/`
- **Encryption**: AES-256-CBC

**Setup Automated Backups:**

```bash
# Add to crontab
crontab -e

# Add this line:
0 2 * * * /path/to/scripts/backup.sh >> /var/log/mycelix-backup.log 2>&1
```

**Manual Backup:**

```bash
# Create immediate backup
./scripts/backup.sh

# With S3 upload
USE_S3=true ./scripts/backup.sh
```

### What Gets Backed Up

**✅ Included in Backups:**
- PostgreSQL database (songs, plays, artists, stats)
- Environment configuration (`.env.example` as template)
- Smart contract addresses and ABIs
- Monitoring configuration

**❌ Not Backed Up (Recoverable):**
- Redis cache (ephemeral, rebuilt from DB)
- Docker containers (rebuilt from images)
- Logs (retained separately, not critical)
- IPFS content (decentralized, permanent storage)

---

## Recovery Procedures

### Full System Recovery

**Estimated Time**: 2-4 hours

#### Prerequisites

- [ ] Fresh server/VM provisioned
- [ ] Docker and Docker Compose installed
- [ ] Git repository access
- [ ] Backup files accessible
- [ ] Environment variables documented

#### Steps

**1. Clone Repository**

```bash
# Clone repository
git clone https://github.com/Luminous-Dynamics/Mycelix-Music.git
cd Mycelix-Music

# Checkout production branch
git checkout main
```

**2. Restore Environment Configuration**

```bash
# Copy .env.example to .env
cp .env.example .env

# Edit .env with production values
nano .env

# Required variables:
# - DATABASE_URL
# - REDIS_URL
# - RPC_URL
# - ROUTER_ADDRESS
# - FLOW_TOKEN_ADDRESS
# - All API keys and secrets
```

**3. Restore Database**

```bash
# Download latest backup from S3 (if using S3)
aws s3 cp s3://mycelix-music-backups/backups/mycelix_backup_LATEST.sql.gz.enc ./

# Or use local backup
BACKUP_FILE=/var/backups/mycelix/mycelix_backup_YYYYMMDD_HHMMSS.sql.gz.enc

# Restore database
./scripts/restore.sh $BACKUP_FILE
```

**4. Start Services**

```bash
# Start production stack
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Verify all services started
docker-compose ps

# Check logs
docker-compose logs -f --tail=100
```

**5. Verify Recovery**

```bash
# Run post-deployment checks
./scripts/post-deployment-check.sh

# Manual verification:
# - Visit frontend (https://your-domain.com)
# - Check API health (https://api.your-domain.com/health)
# - Verify metrics (http://localhost:9090)
# - Check Grafana (http://localhost:3001)
```

**6. Resume Traffic**

```bash
# Update DNS if necessary
# Remove maintenance page
# Enable monitoring alerts
# Notify team that system is restored
```

---

## Failure Scenarios

### Scenario 1: Database Corruption

**Symptoms:**
- Database queries failing
- Data inconsistencies
- Corruption errors in logs

**Recovery Steps:**

```bash
# 1. Stop all services
docker-compose down

# 2. Restore from most recent backup
./scripts/restore.sh /var/backups/mycelix/mycelix_backup_LATEST.sql.gz.enc

# 3. Verify database integrity
psql $DATABASE_URL -c "SELECT COUNT(*) FROM songs;"
psql $DATABASE_URL -c "SELECT COUNT(*) FROM plays;"

# 4. Restart services
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# 5. Monitor for errors
docker-compose logs -f api
```

**Prevention:**
- Regular automated backups
- Database replication (future enhancement)
- Monitoring for corruption

---

### Scenario 2: API Server Failure

**Symptoms:**
- 500/503 errors
- Health check failures
- High error rates in metrics

**Recovery Steps:**

```bash
# 1. Check logs
docker-compose logs api

# 2. Restart API service
docker-compose restart api

# 3. If restart doesn't help, rebuild
docker-compose up -d --build api

# 4. If still failing, restore from git
git pull origin main
docker-compose up -d --build api

# 5. Verify recovery
curl http://localhost:3100/health
```

**Prevention:**
- Health checks in Docker Compose
- Auto-restart policies
- Multiple replicas (load balancing)
- Comprehensive error handling

---

### Scenario 3: Complete Server Loss

**Symptoms:**
- Server unreachable
- Hardware failure
- Data center outage

**Recovery Steps:**

```bash
# 1. Provision new server
# - Minimum: 4 CPU, 8GB RAM, 100GB SSD
# - OS: Ubuntu 22.04 LTS

# 2. Install dependencies
sudo apt update
sudo apt install -y docker.io docker-compose git postgresql-client

# 3. Follow "Full System Recovery" procedure above

# 4. Update DNS to point to new server
# - Update A records
# - Wait for propagation (up to 48h with TTL)

# 5. Configure SSL
# - Install certbot
# - Obtain Let's Encrypt certificates
# - Configure nginx

# 6. Verify everything works
./scripts/post-deployment-check.sh
```

**Prevention:**
- Regular off-site backups (S3)
- Infrastructure as Code (Docker Compose)
- Documentation (this file!)
- Multi-region deployment (future)

---

### Scenario 4: Smart Contract Emergency

**Symptoms:**
- Bug discovered in contract
- Economic attack detected
- Unauthorized access

**Recovery Steps:**

**If Emergency Pause Exists:**
```bash
# Pause all contract operations
cast send $ROUTER_ADDRESS "pause()" --private-key $ADMIN_PRIVATE_KEY

# Investigate issue
# Deploy fix
# Resume operations
cast send $ROUTER_ADDRESS "unpause()" --private-key $ADMIN_PRIVATE_KEY
```

**If No Pause Mechanism:**
```bash
# 1. Deploy new fixed contracts
forge script script/DeployMainnet.s.sol --rpc-url $RPC_URL --broadcast

# 2. Migrate data to new contracts
# - Update ROUTER_ADDRESS in .env
# - Run migration script (if needed)

# 3. Update frontend to use new addresses
# - Update NEXT_PUBLIC_ROUTER_ADDRESS

# 4. Communicate with users
# - Announce contract migration
# - Provide instructions for users
```

**Prevention:**
- Comprehensive testing before deployment
- Security audits
- Bug bounty program
- Emergency pause mechanism (if applicable)

---

### Scenario 5: IPFS Content Loss

**Symptoms:**
- Music files not loading
- 404 errors on IPFS gateway
- Metadata missing

**Recovery Steps:**

IPFS content is **permanent and decentralized**, so true loss is unlikely. However:

```bash
# 1. Check if content exists on another gateway
# Try multiple gateways:
# - https://ipfs.io/ipfs/HASH
# - https://cloudflare-ipfs.com/ipfs/HASH
# - https://gateway.pinata.cloud/ipfs/HASH

# 2. If found, pin to your node
ipfs pin add HASH

# 3. If not found anywhere (extremely rare):
# - Content must be re-uploaded by artist
# - Update database with new IPFS hash
```

**Prevention:**
- Pin important content to multiple services
- Use Pinata, Web3.Storage, or similar pinning service
- Keep local copies during upload process
- Encourage artists to keep original files

---

## Contact Information

### On-Call Rotation

| Role | Name | Contact | Backup |
|------|------|---------|--------|
| DevOps Lead | [Name] | [Phone/Email] | [Backup Name] |
| Backend Lead | [Name] | [Phone/Email] | [Backup Name] |
| Smart Contract Lead | [Name] | [Phone/Email] | [Backup Name] |

### External Services

| Service | Purpose | Contact | Support URL |
|---------|---------|---------|-------------|
| AWS | Backup storage | [Account] | https://console.aws.amazon.com |
| Infura | RPC endpoint | [Account] | https://infura.io/support |
| Cloudflare | CDN/DDoS | [Account] | https://cloudflare.com/support |

### Emergency Procedures

**Critical (System Down):**
1. Call DevOps Lead immediately
2. Create incident in PagerDuty (if configured)
3. Post in #incidents Slack channel
4. Begin recovery procedures
5. Update status page

**High (Degraded Performance):**
1. Create ticket in issue tracker
2. Notify relevant team lead
3. Investigate root cause
4. Implement fix or workaround

**Medium (Non-critical):**
1. Create ticket
2. Address during business hours

---

## Testing & Drills

### Monthly Backup Test

**First Monday of every month:**

```bash
# 1. Download latest backup
aws s3 cp s3://mycelix-music-backups/backups/mycelix_backup_LATEST.sql.gz.enc ./test-restore/

# 2. Spin up test database
docker run -d --name test-postgres -e POSTGRES_PASSWORD=test postgres:15-alpine

# 3. Restore to test database
TEST_DATABASE_URL=postgresql://postgres:test@localhost:5432/test \
./scripts/restore.sh test-restore/mycelix_backup_LATEST.sql.gz.enc

# 4. Verify data
psql $TEST_DATABASE_URL -c "SELECT COUNT(*) FROM songs;"

# 5. Cleanup
docker rm -f test-postgres
```

**Document Results:**
- Backup file integrity: ✅/❌
- Restore successful: ✅/❌
- Data complete: ✅/❌
- Time taken: ___ minutes
- Issues encountered: ___

### Quarterly Disaster Recovery Drill

**Simulate full system recovery:**

1. **Preparation:**
   - Schedule drill in advance
   - Notify team
   - Prepare test environment

2. **Execution:**
   - Follow "Full System Recovery" procedure
   - Use test environment (not production!)
   - Time each step
   - Document issues

3. **Review:**
   - Did we meet RTO target?
   - What went wrong?
   - What can be improved?
   - Update this document

4. **Improvement:**
   - Fix identified issues
   - Update procedures
   - Train team on changes

---

## Runbook Quick Reference

### Common Commands

**Check System Health:**
```bash
./scripts/post-deployment-check.sh
```

**View Logs:**
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f api

# Last 100 lines
docker-compose logs --tail=100 api
```

**Restart Service:**
```bash
docker-compose restart api
```

**Database Connection:**
```bash
psql $DATABASE_URL
```

**Redis Connection:**
```bash
redis-cli -u $REDIS_URL
```

**Check Disk Space:**
```bash
df -h
du -sh /var/backups/mycelix
```

**Monitor Resources:**
```bash
docker stats
```

---

## Updates & Maintenance

**This document should be reviewed:**
- After any major infrastructure change
- After each disaster recovery drill
- When team members change
- Quarterly at minimum

**Last Reviewed**: 2025-11-15
**Next Review**: 2026-02-15
**Reviewed By**: [Name]

---

## Additional Resources

- [Production Deployment Guide](DEPLOYMENT.md)
- [Security Audit Checklist](SECURITY_AUDIT.md)
- [Monitoring Guide](docs/ANALYTICS.md)
- [API Documentation](docs/API.md)

---

**Remember**: In a disaster, stay calm, follow the procedures, and communicate with the team. The system is designed to be recoverable!
