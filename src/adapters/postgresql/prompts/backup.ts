/**
 * Backup Strategy Prompt
 * 
 * Enterprise backup planning with RTO/RPO considerations.
 */

import type { PromptDefinition, RequestContext } from '../../../types/index.js';

export function createBackupStrategyPrompt(): PromptDefinition {
    return {
        name: 'pg_backup_strategy',
        description: 'Design enterprise backup strategy with logical, physical, and continuous archiving options.',
        arguments: [
            {
                name: 'backupType',
                description: 'Backup type: logical, physical, or continuous',
                required: false
            },
            {
                name: 'retentionDays',
                description: 'Retention period in days (default: 30)',
                required: false
            }
        ],
        // eslint-disable-next-line @typescript-eslint/require-await
        handler: async (args: Record<string, string>, _context: RequestContext): Promise<string> => {
            const backupType = args['backupType'] ?? 'logical';
            const retentionDays = args['retentionDays'] ?? '30';

            let content = `# Enterprise Backup Strategy - ${backupType.charAt(0).toUpperCase() + backupType.slice(1)} Backup

Retention Period: **${retentionDays} days**

## Backup Types Overview

**Logical Backup (pg_dump/pg_dumpall):**
- ✅ Portable across PostgreSQL versions
- ✅ Selective backup (specific schemas/tables)
- ❌ Slower for large databases

**Physical Backup (pg_basebackup):**
- ✅ Fast backup for large databases
- ✅ Supports point-in-time recovery (PITR)
- ❌ PostgreSQL version specific

**Continuous Archiving (WAL):**
- ✅ Point-in-time recovery to any second
- ✅ Minimal data loss (RPO < 1 minute)
- ❌ More complex to set up

## Setup Steps

### 1. Assess Database Size

\`\`\`sql
SELECT pg_size_pretty(pg_database_size(current_database())) as total_size;
\`\`\`

Use \`pg_capacity_planning\` to analyze growth patterns.

### 2. Backup Schedule
`;

            if (backupType === 'logical') {
                content += `
**Logical Backup Schedule:**

- **Full Backup:** Daily at 2:00 AM
  \`\`\`bash
  pg_dump -Fc -Z9 -f /backup/db_$(date +%Y%m%d).dump dbname
  \`\`\`

- **Schema-Only Backup:** Daily at 1:00 AM
  \`\`\`bash
  pg_dump --schema-only -f /backup/schema_$(date +%Y%m%d).sql dbname
  \`\`\`
`;
            } else if (backupType === 'physical') {
                content += `
**Physical Backup Schedule:**

- **Base Backup:** Weekly on Sunday at 2:00 AM
  \`\`\`bash
  pg_basebackup -D /backup/base_$(date +%Y%m%d) -Ft -z -P
  \`\`\`

- **WAL Archiving:** Configure in postgresql.conf
  \`\`\`
  archive_mode = on
  archive_command = 'cp %p /backup/wal/%f'
  \`\`\`
`;
            } else {
                content += `
**Continuous Archiving Schedule:**

- **Base Backup:** Weekly on Sunday at 2:00 AM
- **WAL Archiving:** Continuous (every 16MB or 1 minute)
- **PITR:** Available to any point in time
`;
            }

            content += `
### 3. Implement Backup

Use \`pg_backup_logical\` or \`pg_backup_physical\` tool.

### 4. Validate Backup

Use \`pg_restore_validate\` to verify backup integrity:
- Check disk space
- Check connections
- Verify constraints

### 5. Recovery Procedures

**Full Database Restore:**
\`\`\`bash
dropdb dbname
createdb dbname
pg_restore -d dbname /backup/latest.dump
\`\`\`

## Disaster Recovery Plan

1. **RTO (Recovery Time Objective):** How quickly must database be restored?
2. **RPO (Recovery Point Objective):** How much data loss is acceptable?
3. **Off-site Backups:** Store copies in different location/cloud
4. **Test Restores:** Practice quarterly

**Pro Tip:** The best backup is the one you've successfully restored - test your backups regularly!`;

            return content;
        }
    };
}
