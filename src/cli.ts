#!/usr/bin/env node
/**
 * postgresql-mcp CLI entry point
 */

import { main, VERSION } from './index.js';

console.log(`postgres-mcp v${VERSION}`);
main();
