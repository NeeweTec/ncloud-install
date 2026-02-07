"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isPortAvailable = isPortAvailable;
exports.checkPort = checkPort;
exports.checkPorts = checkPorts;
exports.findAvailablePort = findAvailablePort;
exports.waitForPortAvailable = waitForPortAvailable;
exports.waitForPortInUse = waitForPortInUse;
exports.getProcessUsingPort = getProcessUsingPort;
const node_net_1 = __importDefault(require("node:net"));
const logger_js_1 = require("../utils/logger.js");
const logger = (0, logger_js_1.getLogger)();
/**
 * Verifica se uma porta está disponível (não em uso)
 */
async function isPortAvailable(port, host = '127.0.0.1') {
    return new Promise(resolve => {
        const server = node_net_1.default.createServer();
        server.once('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                resolve(false);
            }
            else {
                resolve(true);
            }
        });
        server.once('listening', () => {
            server.close();
            resolve(true);
        });
        server.listen(port, host);
    });
}
/**
 * Verifica se uma porta está em uso e respondendo
 */
async function checkPort(port, host = '127.0.0.1', timeout = 5000) {
    const startTime = Date.now();
    return new Promise(resolve => {
        const socket = new node_net_1.default.Socket();
        const handleSuccess = () => {
            socket.destroy();
            resolve({
                port,
                host,
                available: false, // Porta em uso significa serviço ativo
                responseTime: Date.now() - startTime,
            });
        };
        const handleError = (err) => {
            socket.destroy();
            resolve({
                port,
                host,
                available: true, // Porta disponível significa serviço parado
                error: err.message,
            });
        };
        socket.setTimeout(timeout);
        socket.once('connect', handleSuccess);
        socket.once('timeout', () => handleError(new Error('Timeout')));
        socket.once('error', handleError);
        socket.connect(port, host);
    });
}
/**
 * Verifica múltiplas portas
 */
async function checkPorts(ports, timeout = 5000) {
    const results = await Promise.all(ports.map(({ port, host }) => checkPort(port, host, timeout)));
    return results;
}
/**
 * Encontra uma porta disponível em um range
 */
async function findAvailablePort(startPort, endPort = startPort + 100, host = '127.0.0.1') {
    for (let port = startPort; port <= endPort; port++) {
        const available = await isPortAvailable(port, host);
        if (available) {
            return port;
        }
    }
    return null;
}
/**
 * Aguarda uma porta ficar disponível (serviço parar)
 */
async function waitForPortAvailable(port, host = '127.0.0.1', timeout = 30000, checkInterval = 500) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
        const available = await isPortAvailable(port, host);
        if (available) {
            logger.debug('Port became available', { port, host });
            return true;
        }
        await new Promise(resolve => setTimeout(resolve, checkInterval));
    }
    logger.warn('Timeout waiting for port to become available', { port, host, timeout });
    return false;
}
/**
 * Aguarda uma porta ficar em uso (serviço iniciar)
 */
async function waitForPortInUse(port, host = '127.0.0.1', timeout = 60000, checkInterval = 500) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
        const result = await checkPort(port, host, 1000);
        if (!result.available) {
            logger.debug('Port is now in use', { port, host, responseTime: result.responseTime });
            return true;
        }
        await new Promise(resolve => setTimeout(resolve, checkInterval));
    }
    logger.warn('Timeout waiting for port to be in use', { port, host, timeout });
    return false;
}
/**
 * Obtém informações sobre qual processo está usando uma porta
 */
async function getProcessUsingPort(port) {
    const { exec } = await import('node:child_process');
    const { promisify } = await import('node:util');
    const execAsync = promisify(exec);
    try {
        if (process.platform === 'win32') {
            const { stdout } = await execAsync(`netstat -ano | findstr :${port}`);
            const lines = stdout.trim().split('\n');
            for (const line of lines) {
                const parts = line.trim().split(/\s+/);
                if (parts.length >= 5 && parts[1].includes(`:${port}`)) {
                    const pid = parseInt(parts[4], 10);
                    // Obtém nome do processo
                    const { stdout: taskOutput } = await execAsync(`tasklist /FI "PID eq ${pid}" /FO CSV /NH`);
                    const taskParts = taskOutput.trim().split(',');
                    const processName = taskParts[0]?.replace(/"/g, '');
                    return { pid, processName };
                }
            }
        }
        else {
            const { stdout } = await execAsync(`lsof -i :${port} -t`);
            const pid = parseInt(stdout.trim(), 10);
            if (pid) {
                const { stdout: psOutput } = await execAsync(`ps -p ${pid} -o comm=`);
                const processName = psOutput.trim();
                return { pid, processName };
            }
        }
    }
    catch {
        // Porta não em uso ou erro
    }
    return null;
}
//# sourceMappingURL=port-checker.js.map