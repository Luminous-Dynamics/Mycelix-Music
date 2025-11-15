#!/bin/bash
# ============================================================================
# Security Scanning Script
# ============================================================================
# Runs automated security scans across the entire platform
# ============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Mycelix Music - Security Scan${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo ""

ISSUES_FOUND=0

# ============================================================================
# 1. Smart Contract Security Scan
# ============================================================================

echo -e "${YELLOW}[1/6] Smart Contract Security Scan${NC}"

if command -v slither &> /dev/null; then
    echo "  Running Slither static analysis..."
    if slither contracts/ --exclude-dependencies --filter-paths "test" > /tmp/slither-report.txt 2>&1; then
        echo -e "${GREEN}  ✓ Slither analysis complete${NC}"

        # Check for high/critical issues
        if grep -qi "high\|critical" /tmp/slither-report.txt; then
            echo -e "${RED}  ✗ High/Critical issues found!${NC}"
            grep -i "high\|critical" /tmp/slither-report.txt
            ((ISSUES_FOUND++))
        fi
    else
        echo -e "${YELLOW}  ⚠ Slither analysis had warnings${NC}"
        cat /tmp/slither-report.txt
    fi
else
    echo -e "${YELLOW}  ⚠ Slither not installed, skipping${NC}"
    echo "    Install with: pip3 install slither-analyzer"
fi

# Run Foundry tests with coverage
echo "  Running contract tests with coverage..."
if forge test --gas-report > /tmp/forge-test.txt 2>&1; then
    echo -e "${GREEN}  ✓ All contract tests passed${NC}"
else
    echo -e "${RED}  ✗ Contract tests failed${NC}"
    tail -20 /tmp/forge-test.txt
    ((ISSUES_FOUND++))
fi

echo ""

# ============================================================================
# 2. Dependency Vulnerability Scan
# ============================================================================

echo -e "${YELLOW}[2/6] Dependency Vulnerability Scan${NC}"

# Check root dependencies
echo "  Scanning root dependencies..."
if npm audit --production --audit-level=high > /tmp/npm-audit-root.txt 2>&1; then
    echo -e "${GREEN}  ✓ No high/critical vulnerabilities in root${NC}"
else
    echo -e "${RED}  ✗ Vulnerabilities found in root dependencies${NC}"
    cat /tmp/npm-audit-root.txt
    ((ISSUES_FOUND++))
fi

# Check API dependencies
echo "  Scanning API dependencies..."
cd apps/api
if npm audit --production --audit-level=high > /tmp/npm-audit-api.txt 2>&1; then
    echo -e "${GREEN}  ✓ No high/critical vulnerabilities in API${NC}"
else
    echo -e "${RED}  ✗ Vulnerabilities found in API dependencies${NC}"
    cat /tmp/npm-audit-api.txt
    ((ISSUES_FOUND++))
fi
cd ../..

# Check Web dependencies
echo "  Scanning Web dependencies..."
cd apps/web
if npm audit --production --audit-level=high > /tmp/npm-audit-web.txt 2>&1; then
    echo -e "${GREEN}  ✓ No high/critical vulnerabilities in Web${NC}"
else
    echo -e "${RED}  ✗ Vulnerabilities found in Web dependencies${NC}"
    cat /tmp/npm-audit-web.txt
    ((ISSUES_FOUND++))
fi
cd ../..

echo ""

# ============================================================================
# 3. Docker Image Security Scan
# ============================================================================

echo -e "${YELLOW}[3/6] Docker Image Security Scan${NC}"

if command -v docker &> /dev/null; then
    # Build images if they don't exist
    if ! docker images | grep -q "mycelix-api"; then
        echo "  Building API image for scanning..."
        docker build -f apps/api/Dockerfile.prod -t mycelix-api:security-scan . > /dev/null 2>&1
    fi

    if ! docker images | grep -q "mycelix-web"; then
        echo "  Building Web image for scanning..."
        docker build -f apps/web/Dockerfile.prod -t mycelix-web:security-scan . > /dev/null 2>&1
    fi

    # Scan images
    if command -v trivy &> /dev/null; then
        echo "  Scanning API image with Trivy..."
        if trivy image --severity HIGH,CRITICAL mycelix-api:security-scan > /tmp/trivy-api.txt 2>&1; then
            echo -e "${GREEN}  ✓ No critical vulnerabilities in API image${NC}"
        else
            echo -e "${RED}  ✗ Vulnerabilities found in API image${NC}"
            cat /tmp/trivy-api.txt
            ((ISSUES_FOUND++))
        fi

        echo "  Scanning Web image with Trivy..."
        if trivy image --severity HIGH,CRITICAL mycelix-web:security-scan > /tmp/trivy-web.txt 2>&1; then
            echo -e "${GREEN}  ✓ No critical vulnerabilities in Web image${NC}"
        else
            echo -e "${RED}  ✗ Vulnerabilities found in Web image${NC}"
            cat /tmp/trivy-web.txt
            ((ISSUES_FOUND++))
        fi
    else
        echo -e "${YELLOW}  ⚠ Trivy not installed, skipping image scan${NC}"
        echo "    Install with: brew install aquasecurity/trivy/trivy"
    fi
else
    echo -e "${YELLOW}  ⚠ Docker not available, skipping image scan${NC}"
