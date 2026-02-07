"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectServices = detectServices;
exports.getServiceById = getServiceById;
exports.invalidateServiceCache = invalidateServiceCache;
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
const node_child_process_1 = require("node:child_process");
const node_util_1 = require("node:util");
const ini_parser_js_1 = require("./ini-parser.js");
const logger_js_1 = require("../utils/logger.js");
const paths_js_1 = require("../utils/paths.js");
const index_js_1 = require("../config/index.js");
const crypto_js_1 = require("../utils/crypto.js");
const execAsync = (0, node_util_1.promisify)(node_child_process_1.exec);
const logger = (0, logger_js_1.getLogger)();
// Cache de serviços
let serviceCache = [];
let lastScanTime = 0;
const CACHE_TTL = 30000; // 30 segundos
/**
 * Detecta todos os serviços Protheus
 */
async function detectServices(forceRefresh = false) {
    const now = Date.now();
    // Retorna cache se ainda válido
    if (!forceRefresh && serviceCache.length > 0 && (now - lastScanTime) < CACHE_TTL) {
        logger.debug('Returning cached services');
        return serviceCache;
    }
    const config = (0, index_js_1.getConfig)();
    const services = [];
    const processedPaths = new Set();
    logger.info('Starting service detection');
    // Lista de processos em execução
    const runningProcesses = await getRunningProtheusProcesses();
    for (const scanPath of config.protheus.scanPaths) {
        if (!(0, node_fs_1.existsSync)(scanPath))
            continue;
        // Busca arquivos INI
        const iniPattern = new RegExp(`(${config.protheus.iniPatterns.join('|')})$`, 'i');
        const iniFiles = (0, paths_js_1.findFiles)(scanPath, iniPattern, 8);
        for (const iniPath of iniFiles) {
            // Evita processar o mesmo diretório duas vezes
            const dir = node_path_1.default.dirname(iniPath);
            if (processedPaths.has(dir))
                continue;
            processedPaths.add(dir);
            try {
                const parsed = await (0, ini_parser_js_1.parseIniFile)(iniPath);
                if (!parsed)
                    continue;
                const binaryType = (0, ini_parser_js_1.detectBinaryType)(parsed);
                const binaryPath = (0, ini_parser_js_1.getBinaryPath)(iniPath, process.platform);
                if (!binaryPath)
                    continue;
                const serviceType = mapBinaryTypeToServiceType(binaryType);
                const service = await buildService(iniPath, binaryPath, serviceType, parsed, runningProcesses);
                if (service) {
                    services.push(service);
                }
            }
            catch (error) {
                logger.error('Error detecting service', { iniPath, error });
            }
        }
    }
    logger.info('Service detection complete', { count: services.length });
    // Atualiza cache
    serviceCache = services;
    lastScanTime = now;
    return services;
}
/**
 * Mapeia tipo de binário para tipo de serviço
 */
function mapBinaryTypeToServiceType(binaryType) {
    switch (binaryType) {
        case 'license':
            return 'LICENSE_SERVER';
        case 'dbaccess':
            return 'DBACCESS';
        default:
            return 'APPSERVER';
    }
}
/**
 * Constrói objeto de serviço
 */
async function buildService(iniPath, binaryPath, serviceType, parsed, runningProcesses) {
    if (!parsed)
        return null;
    // Detecta porta do serviço
    let port;
    let environment;
    let name = serviceType;
    for (const section of parsed.sections) {
        const keys = Object.fromEntries(Object.entries(section.keys).map(([k, v]) => [k.toLowerCase(), v]));
        if (keys.tcpport) {
            port = parseInt(keys.tcpport, 10);
            environment = keys.environment || section.name;
            name = `${serviceType} ${environment}`;
            break;
        }
        // DbAccess usa porta diferente
        if (keys.port && serviceType === 'DBACCESS') {
            port = parseInt(keys.port, 10);
            break;
        }
    }
    const id = generateServiceId(serviceType, binaryPath, iniPath, port);
    // Verifica se está em execução
    const binaryName = node_path_1.default.basename(binaryPath).toLowerCase();
    const processInfo = findProcessByBinary(runningProcesses, binaryName, port);
    const service = {
        id,
        type: serviceType,
        name,
        status: processInfo ? 'running' : 'stopped',
        port,
        pid: processInfo?.pid,
        environment,
        binaryPath,
        configPath: iniPath,
        workingDirectory: node_path_1.default.dirname(binaryPath),
    };
    // Adiciona métricas se estiver rodando
    if (processInfo) {
        service.uptimeSince = processInfo.startTime;
        service.commandLine = processInfo.commandLine;
        service.metrics = {
            cpuPercent: processInfo.cpu || 0,
            memoryBytes: processInfo.memory || 0,
            memoryPercent: processInfo.memoryPercent || 0,
        };
    }
    // Detecta log
    const logPath = findLogPath(iniPath, parsed);
    if (logPath) {
        service.logPath = logPath;
        try {
            const { statSync } = await import('node:fs');
            const stats = statSync(logPath);
            service.logSizeBytes = stats.size;
        }
        catch {
            // Ignora erro
        }
    }
    return service;
}
/**
 * Gera ID único do serviço usando hash consistente
 */
