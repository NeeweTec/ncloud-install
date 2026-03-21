"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
exports.createLogger = createLogger;
exports.getLogger = getLogger;
exports.initLogger = initLogger;
const winston_1 = __importDefault(require("winston"));
const node_path_1 = __importDefault(require("node:path"));
const node_fs_1 = __importDefault(require("node:fs"));
const defaults_js_1 = require("../config/defaults.js");
const { combine, timestamp, printf, colorize, errors } = winston_1.default.format;
/**
 * Formato personalizado para logs
 */
const logFormat = printf(({ level, message, timestamp, stack, ...metadata }) => {
    let log = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(metadata).length > 0) {
        log += ` ${JSON.stringify(metadata)}`;
    }
    if (stack) {
        log += `\n${stack}`;
    }
    return log;
});
/**
 * Cria o diretório de logs se não existir
 */
function ensureLogDir() {
    const logDir = (0, defaults_js_1.getLogDir)();
    if (!node_fs_1.default.existsSync(logDir)) {
        node_fs_1.default.mkdirSync(logDir, { recursive: true });
    }
}
/**
 * Cria instância do logger
 */
function createLogger(options) {
    const level = options?.level || process.env.LOG_LEVEL || 'info';
    const transports = [
        // Console transport
        new winston_1.default.transports.Console({
            format: combine(colorize({ all: true }), timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), errors({ stack: true }), logFormat),
        }),
    ];
    // File transport (se configurado)
    if (options?.logFile || process.env.LOG_FILE) {
        ensureLogDir();
        const logFile = options?.logFile || process.env.LOG_FILE || node_path_1.default.join((0, defaults_js_1.getLogDir)(), 'agent.log');
        transports.push(new winston_1.default.transports.File({
            filename: logFile,
            format: combine(timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), errors({ stack: true }), logFormat),
            maxsize: 10 * 1024 * 1024, // 10MB
            maxFiles: 5,
            tailable: true,
        }));
        // Error log separado
        transports.push(new winston_1.default.transports.File({
            filename: logFile.replace('.log', '-error.log'),
            level: 'error',
            format: combine(timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), errors({ stack: true }), logFormat),
            maxsize: 10 * 1024 * 1024,
            maxFiles: 3,
        }));
    }
    return winston_1.default.createLogger({
        level,
        defaultMeta: { service: 'ncloud-agent' },
        transports,
    });
}
// Logger global singleton
let globalLogger = null;
/**
 * Obtém o logger global
 */
function getLogger() {
    if (!globalLogger) {
        globalLogger = createLogger();
    }
    return globalLogger;
}
/**
 * Inicializa o logger global com configurações
 */
function initLogger(options) {
    globalLogger = createLogger(options);
    return globalLogger;
}
// Exporta logger padrão
exports.logger = getLogger();
//# sourceMappingURL=logger.js.map