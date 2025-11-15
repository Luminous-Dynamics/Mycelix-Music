#!/bin/bash
# ============================================================================
# Monitoring Setup Script
# ============================================================================
# Sets up Prometheus, Grafana, and exporters for comprehensive monitoring
# ============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Mycelix Music - Monitoring Setup${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo ""

# ============================================================================
# 1. Create Monitoring Directory Structure
# ============================================================================

echo -e "${YELLOW}[1/5] Creating monitoring directory structure...${NC}"

mkdir -p monitoring/dashboards
mkdir -p monitoring/alerts
mkdir -p monitoring/exporters

echo -e "${GREEN}✓ Directory structure created${NC}"
echo ""

# ============================================================================
# 2. Setup PostgreSQL Exporter
# ============================================================================

echo -e "${YELLOW}[2/5] Setting up PostgreSQL exporter...${NC}"

cat > monitoring/exporters/docker-compose.postgres-exporter.yml << 'EOF'
version: '3.8'

services:
  postgres-exporter:
    image: prometheuscommunity/postgres-exporter:latest
    restart: always
    environment:
      DATA_SOURCE_NAME: ${DATABASE_URL}
    ports:
      - "9187:9187"
    networks:
      - mycelix-network
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:9187/metrics"]
      interval: 30s
      timeout: 5s
      retries: 3

networks:
  mycelix-network:
    external: true
EOF

echo -e "${GREEN}✓ PostgreSQL exporter configured${NC}"
echo ""

# ============================================================================
# 3. Setup Redis Exporter
# ============================================================================

echo -e "${YELLOW}[3/5] Setting up Redis exporter...${NC}"

cat > monitoring/exporters/docker-compose.redis-exporter.yml << 'EOF'
version: '3.8'

services:
  redis-exporter:
    image: oliver006/redis_exporter:latest
    restart: always
    environment:
      REDIS_ADDR: redis:6379
    ports:
      - "9121:9121"
    networks:
      - mycelix-network
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:9121/metrics"]
      interval: 30s
      timeout: 5s
      retries: 3

networks:
  mycelix-network:
    external: true
EOF

echo -e "${GREEN}✓ Redis exporter configured${NC}"
echo ""

# ============================================================================
# 4. Setup Node Exporter
# ============================================================================

echo -e "${YELLOW}[4/5] Setting up Node exporter...${NC}"

cat > monitoring/exporters/docker-compose.node-exporter.yml << 'EOF'
version: '3.8'

services:
  node-exporter:
    image: prom/node-exporter:latest
    restart: always
    command:
      - '--path.procfs=/host/proc'
      - '--path.sysfs=/host/sys'
      - '--path.rootfs=/rootfs'
      - '--collector.filesystem.mount-points-exclude=^/(sys|proc|dev|host|etc)($$|/)'
    volumes:
      - /proc:/host/proc:ro
      - /sys:/host/sys:ro
      - /:/rootfs:ro
    ports:
      - "9100:9100"
    networks:
      - mycelix-network

networks:
  mycelix-network:
    external: true
EOF

echo -e "${GREEN}✓ Node exporter configured${NC}"
echo ""

# ============================================================================
# 5. Create Alertmanager Configuration
# ============================================================================

echo -e "${YELLOW}[5/5] Setting up Alertmanager...${NC}"

cat > monitoring/alertmanager.yml << 'EOF'
global:
  resolve_timeout: 5m
  slack_api_url: ${SLACK_WEBHOOK_URL}

route:
  group_by: ['alertname', 'cluster', 'service']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 12h
  receiver: 'default'
  routes:
    - match:
        severity: critical
      receiver: 'critical'
      continue: true
    - match:
        severity: warning
      receiver: 'warning'

receivers:
  - name: 'default'
    slack_configs:
      - channel: '#mycelix-alerts'
        title: 'Mycelix Music Alert'
        text: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'

  - name: 'critical'
    slack_configs:
      - channel: '#mycelix-critical'
        title: '🚨 CRITICAL: {{ .GroupLabels.alertname }}'
        text: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'
    # Add PagerDuty or email for critical alerts
    # pagerduty_configs:
    #   - service_key: ${PAGERDUTY_SERVICE_KEY}

  - name: 'warning'
    slack_configs:
      - channel: '#mycelix-alerts'
        title: '⚠️  WARNING: {{ .GroupLabels.alertname }}'
        text: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'
EOF

cat > monitoring/exporters/docker-compose.alertmanager.yml << 'EOF'
version: '3.8'

services:
  alertmanager:
    image: prom/alertmanager:latest
    restart: always
    ports:
      - "9093:9093"
    volumes:
      - ../alertmanager.yml:/etc/alertmanager/config.yml:ro
      - alertmanager_data:/alertmanager
    command:
      - '--config.file=/etc/alertmanager/config.yml'
      - '--storage.path=/alertmanager'
    networks:
      - mycelix-network

volumes:
  alertmanager_data:

networks:
  mycelix-network:
    external: true
EOF

echo -e "${GREEN}✓ Alertmanager configured${NC}"
echo ""

# ============================================================================
# Create Startup Script
# ============================================================================

cat > monitoring/start-monitoring.sh << 'EOF'
#!/bin/bash
# Start all monitoring services

set -e

echo "Starting monitoring stack..."

# Start exporters
docker-compose -f exporters/docker-compose.postgres-exporter.yml up -d
docker-compose -f exporters/docker-compose.redis-exporter.yml up -d
docker-compose -f exporters/docker-compose.node-exporter.yml up -d
docker-compose -f exporters/docker-compose.alertmanager.yml up -d

# Start Prometheus and Grafana (from main docker-compose.prod.yml)
docker-compose -f ../docker-compose.prod.yml up -d prometheus grafana

echo "✓ Monitoring stack started"
echo ""
echo "Access points:"
echo "  Prometheus:   http://localhost:9090"
echo "  Grafana:      http://localhost:3001"
echo "  Alertmanager: http://localhost:9093"
EOF

chmod +x monitoring/start-monitoring.sh

# ============================================================================
# Create Grafana Provisioning
# ============================================================================

mkdir -p monitoring/grafana-provisioning/datasources
mkdir -p monitoring/grafana-provisioning/dashboards

cat > monitoring/grafana-provisioning/datasources/prometheus.yml << 'EOF'
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    editable: true
EOF

cat > monitoring/grafana-provisioning/dashboards/dashboards.yml << 'EOF'
apiVersion: 1

providers:
  - name: 'Mycelix Dashboards'
    orgId: 1
    folder: ''
    type: file
    disableDeletion: false
    updateIntervalSeconds: 10
    allowUiUpdates: true
    options:
      path: /etc/grafana/provisioning/dashboards
EOF

echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✓ Monitoring setup complete!${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo ""
echo "Next steps:"
echo "  1. Configure SLACK_WEBHOOK_URL in .env"
echo "  2. Run: cd monitoring && ./start-monitoring.sh"
echo "  3. Access Grafana at http://localhost:3001"
echo "  4. Default credentials: admin/admin (change on first login)"
echo ""