function generateServiceId(type, binaryPath, configPath, port) {
    return (0, crypto_js_1.generateServiceId)(binaryPath, configPath, port);
}
/**
 * Obtém processos Protheus em execução
 */
async function getRunningProtheusProcesses() {
    const processes = new Map();
    try {
        if (process.platform === 'win32') {
            // Windows
            const { stdout } = await execAsync('wmic process where "name like \'%appserver%\' or name like \'%dbaccess%\'" get processid,name,commandline /format:csv', { encoding: 'utf-8' });
            const lines = stdout.trim().split('\n').filter(l => l.includes(','));
            for (const line of lines.slice(1)) {
                const parts = line.split(',');
                if (parts.length >= 3) {
                    const pid = parseInt(parts[parts.length - 1], 10);
                    const name = parts[parts.length - 2];
                    const commandLine = parts.slice(1, -2).join(',');
                    processes.set(name.toLowerCase(), {
                        pid,
                        name,
                        commandLine,
                    });
                }
            }
        }
        else {
            // Linux
            const { stdout } = await execAsync('ps aux | grep -E "(appsrv|dbaccess)" | grep -v grep', { encoding: 'utf-8' }).catch(() => ({ stdout: '' }));
            const lines = stdout.trim().split('\n').filter(Boolean);
            for (const line of lines) {
                const parts = line.split(/\s+/);
                if (parts.length >= 11) {
                    const pid = parseInt(parts[1], 10);
                    const cpu = parseFloat(parts[2]);
                    const memPercent = parseFloat(parts[3]);
                    const name = node_path_1.default.basename(parts[10]);
                    const commandLine = parts.slice(10).join(' ');
                    processes.set(name.toLowerCase(), {
                        pid,
                        name,
                        cpu,
                        memoryPercent: memPercent,
                        commandLine,
                    });
                }
            }
        }
    }
    catch (error) {
        logger.error('Error getting running processes', { error });
    }
    return processes;
}
/**
 * Encontra processo pelo nome do binário
 */
function findProcessByBinary(processes, binaryName, port) {
    // Busca exata
    const exact = processes.get(binaryName);
    if (exact)
        return exact;
    // Busca parcial
    for (const [name, info] of processes) {
        if (name.includes(binaryName) || binaryName.includes(name)) {
            // Se tem porta, verifica na command line
            if (port && info.commandLine && !info.commandLine.includes(String(port))) {
                continue;
            }
            return info;
        }
    }
    return undefined;
}
/**
 * Encontra caminho do log
 */
function findLogPath(iniPath, parsed) {
    if (!parsed)
        return null;
    const dir = node_path_1.default.dirname(iniPath);
    // Procura configuração de log no INI
    for (const section of parsed.sections) {
        const keys = Object.fromEntries(Object.entries(section.keys).map(([k, v]) => [k.toLowerCase(), v]));
        if (keys.consolefile) {
            const logPath = node_path_1.default.isAbsolute(keys.consolefile)
                ? keys.consolefile
                : node_path_1.default.join(dir, keys.consolefile);
            if ((0, node_fs_1.existsSync)(logPath)) {
                return logPath;
            }
        }
    }
    // Tenta encontrar log padrão
    const defaultLogs = ['console.log', 'appserver.log', 'dbaccess.log'];
    for (const logName of defaultLogs) {
        const logPath = node_path_1.default.join(dir, logName);
        if ((0, node_fs_1.existsSync)(logPath)) {
            return logPath;
        }
    }
    return null;
}
/**
 * Obtém serviço por ID
 * Busca flexível: tenta ID exato, depois name, depois environment/porta
 */
async function getServiceById(id) {
    const services = await detectServices();
    const idLower = id.toLowerCase();
    // 1. Busca por ID exato
    const byId = services.find(s => s.id === id);
    if (byId)
        return byId;
    // 2. Busca por ID case insensitive
    const byIdLower = services.find(s => s.id.toLowerCase() === idLower);
    if (byIdLower)
        return byIdLower;
    // 3. Busca por environment que corresponde ao sufixo do ID
    // Ex: id = "appserver-rest" -> busca serviço com environment = "rest"
    const parts = idLower.split('-');
    if (parts.length >= 2) {
        const suffix = parts.slice(1).join('-'); // Pega tudo após o primeiro "-"
        const byEnv = services.find(s => s.environment?.toLowerCase() === suffix);
        if (byEnv)
            return byEnv;
        // 4. Busca por porta que corresponde ao sufixo
        const byPort = services.find(s => s.port?.toString() === suffix);
        if (byPort)
            return byPort;
    }
    return null;
}
/**
 * Invalida cache de serviços
 */
function invalidateServiceCache() {
    serviceCache = [];
    lastScanTime = 0;
}
//# sourceMappingURL=service-detector.js.map