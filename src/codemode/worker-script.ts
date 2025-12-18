/**
 * postgres-mcp - Code Mode Worker Script
 * 
 * This script runs in a worker thread to execute user code in isolation.
 * It uses Node.js vm module within the worker for additional sandboxing.
 */

import { parentPort, workerData } from 'node:worker_threads';
import vm from 'node:vm';

interface WorkerData {
    code: string;
    apiBindings: Record<string, string[]>;
    timeout: number;
}

interface WorkerResult {
    success: boolean;
    result?: unknown;
    error?: string | undefined;
    stack?: string | undefined;
}

/**
 * Execute code in a sandboxed vm context within the worker
 */
async function executeCode(): Promise<void> {
    const { code, timeout } = workerData as WorkerData;

    try {
        // Create minimal sandbox context
        const logBuffer: string[] = [];
        const sandbox = {
            console: {
                log: (...args: unknown[]) => {
                    logBuffer.push(args.map(a =>
                        typeof a === 'object' && a !== null ? JSON.stringify(a) : String(a)
                    ).join(' '));
                },
                warn: (...args: unknown[]) => logBuffer.push('[WARN] ' + args.map(a => String(a)).join(' ')),
                error: (...args: unknown[]) => logBuffer.push('[ERROR] ' + args.map(a => String(a)).join(' ')),
                info: (...args: unknown[]) => logBuffer.push('[INFO] ' + args.map(a => String(a)).join(' '))
            },
            // Block dangerous globals
            require: undefined,
            process: undefined,
            global: undefined,
            globalThis: undefined,
            __dirname: undefined,
            __filename: undefined,
            module: undefined,
            exports: undefined,
            // Safe built-ins
            JSON,
            Math,
            Date,
            Array,
            Object,
            String,
            Number,
            Boolean,
            Map,
            Set,
            Promise,
            Error,
            TypeError,
            RangeError,
            SyntaxError,
            // Disabled for security
            setTimeout: undefined,
            setInterval: undefined,
            setImmediate: undefined,
            // pg API placeholder (populated by main thread via message passing)
            pg: {}
        };

        const context = vm.createContext(sandbox);

        // Wrap code in async IIFE to support await
        const wrappedCode = `
            (async () => {
                ${code}
            })();
        `;

        // Compile and run with timeout
        const script = new vm.Script(wrappedCode, {
            filename: 'worker-codemode-script.js'
        });

        const result = await (script.runInContext(context, {
            timeout,
            breakOnSigint: true
        }) as Promise<unknown>);

        const response: WorkerResult = {
            success: true,
            result
        };

        parentPort?.postMessage(response);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const stack = error instanceof Error ? error.stack : undefined;

        // Check for timeout
        if (errorMessage.includes('Script execution timed out')) {
            const response: WorkerResult = {
                success: false,
                error: `Execution timeout: exceeded ${String(timeout)}ms limit`,
                stack
            };
            parentPort?.postMessage(response);
            return;
        }

        const response: WorkerResult = {
            success: false,
            error: errorMessage,
            stack
        };

        parentPort?.postMessage(response);
    }
}

// Execute immediately
executeCode().catch((error: unknown) => {
    const response: WorkerResult = {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
    };
    parentPort?.postMessage(response);
});
