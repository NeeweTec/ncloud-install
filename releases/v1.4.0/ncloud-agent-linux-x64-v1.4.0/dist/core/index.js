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
exports.checkPort = exports.readServiceLogs = exports.restartServiceProcess = exports.stopServiceProcess = exports.startServiceProcess = exports.getServiceLogs = exports.restartService = exports.stopService = exports.startService = exports.getServices = void 0;
exports.startAgent = startAgent;
exports.stopAgent = stopAgent;
exports.isAgentRunning = isAgentRunning;
exports.getAgentVersion = getAgentVersion;
const index_js_1 = require("./config/index.js");
const logger_js_1 = require("./utils/logger.js");
const server_js_1 = require("./api/server.js");
const index_js_2 = require("./metrics/index.js");
const index_js_3 = require("./scanner/index.js");
__exportStar(require("./config/index.js"), exports);
__exportStar(require("./utils/index.js"), exports);
__exportStar(require("./api/index.js"), exports);
__exportStar(require("./scanner/index.js"), exports);
// Avoid duplicate export of getServiceById - use specific exports from services
var index_js_4 = require("./services/index.js");
Object.defineProperty(exports, "getServices", { enumerable: true, get: function () { return index_js_4.getServices; } });
Object.defineProperty(exports, "startService", { enumerable: true, get: function () { return index_js_4.startService; } });
Object.defineProperty(exports, "stopService", { enumerable: true, get: function () { return index_js_4.stopService; } });
Object.defineProperty(exports, "restartService", { enumerable: true, get: function () { return index_js_4.restartService; } });
Object.defineProperty(exports, "getServiceLogs", { enumerable: true, get: function () { return index_js_4.getServiceLogs; } });
Object.defineProperty(exports, "startServiceProcess", { enumerable: true, get: function () { return index_js_4.startServiceProcess; } });
Object.defineProperty(exports, "stopServiceProcess", { enumerable: true, get: function () { return index_js_4.stopServiceProcess; } });
Object.defineProperty(exports, "restartServiceProcess", { enumerable: true, get: function () { return index_js_4.restartServiceProcess; } });
Object.defineProperty(exports, "readServiceLogs", { enumerable: true, get: function () { return index_js_4.readServiceLogs; } });
Object.defineProperty(exports, "checkPort", { enumerable: true, get: function () { return index_js_4.checkPort; } });
__exportStar(require("./metrics/index.js"), exports);
const VERSION = '1.0.0';
/**
 * Estado do agente
 */
let isRunning = false;
let shutdownHandler = null;
/**
 * Inicializa e inicia o agente
 */
async function startAgent(options = {}) {
    if (isRunning) {
        throw new Error('Agent is already running');
    }
    console.log(`
  ╔═══════════════════════════════════════════╗
  ║                                           ║
  ║       ☁️  NCLOUD AGENT v${VERSION}          ║
  ║                                           ║
  ║   TOTVS Protheus Integration Agent        ║
  ║                                           ║
  ╚═══════════════════════════════════════════╝
  `);
    // Carrega configuração
    const config = (0, index_js_1.loadConfig)(options.configPath);
    // Inicializa logger
    const logger = (0, logger_js_1.initLogger)({
        level: options.logLevel || config.logging.level,
        logFile: options.logFile || config.logging.file,
    });
    logger.info('Starting Ncloud Agent', { version: VERSION });
    logger.debug('Configuration loaded', {
        port: config.server.port,
        scanPaths: config.protheus.scanPaths,
    });
    // Registra handlers de shutdown
    registerShutdownHandlers();
    // Scan inicial de ambientes
    logger.info('Performing initial environment scan...');
    const environments = await (0, index_js_3.scanEnvironments)();
    logger.info(`Found ${environments.length} environment(s)`);
    // Inicia coleta de métricas
    if (config.metrics.enabled) {
        (0, index_js_2.startMetricsCollection)(config.metrics.interval);
    }
    // Inicia servidor HTTP
    await (0, server_js_1.startServer)();
    isRunning = true;
    logger.info('Ncloud Agent started successfully');
}
/**
 * Para o agente
 */
async function stopAgent() {
    const logger = (0, logger_js_1.getLogger)();
    if (!isRunning) {
        logger.warn('Agent is not running');
        return;
    }
    logger.info('Stopping Ncloud Agent...');
    // Para coleta de métricas
    (0, index_js_2.stopMetricsCollection)();
    // Para servidor HTTP
    await (0, server_js_1.stopServer)();
    isRunning = false;
    logger.info('Ncloud Agent stopped');
}
/**
 * Verifica se o agente está rodando
 */
function isAgentRunning() {
    return isRunning;
}
/**
 * Obtém versão do agente
 */
function getAgentVersion() {
    return VERSION;
}
/**
 * Registra handlers de shutdown gracioso
 */
function registerShutdownHandlers() {
    const logger = (0, logger_js_1.getLogger)();
    shutdownHandler = async () => {
        logger.info('Received shutdown signal');
        await stopAgent();
        process.exit(0);
    };
    // SIGTERM (docker stop, kill)
    process.on('SIGTERM', () => {
        shutdownHandler?.();
    });
    // SIGINT (Ctrl+C)
    process.on('SIGINT', () => {
        shutdownHandler?.();
    });
    // Uncaught exceptions
    process.on('uncaughtException', (error) => {
        logger.error('Uncaught exception', { error: error.message, stack: error.stack });
        shutdownHandler?.();
    });
    // Unhandled promise rejections
    process.on('unhandledRejection', (reason) => {
        logger.error('Unhandled rejection', { reason });
    });
}
// Auto-start se executado diretamente
const isMainModule = process.argv[1]?.includes('core/index') ||
    process.argv[1]?.includes('core\\index');
if (isMainModule) {
    startAgent().catch((error) => {
        console.error('Failed to start agent:', error);
        process.exit(1);
    });
}
//# sourceMappingURL=index.js.map