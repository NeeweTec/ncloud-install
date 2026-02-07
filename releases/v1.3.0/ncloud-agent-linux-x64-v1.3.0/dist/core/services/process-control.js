"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startServiceProcess = startServiceProcess;
exports.stopServiceProcess = stopServiceProcess;
exports.restartServiceProcess = restartServiceProcess;
const node_child_process_1 = require("node:child_process");
const node_util_1 = require("node:util");
const node_path_1 = __importDefault(require("node:path"));
const logger_js_1 = require("../utils/logger.js");
const index_js_1 = require("../utils/index.js");
const service_detector_js_1 = require("../scanner/service-detector.js");
const execAsync = (0, node_util_1.promisify)(node_child_process_1.exec);
const logger = (0, logger_js_1.getLogger)();
/**
 * Inicia um serviço
 */
async function startServiceProcess(serviceId, options = {}) {
    const { timeout = 60, waitForPort = true } = options;
    const startTime = Date.now();
    logger.info('Starting service', { serviceId, timeout, waitForPort });
    const service = await (0, service_detector_js_1.getServiceById)(serviceId);
    if (!service) {
        return {
            success: false,
            service: serviceId,
            error: 'Serviço não encontrado',
        };
    }
    if (service.status === 'running') {
        return {
            success: false,
            service: serviceId,
            error: 'Serviço já está em execução',
            currentStatus: 'running',
        };
    }
    try {
        // Executa o binário
        const cwd = service.workingDirectory || node_path_1.default.dirname(service.binaryPath);
        const binaryName = node_path_1.default.basename(service.binaryPath);
        let command;
        let args;
        if (process.platform === 'win32') {
            command = service.binaryPath;
            args = ['-console'];
        }
        else {
            command = `./${binaryName}`;
            args = ['-console'];
        }
        logger.debug('Spawning process', { command, args, cwd });
        const child = (0, node_child_process_1.spawn)(command, args, {
            cwd,
            detached: true,
            stdio: 'ignore',
            shell: process.platform === 'win32',
        });
        child.unref();
        // Aguarda o processo iniciar
        await (0, index_js_1.sleep)(2000);
        // Verifica se iniciou
        if (waitForPort && service.port) {
            const portReady = await waitForPortReady(service.port, timeout * 1000);
            if (!portReady) {
                return {
                    success: false,
                    service: serviceId,
                    error: 'Timeout aguardando porta ficar disponível',
                    previousStatus: 'stopped',
                    currentStatus: 'unknown',
                };
            }
        }
        // Invalida cache para pegar novo status
        (0, service_detector_js_1.invalidateServiceCache)();
        const elapsed = Date.now() - startTime;
        logger.info('Service started', { serviceId, elapsed });
        return {
            success: true,
            service: serviceId,
            previousStatus: 'stopped',
            currentStatus: 'running',
            pid: child.pid,
            port: service.port,
            startupTime: elapsed,
        };
    }
    catch (error) {
        logger.error('Error starting service', { serviceId, error });
        return {
            success: false,
            service: serviceId,
            error: error.message,
            previousStatus: 'stopped',
        };
    }
}
/**
 * Para um serviço
 */
