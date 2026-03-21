"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.collectCpuMetrics = collectCpuMetrics;
exports.getCpuInfo = getCpuInfo;
const node_os_1 = __importDefault(require("node:os"));
const logger_js_1 = require("../utils/logger.js");
const logger = (0, logger_js_1.getLogger)();
// Cache para cálculo de uso
let previousCpuTimes = null;
let previousTimestamp = 0;
/**
 * Coleta métricas de CPU
 */
async function collectCpuMetrics() {
    const cpus = node_os_1.default.cpus();
    // loadaverage não está disponível no Windows, retorna [0,0,0]
    let loadAvg = [0, 0, 0];
    try {
        if (typeof node_os_1.default.loadavg === 'function') {
            loadAvg = node_os_1.default.loadavg();
        }
    }
    catch {
        // Ignora erro no Windows
    }
    // Calcula uso de CPU
    const usageInfo = calculateCpuUsage(cpus);
    return {
        cores: cpus.length,
        model: cpus[0]?.model || 'Unknown',
        speed: cpus[0]?.speed || 0,
        usagePercent: usageInfo.total,
        perCore: usageInfo.perCore,
        loadAverage: loadAvg,
    };
}
/**
 * Calcula uso de CPU em porcentagem
 */
function calculateCpuUsage(cpus) {
    const currentTimestamp = Date.now();
    if (!previousCpuTimes || currentTimestamp - previousTimestamp > 5000) {
        // Primeira medição ou medição muito antiga
        previousCpuTimes = cpus;
        previousTimestamp = currentTimestamp;
        // Retorna uso instantâneo baseado em idle
        const perCore = cpus.map(cpu => {
            const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
            const idle = cpu.times.idle;
            return Math.round((1 - idle / total) * 100);
        });
        const total = Math.round(perCore.reduce((a, b) => a + b, 0) / perCore.length);
        return { total, perCore };
    }
    // Calcula diferença desde última medição
    const perCore = cpus.map((cpu, i) => {
        const prev = previousCpuTimes[i];
        const totalDiff = (cpu.times.user - prev.times.user) +
            (cpu.times.nice - prev.times.nice) +
            (cpu.times.sys - prev.times.sys) +
            (cpu.times.idle - prev.times.idle) +
            (cpu.times.irq - prev.times.irq);
        const idleDiff = cpu.times.idle - prev.times.idle;
        if (totalDiff === 0)
            return 0;
        return Math.round((1 - idleDiff / totalDiff) * 100);
    });
    const total = Math.round(perCore.reduce((a, b) => a + b, 0) / perCore.length);
    // Atualiza cache
    previousCpuTimes = cpus;
    previousTimestamp = currentTimestamp;
    return { total, perCore };
}
/**
 * Obtém informações detalhadas de CPU
 */
function getCpuInfo() {
    const cpus = node_os_1.default.cpus();
    const firstCpu = cpus[0];
    // Tenta extrair fabricante do modelo
    const model = firstCpu?.model || '';
    let manufacturer = 'Unknown';
    if (model.toLowerCase().includes('intel')) {
        manufacturer = 'Intel';
    }
    else if (model.toLowerCase().includes('amd')) {
        manufacturer = 'AMD';
    }
    else if (model.toLowerCase().includes('arm')) {
        manufacturer = 'ARM';
    }
    return {
        manufacturer,
        brand: model,
        cores: cpus.length,
        physicalCores: cpus.length, // Node não fornece cores físicos vs lógicos
        speedMHz: firstCpu?.speed || 0,
    };
}
//# sourceMappingURL=cpu.js.map