"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.collectMemoryMetrics = collectMemoryMetrics;
exports.getProcessMemoryUsage = getProcessMemoryUsage;
const node_os_1 = __importDefault(require("node:os"));
const node_child_process_1 = require("node:child_process");
const node_util_1 = require("node:util");
const logger_js_1 = require("../utils/logger.js");
const execAsync = (0, node_util_1.promisify)(node_child_process_1.exec);
const logger = (0, logger_js_1.getLogger)();
/**
 * Coleta métricas de memória
 */
async function collectMemoryMetrics() {
    const totalBytes = node_os_1.default.totalmem();
    const freeBytes = node_os_1.default.freemem();
    const usedBytes = totalBytes - freeBytes;
    const usagePercent = Math.round((usedBytes / totalBytes) * 100 * 100) / 100;
    const metrics = {
        totalBytes,
        usedBytes,
        freeBytes,
        usagePercent,
    };
    // Tenta obter informações adicionais específicas do SO
    try {
        if (process.platform === 'linux') {
            const extendedMetrics = await getLinuxMemoryInfo();
            Object.assign(metrics, extendedMetrics);
        }
        else if (process.platform === 'win32') {
            const extendedMetrics = await getWindowsMemoryInfo();
            Object.assign(metrics, extendedMetrics);
        }
    }
    catch (error) {
        logger.debug('Could not get extended memory info', { error });
    }
    return metrics;
}
/**
 * Obtém informações de memória no Linux
 */
async function getLinuxMemoryInfo() {
    const { readFile } = await import('node:fs/promises');
    try {
        const meminfo = await readFile('/proc/meminfo', 'utf-8');
        const lines = meminfo.split('\n');
        const values = {};
        for (const line of lines) {
            const [key, value] = line.split(':');
            if (key && value) {
                // Valor em KB, convertemos para bytes
                const numValue = parseInt(value.trim().split(' ')[0], 10) * 1024;
                values[key.trim()] = numValue;
            }
        }
        const result = {};
        if (values.Cached) {
            result.cached = values.Cached;
        }
        if (values.Buffers) {
            result.buffers = values.Buffers;
        }
        if (values.MemAvailable) {
            result.available = values.MemAvailable;
        }
        // Swap
        if (values.SwapTotal && values.SwapTotal > 0) {
            const swapFree = values.SwapFree || 0;
            const swapUsed = values.SwapTotal - swapFree;
            result.swap = {
                totalBytes: values.SwapTotal,
                usedBytes: swapUsed,
                freeBytes: swapFree,
                usagePercent: Math.round((swapUsed / values.SwapTotal) * 100 * 100) / 100,
            };
        }
        return result;
    }
    catch {
        return {};
    }
}
/**
 * Obtém informações de memória no Windows
 */
async function getWindowsMemoryInfo() {
    try {
        // Usa wmic para obter informações de memória
        const { stdout } = await execAsync('wmic OS get FreePhysicalMemory,TotalVisibleMemorySize /format:csv', { encoding: 'utf-8' });
        const lines = stdout.trim().split('\n').filter(l => l.includes(','));
        if (lines.length > 1) {
            const values = lines[1].split(',');
            if (values.length >= 3) {
                // Valores em KB
                const freeKB = parseInt(values[1], 10);
                const available = freeKB * 1024;
                return { available };
            }
        }
    }
    catch {
        // Ignora erro
    }
    return {};
}
/**
 * Obtém uso de memória de um processo específico
 */
async function getProcessMemoryUsage(pid) {
    try {
        if (process.platform === 'win32') {
            const { stdout } = await execAsync(`wmic process where ProcessId=${pid} get WorkingSetSize /format:csv`, { encoding: 'utf-8' });
            const lines = stdout.trim().split('\n').filter(l => l.includes(','));
            if (lines.length > 1) {
                const values = lines[1].split(',');
                const rss = parseInt(values[1], 10);
                return { rss };
            }
        }
        else {
            const { stdout } = await execAsync(`ps -p ${pid} -o rss=`, { encoding: 'utf-8' });
            const rssKB = parseInt(stdout.trim(), 10);
            return { rss: rssKB * 1024 };
        }
    }
    catch {
        // Processo não existe ou erro
    }
    return null;
}
//# sourceMappingURL=memory.js.map