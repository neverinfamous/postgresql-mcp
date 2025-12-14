# Contributing to postgres-mcp

Thank you for your interest in contributing!

## Development Setup

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/postgres-mcp.git
   cd postgres-mcp
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Create a branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```

## Development Workflow

```bash
# Build
npm run build

# Run linting
npm run lint

# Run type checking
npm run typecheck

# Run all checks
npm run check
```

## Pull Request Process

1. Ensure all checks pass (`npm run check`)
2. Update documentation if needed
3. Add tests for new functionality
4. Submit a pull request with a clear description

## Code Style

- Use TypeScript with strict mode
- Follow ESLint rules (run `npm run lint`)
- Use meaningful variable and function names
- Add JSDoc comments for public APIs

## Reporting Issues

- Use the issue templates
- Provide clear reproduction steps
- Include environment details (OS, Node.js version, PostgreSQL version)

## Questions?

Open an issue or reach out to admin@adamic.tech.