async function stopServiceProcess(serviceId, options = {}) {
    const { timeout = 30, force = false } = options;
    const startTime = Date.now();
    logger.info('Stopping service', { serviceId, timeout, force });
    const service = await (0, service_detector_js_1.getServiceById)(serviceId);
    if (!service) {
        return {
            success: false,
            service: serviceId,
            error: 'Serviço não encontrado',
        };
    }
    if (service.status !== 'running' || !service.pid) {
        return {
            success: false,
            service: serviceId,
            error: 'Serviço não está em execução',
            currentStatus: service.status,
        };
    }
    try {
        // Tenta parar graciosamente primeiro
        if (!force) {
            await killProcess(service.pid, 'SIGTERM');
            // Aguarda processo encerrar
            const stopped = await waitForProcessExit(service.pid, timeout * 1000);
            if (!stopped) {
                logger.warn('Graceful shutdown timeout, forcing', { serviceId });
                await killProcess(service.pid, 'SIGKILL');
            }
        }
        else {
            // Força encerramento
            await killProcess(service.pid, 'SIGKILL');
        }
        // Invalida cache
        (0, service_detector_js_1.invalidateServiceCache)();
        const elapsed = Date.now() - startTime;
        logger.info('Service stopped', { serviceId, elapsed });
        return {
            success: true,
            service: serviceId,
            previousStatus: 'running',
            currentStatus: 'stopped',
            shutdownTime: elapsed,
        };
    }
    catch (error) {
        logger.error('Error stopping service', { serviceId, error });
        return {
            success: false,
            service: serviceId,
            error: error.message,
            currentStatus: 'unknown',
        };
    }
}
/**
 * Reinicia um serviço
 */
async function restartServiceProcess(serviceId, options = {}) {
    const { timeout = 60, force = false } = options;
    const totalStart = Date.now();
    logger.info('Restarting service', { serviceId });
    // Para o serviço
    const stopResult = await stopServiceProcess(serviceId, { timeout: timeout / 2, force });
    if (!stopResult.success && stopResult.error !== 'Serviço não está em execução') {
        return {
            success: false,
            service: serviceId,
            error: `Falha ao parar: ${stopResult.error}`,
        };
    }
    const stopTime = stopResult.shutdownTime || 0;
    // Aguarda um pouco antes de reiniciar
    await (0, index_js_1.sleep)(1000);
    // Inicia o serviço
    const startResult = await startServiceProcess(serviceId, {
        timeout: timeout / 2,
        waitForPort: options.waitForPort ?? true,
    });
    if (!startResult.success) {
        return {
            success: false,
            service: serviceId,
            error: `Falha ao iniciar: ${startResult.error}`,
            stopTime,
        };
    }
    const totalTime = Date.now() - totalStart;
    logger.info('Service restarted', { serviceId, totalTime });
    return {
        success: true,
        service: serviceId,
        stopTime,
        startTime: startResult.startupTime,
        totalTime,
        pid: startResult.pid,
        port: startResult.port,
    };
}
/**
 * Mata um processo
 */
async function killProcess(pid, signal) {
    if (process.platform === 'win32') {
        const forceFlag = signal === 'SIGKILL' ? '/F' : '';
        await execAsync(`taskkill ${forceFlag} /PID ${pid}`).catch(() => { });
    }
    else {
        const sigNum = signal === 'SIGKILL' ? 9 : 15;
        await execAsync(`kill -${sigNum} ${pid}`).catch(() => { });
    }
}
/**
 * Aguarda porta ficar disponível
 */
async function waitForPortReady(port, timeout) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        const inUse = await checkPortInUse(port);
        if (inUse) {
            return true;
        }
        await (0, index_js_1.sleep)(500);
    }
    return false;
}
/**
 * Aguarda processo encerrar
 */
async function waitForProcessExit(pid, timeout) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        const running = await isProcessRunning(pid);
        if (!running) {
            return true;
        }
        await (0, index_js_1.sleep)(500);
    }
    return false;
}
/**
 * Verifica se processo está rodando
 */
async function isProcessRunning(pid) {
    try {
        if (process.platform === 'win32') {
            const { stdout } = await execAsync(`tasklist /FI "PID eq ${pid}" /NH`);
            return stdout.includes(String(pid));
        }
        else {
            await execAsync(`kill -0 ${pid}`);
            return true;
        }
    }
    catch {
        return false;
    }
}
/**
 * Verifica se porta está em uso
 */
async function checkPortInUse(port) {
    const net = await import('node:net');
    return new Promise(resolve => {
        const server = net.createServer();
        server.once('error', () => {
            resolve(true);
        });
        server.once('listening', () => {
            server.close();
            resolve(false);
        });
        server.listen(port, '127.0.0.1');
    });
}
//# sourceMappingURL=process-control.js.map