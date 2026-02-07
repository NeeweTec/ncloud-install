"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.collectDiskMetrics = collectDiskMetrics;
exports.getDirectoryUsage = getDirectoryUsage;
const node_child_process_1 = require("node:child_process");
const node_util_1 = require("node:util");
const node_fs_1 = require("node:fs");
const logger_js_1 = require("../utils/logger.js");
const execAsync = (0, node_util_1.promisify)(node_child_process_1.exec);
const logger = (0, logger_js_1.getLogger)();
/**
 * Coleta métricas de disco
 */
async function collectDiskMetrics() {
    let partitions = [];
    try {
        if (process.platform === 'win32') {
            partitions = await getWindowsDiskInfo();
        }
        else {
            partitions = await getLinuxDiskInfo();
        }
    }
    catch (error) {
        logger.error('Error collecting disk metrics', { error });
    }
    // Calcula totais
    const totalBytes = partitions.reduce((sum, p) => sum + p.totalBytes, 0);
    const usedBytes = partitions.reduce((sum, p) => sum + p.usedBytes, 0);
    const freeBytes = partitions.reduce((sum, p) => sum + p.freeBytes, 0);
    return {
        partitions,
        totalBytes,
        usedBytes,
        freeBytes,
    };
}
/**
 * Obtém informações de disco no Linux
 */
async function getLinuxDiskInfo() {
    const partitions = [];
    try {
        const { stdout } = await execAsync('df -BK --output=target,source,fstype,size,used,avail', {
            encoding: 'utf-8',
        });
        const lines = stdout.trim().split('\n').slice(1); // Pula header
        for (const line of lines) {
            const parts = line.trim().split(/\s+/);
            if (parts.length >= 6) {
                const mount = parts[0];
                const device = parts[1];
                const fsType = parts[2];
                // Ignora sistemas de arquivos virtuais
                if (device.startsWith('tmpfs') ||
                    device.startsWith('devtmpfs') ||
                    device === 'none' ||
                    mount.startsWith('/sys') ||
                    mount.startsWith('/proc') ||
                    mount.startsWith('/run')) {
                    continue;
                }
                // Valores em KB (df -BK), converte para bytes
                const totalBytes = parseSize(parts[3]);
                const usedBytes = parseSize(parts[4]);
                const freeBytes = parseSize(parts[5]);
                if (totalBytes === 0)
                    continue;
                const usagePercent = Math.round((usedBytes / totalBytes) * 100 * 100) / 100;
                partitions.push({
                    mount,
                    device,
                    fsType,
                    totalBytes,
                    usedBytes,
                    freeBytes,
                    usagePercent,
                });
            }
        }
    }
    catch (error) {
        logger.debug('Error getting Linux disk info', { error });
    }
    return partitions;
}
/**
 * Obtém informações de disco no Windows
 */
async function getWindowsDiskInfo() {
    const partitions = [];
    try {
        const { stdout } = await execAsync('wmic logicaldisk where DriveType=3 get DeviceID,Size,FreeSpace,FileSystem /format:csv', { encoding: 'utf-8' });
        const lines = stdout.trim().split('\n').filter(l => l.includes(','));
        for (const line of lines.slice(1)) {
            const parts = line.split(',');
            if (parts.length >= 5) {
                const device = parts[1]; // DeviceID (C:, D:, etc.)
                const fsType = parts[2]; // FileSystem
                const freeBytes = parseInt(parts[3], 10) || 0;
                const totalBytes = parseInt(parts[4], 10) || 0;
                if (totalBytes === 0)
                    continue;
                const usedBytes = totalBytes - freeBytes;
                const usagePercent = Math.round((usedBytes / totalBytes) * 100 * 100) / 100;
                partitions.push({
                    mount: device,
                    device: device,
                    fsType,
                    totalBytes,
                    usedBytes,
                    freeBytes,
                    usagePercent,
                });
            }
        }
    }
    catch (error) {
        logger.debug('Error getting Windows disk info', { error });
    }
    return partitions;
}
/**
 * Parse de tamanho (ex: "100K", "1G", "500M")
 */
function parseSize(sizeStr) {
    const match = sizeStr.match(/^(\d+)([KMGT])?$/i);
    if (!match) {
        return parseInt(sizeStr, 10) || 0;
    }
    const value = parseInt(match[1], 10);
    const unit = (match[2] || '').toUpperCase();
    const multipliers = {
        K: 1024,
        M: 1024 * 1024,
        G: 1024 * 1024 * 1024,
        T: 1024 * 1024 * 1024 * 1024,
    };
    return value * (multipliers[unit] || 1);
}
/**
 * Obtém uso de disco de um diretório específico
 */
async function getDirectoryUsage(dirPath) {
    if (!(0, node_fs_1.existsSync)(dirPath)) {
        return null;
    }
    try {
        if (process.platform === 'win32') {
            const { stdout } = await execAsync(`powershell -command "(Get-ChildItem '${dirPath}' -Recurse | Measure-Object -Property Length -Sum).Sum"`, { encoding: 'utf-8' });
            const sizeBytes = parseInt(stdout.trim(), 10) || 0;
            return {
                path: dirPath,
                sizeBytes,
                fileCount: 0, // Não obtemos neste comando
            };
        }
        else {
            const { stdout } = await execAsync(`du -sb "${dirPath}"`, { encoding: 'utf-8' });
            const parts = stdout.trim().split('\t');
            const sizeBytes = parseInt(parts[0], 10) || 0;
            return {
                path: dirPath,
                sizeBytes,
                fileCount: 0,
            };
        }
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=disk.js.map