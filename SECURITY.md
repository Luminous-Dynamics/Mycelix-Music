# Security Policy

## Reporting a Vulnerability

The Mycelix Music team takes security seriously. We appreciate your efforts to responsibly disclose your findings.

### Please DO NOT:

- Open a public GitHub issue for security vulnerabilities
- Disclose the vulnerability publicly before it has been addressed

### Please DO:

1. **Email us**: security@mycelix.net (or create a private security advisory on GitHub)
2. **Include**:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)
3. **Allow time**: Give us reasonable time to address the issue before public disclosure

## Security Considerations

### Smart Contracts

- All contracts undergo security review
- Critical functions have access control
- Input validation on all external calls
- Reentrancy guards where needed
- ERC20 approval race condition prevention

### API Security

- Rate limiting (100 req/min)
- Input validation on all endpoints
- Parameterized SQL queries
- Security headers (XSS, clickjacking protection)
- Environment variable validation

### Best Practices

If you're deploying Mycelix Music:

1. **Never commit secrets** to version control
2. **Use strong passwords** for database and Redis
3. **Enable SSL/TLS** in production
4. **Keep dependencies updated**
5. **Monitor logs** for suspicious activity
6. **Use hardware wallets** for high-value accounts
7. **Audit contracts** before mainnet deployment

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.2.x   | :white_check_mark: |
| < 0.2   | :x:                |

## Security Updates

Security updates will be released as patch versions and announced via:
- GitHub Security Advisories
- Release notes
- Project README

## Acknowledgments

We thank the security researchers who responsibly disclose vulnerabilities to us.

Security researchers who report valid vulnerabilities will be:
- Acknowledged in our security hall of fame (with permission)
- Given credit in release notes
- Invited to test future updates

---

**Contact**: security@mycelix.net
**PGP Key**: (coming soon)