fi

echo ""

# ============================================================================
# 4. Secrets Detection
# ============================================================================

echo -e "${YELLOW}[4/6] Secrets Detection${NC}"

if command -v gitleaks &> /dev/null; then
    echo "  Scanning for leaked secrets..."
    if gitleaks detect --no-git --source . > /tmp/gitleaks.txt 2>&1; then
        echo -e "${GREEN}  ✓ No secrets detected${NC}"
    else
        echo -e "${RED}  ✗ Potential secrets found!${NC}"
        cat /tmp/gitleaks.txt
        ((ISSUES_FOUND++))
    fi
else
    echo -e "${YELLOW}  ⚠ Gitleaks not installed, scanning manually...${NC}"

    # Basic manual scan for common patterns
    if grep -r -i "private_key\|api_key\|secret\|password" --include="*.js" --include="*.ts" --include="*.sol" . | \
       grep -v "test\|example\|node_modules" | \
       grep -v "^Binary file"; then
        echo -e "${RED}  ✗ Potential hardcoded secrets found${NC}"
        ((ISSUES_FOUND++))
    else
        echo -e "${GREEN}  ✓ No obvious secrets in code${NC}"
    fi
fi

# Check for .env file in repo
if git ls-files | grep -q "^.env$"; then
    echo -e "${RED}  ✗ .env file is tracked in git!${NC}"
    ((ISSUES_FOUND++))
else
    echo -e "${GREEN}  ✓ .env not tracked in git${NC}"
fi

echo ""

# ============================================================================
# 5. Code Quality & Security Linting
# ============================================================================

echo -e "${YELLOW}[5/6] Code Quality & Security Linting${NC}"

# TypeScript/JavaScript linting
echo "  Running ESLint security checks..."
if npm run lint > /tmp/eslint.txt 2>&1; then
    echo -e "${GREEN}  ✓ ESLint checks passed${NC}"
else
    echo -e "${YELLOW}  ⚠ ESLint found issues${NC}"
    grep -i "error\|warning" /tmp/eslint.txt | head -20
fi

# Solidity linting
if command -v solhint &> /dev/null; then
    echo "  Running Solhint security checks..."
    if solhint 'contracts/**/*.sol' > /tmp/solhint.txt 2>&1; then
        echo -e "${GREEN}  ✓ Solhint checks passed${NC}"
    else
        echo -e "${YELLOW}  ⚠ Solhint found issues${NC}"
        cat /tmp/solhint.txt
    fi
else
    echo -e "${YELLOW}  ⚠ Solhint not installed, skipping${NC}"
fi

echo ""

# ============================================================================
# 6. Configuration Security Check
# ============================================================================

echo -e "${YELLOW}[6/6] Configuration Security Check${NC}"

# Check Docker Compose security settings
echo "  Checking Docker Compose configurations..."

COMPOSE_ISSUES=0

# Check for privileged mode
if grep -q "privileged: true" docker-compose*.yml; then
    echo -e "${RED}  ✗ Containers running in privileged mode${NC}"
    ((COMPOSE_ISSUES++))
fi

# Check for host network mode
if grep -q "network_mode: host" docker-compose*.yml; then
    echo -e "${RED}  ✗ Containers using host network${NC}"
    ((COMPOSE_ISSUES++))
fi

# Check for root user
if grep -q "user: root" docker-compose*.yml; then
    echo -e "${RED}  ✗ Containers running as root user${NC}"
    ((COMPOSE_ISSUES++))
fi

if [ $COMPOSE_ISSUES -eq 0 ]; then
    echo -e "${GREEN}  ✓ Docker Compose security checks passed${NC}"
else
    ((ISSUES_FOUND++))
fi

# Check Nginx configuration (if exists)
if [ -f "nginx/nginx.conf" ]; then
    echo "  Checking Nginx security headers..."

    NGINX_ISSUES=0

    if ! grep -q "X-Frame-Options" nginx/nginx.conf; then
        echo -e "${YELLOW}  ⚠ Missing X-Frame-Options header${NC}"
        ((NGINX_ISSUES++))
    fi

    if ! grep -q "X-Content-Type-Options" nginx/nginx.conf; then
        echo -e "${YELLOW}  ⚠ Missing X-Content-Type-Options header${NC}"
        ((NGINX_ISSUES++))
    fi

    if ! grep -q "Strict-Transport-Security" nginx/nginx.conf; then
        echo -e "${YELLOW}  ⚠ Missing HSTS header${NC}"
        ((NGINX_ISSUES++))
    fi

    if [ $NGINX_ISSUES -eq 0 ]; then
        echo -e "${GREEN}  ✓ Nginx security headers configured${NC}"
    fi
fi

echo ""

# ============================================================================
# Summary
# ============================================================================

echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"

if [ $ISSUES_FOUND -eq 0 ]; then
    echo -e "${GREEN}✓ Security scan complete - No critical issues found${NC}"
    echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
    exit 0
else
    echo -e "${RED}✗ Security scan found $ISSUES_FOUND issue(s)${NC}"
    echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
    echo ""
    echo "Please review the issues above before deploying to production."
    echo "See SECURITY_AUDIT.md for detailed security guidelines."
    exit 1
fi
