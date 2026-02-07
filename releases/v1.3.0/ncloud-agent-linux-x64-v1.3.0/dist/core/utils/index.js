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
Object.defineProperty(exports, "__esModule", { value: true });
exports.sleep = sleep;
exports.retry = retry;
exports.formatBytes = formatBytes;
exports.formatDuration = formatDuration;
exports.isValidIP = isValidIP;
exports.isValidPort = isValidPort;
exports.debounce = debounce;
exports.throttle = throttle;
__exportStar(require("./logger.js"), exports);
__exportStar(require("./crypto.js"), exports);
__exportStar(require("./paths.js"), exports);
/**
 * Aguarda um tempo em milissegundos
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
/**
 * Retry com backoff exponencial
 */
async function retry(fn, options = {}) {
    const { maxRetries = 3, initialDelay = 1000, maxDelay = 30000, factor = 2 } = options;
    let lastError;
    let delay = initialDelay;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        }
        catch (error) {
            lastError = error;
            if (attempt < maxRetries) {
                await sleep(delay);
                delay = Math.min(delay * factor, maxDelay);
            }
        }
    }
    throw lastError;
}
/**
 * Formata bytes para string legível
 */
function formatBytes(bytes) {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let unitIndex = 0;
    let size = bytes;
    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
    }
    return `${size.toFixed(2)} ${units[unitIndex]}`;
}
/**
 * Formata duração em milissegundos para string legível
 */
function formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    if (days > 0) {
        return `${days}d ${hours % 24}h`;
    }
    if (hours > 0) {
        return `${hours}h ${minutes % 60}m`;
    }
    if (minutes > 0) {
        return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
}
/**
 * Valida se uma string é um endereço IP válido
 */
function isValidIP(ip) {
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
    if (ipv4Regex.test(ip)) {
        const parts = ip.split('.');
        return parts.every(part => {
            const num = parseInt(part, 10);
            return num >= 0 && num <= 255;
        });
    }
    return ipv6Regex.test(ip);
}
/**
 * Valida se uma porta é válida
 */
function isValidPort(port) {
    return Number.isInteger(port) && port >= 1 && port <= 65535;
}
/**
 * Debounce de função
 */
function debounce(fn, delay) {
    let timeoutId;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn(...args), delay);
    };
}
/**
 * Throttle de função
 */
function throttle(fn, limit) {
    let inThrottle = false;
    return (...args) => {
        if (!inThrottle) {
            fn(...args);
            inThrottle = true;
            setTimeout(() => (inThrottle = false), limit);
        }
    };
}
//# sourceMappingURL=index.js.map