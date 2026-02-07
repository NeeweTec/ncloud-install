"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.systemInfo = exports.defaultConfig = void 0;
exports.getConfigDir = getConfigDir;
exports.getLogDir = getLogDir;
exports.getDefaultScanPaths = getDefaultScanPaths;
const node_os_1 = __importDefault(require("node:os"));
const node_path_1 = __importDefault(require("node:path"));
/**
 * Determina o diretório de configuração baseado no SO
 */
function getConfigDir() {
    if (process.platform === 'win32') {
        return node_path_1.default.join(process.env.APPDATA || '', 'ncloud-agent');
    }
    return '/etc/ncloud-agent';
}
/**
 * Determina o diretório de logs baseado no SO
 */
function getLogDir() {
    if (process.platform === 'win32') {
        return node_path_1.default.join(process.env.APPDATA || '', 'ncloud-agent', 'logs');
    }
    return '/var/log/ncloud-agent';
}
/**
 * Caminhos padrão para scan do Protheus baseado no SO
 */
function getDefaultScanPaths() {
    if (process.platform === 'win32') {
        return [
            'C:\\TOTVS',
            'D:\\TOTVS',
            'E:\\TOTVS',
            'C:\\totvs',
            'D:\\totvs',
        ];
    }
    return [
        '/totvs',
        '/opt/totvs',
        '/home/totvs',
        '/u/totvs',
    ];
}
/**
 * Configuração padrão do agente
 */
exports.defaultConfig = {
    server: {
        port: 3100,
        host: '0.0.0.0',
        cors: {
            enabled: true,
            origins: ['*'],
        },
    },
    protheus: {
        scanPaths: getDefaultScanPaths(),
        iniPatterns: ['appserver.ini', 'dbaccess.ini'],
    },
    services: {
        license: {
            name: 'License Server',
            defaultPort: 5555,
            binaryName: 'appsrvlinux',
            binaryNameWindows: 'appserver.exe',
        },
        dbaccess: {
            name: 'DbAccess',
            defaultPort: 7890,
            binaryName: 'dbaccess64',
            binaryNameWindows: 'dbaccess64.exe',
        },
        appserver: {
            name: 'AppServer',
            defaultPort: 1234,
            binaryName: 'appsrvlinux',
            binaryNameWindows: 'appserver.exe',
        },
    },
    logging: {
        level: 'info',
        file: node_path_1.default.join(getLogDir(), 'agent.log'),
        maxSize: '10m',
        maxFiles: 5,
    },
    metrics: {
        enabled: true,
        interval: 30000,
    },
};
/**
 * Informações do sistema
 */
exports.systemInfo = {
    hostname: node_os_1.default.hostname(),
    platform: process.platform,
    arch: process.arch,
    osType: node_os_1.default.type(),
    osRelease: node_os_1.default.release(),
    cpus: node_os_1.default.cpus().length,
    totalMemory: node_os_1.default.totalmem(),
    nodeVersion: process.version,
};
//# sourceMappingURL=defaults.js.map