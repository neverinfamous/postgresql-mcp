# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability, please report it by emailing **admin@adamic.tech**.

**Please do NOT report security vulnerabilities through public GitHub issues.**

### What to Include

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Any suggested fixes (optional)

### Response Timeline

- **Initial Response**: Within 48 hours
- **Status Update**: Within 7 days
- **Resolution**: Depends on severity and complexity

### What to Expect

1. Acknowledgment of your report
2. Assessment of the vulnerability
3. Development of a fix
4. Coordinated disclosure (if applicable)
5. Credit in the release notes (unless you prefer anonymity)

## Security Best Practices

When using postgres-mcp:

- Never commit database credentials to version control
- Use environment variables for sensitive configuration
- Restrict database user permissions to minimum required
- Keep dependencies updated
- Enable SSL for database connections in production
