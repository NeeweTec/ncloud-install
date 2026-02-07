"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.collectMetrics = collectMetrics;
exports.getMetrics = getMetrics;
exports.startMetricsCollection = startMetricsCollection;
exports.stopMetricsCollection = stopMetricsCollection;
const node_os_1 = __importDefault(require("node:os"));
const cpu_js_1 = require("./cpu.js");
const memory_js_1 = require("./memory.js");
const disk_js_1 = require("./disk.js");
const logger_js_1 = require("../utils/logger.js");
__exportStar(require("./cpu.js"), exports);
__exportStar(require("./memory.js"), exports);
__exportStar(require("./disk.js"), exports);
const logger = (0, logger_js_1.getLogger)();
/**
 * Coleta todas as métricas do sistema
 */
async function collectMetrics() {
    logger.debug('Collecting system metrics');
    const [cpu, memory, disk] = await Promise.all([
        (0, cpu_js_1.collectCpuMetrics)(),
        (0, memory_js_1.collectMemoryMetrics)(),
        (0, disk_js_1.collectDiskMetrics)(),
    ]);
    const networkInterfaces = getNetworkInterfaces();
    const processInfo = await getProcessCount();
    // loadavg não disponível no Windows
    let loadAvg = [0, 0, 0];
    try {
        if (typeof node_os_1.default.loadavg === 'function') {
            loadAvg = node_os_1.default.loadavg();
        }
    }
    catch {
        // Ignora
    }
    return {
        timestamp: new Date().toISOString(),
        system: {
            hostname: node_os_1.default.hostname(),
            uptime: node_os_1.default.uptime(),
            loadAverage: loadAvg,
            platform: process.platform,
            arch: process.arch,
        },
        cpu,
        memory,
        disk,
        network: {
            interfaces: networkInterfaces,
        },
        processes: processInfo,
    };
}
/**
 * Obtém interfaces de rede
 */
function getNetworkInterfaces() {
    const interfaces = node_os_1.default.networkInterfaces();
    const result = [];
    for (const [name, addrs] of Object.entries(interfaces)) {
        if (!addrs)
            continue;
        for (const addr of addrs) {
            // Ignora loopback e link-local IPv6
            if (addr.internal || addr.address.startsWith('fe80::')) {
                continue;
            }
            result.push({
                name,
                address: addr.address,
                family: addr.family,
            });
        }
    }
    return result;
}
/**
 * Conta processos do sistema
 */
async function getProcessCount() {
    const { exec } = await import('node:child_process');
    const { promisify } = await import('node:util');
    const execAsync = promisify(exec);
    let total = 0;
    let protheusRelated = 0;
    try {
        if (process.platform === 'win32') {
            // Total de processos
            const { stdout: totalOut } = await execAsync('wmic process get processid /format:csv', { encoding: 'utf-8' });
            total = totalOut.trim().split('\n').filter(l => l.includes(',')).length - 1;
            // Processos Protheus
            const { stdout: protheusOut } = await execAsync('wmic process where "name like \'%appserver%\' or name like \'%dbaccess%\'" get processid /format:csv', { encoding: 'utf-8' }).catch(() => ({ stdout: '' }));
            protheusRelated = protheusOut.trim().split('\n').filter(l => l.includes(',')).length - 1;
        }
        else {
            // Total de processos
            const { stdout: totalOut } = await execAsync('ps aux | wc -l', { encoding: 'utf-8' });
            total = parseInt(totalOut.trim(), 10) - 1; // -1 pelo header
            // Processos Protheus
            const { stdout: protheusOut } = await execAsync('ps aux | grep -E "(appsrv|dbaccess)" | grep -v grep | wc -l', { encoding: 'utf-8' }).catch(() => ({ stdout: '0' }));
            protheusRelated = parseInt(protheusOut.trim(), 10);
        }
    }
    catch (error) {
        logger.debug('Error counting processes', { error });
    }
    return { total: Math.max(0, total), protheusRelated: Math.max(0, protheusRelated) };
}
// Cache de métricas para coleta periódica
let metricsCache = null;
let lastCollectTime = 0;
const METRICS_CACHE_TTL = 5000; // 5 segundos
/**
 * Obtém métricas com cache
 */
async function getMetrics() {
    const now = Date.now();
    if (metricsCache && now - lastCollectTime < METRICS_CACHE_TTL) {
        return metricsCache;
    }
    metricsCache = await collectMetrics();
    lastCollectTime = now;
    return metricsCache;
}
/**
 * Inicia coleta periódica de métricas
 */
let metricsInterval = null;
function startMetricsCollection(intervalMs = 30000) {
    if (metricsInterval) {
        return;
    }
    logger.info('Starting periodic metrics collection', { intervalMs });
    metricsInterval = setInterval(async () => {
        try {
            await collectMetrics();
        }
        catch (error) {
            logger.error('Error in periodic metrics collection', { error });
        }
    }, intervalMs);
}
/**
 * Para coleta periódica de métricas
 */
function stopMetricsCollection() {
    if (metricsInterval) {
        clearInterval(metricsInterval);
        metricsInterval = null;
        logger.info('Stopped periodic metrics collection');
    }
}
//# sourceMappingURL=index.js.map