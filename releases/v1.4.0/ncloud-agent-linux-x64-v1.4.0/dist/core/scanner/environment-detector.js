"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.scanEnvironments = scanEnvironments;
exports.getEnvironmentById = getEnvironmentById;
exports.getEnvironmentByName = getEnvironmentByName;
exports.getEnvironment = getEnvironment;
exports.invalidateCache = invalidateCache;
const promises_1 = __importDefault(require("node:fs/promises"));
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
const ini_parser_js_1 = require("./ini-parser.js");
const logger_js_1 = require("../utils/logger.js");
const paths_js_1 = require("../utils/paths.js");
const crypto_js_1 = require("../utils/crypto.js");
const index_js_1 = require("../config/index.js");
const logger = (0, logger_js_1.getLogger)();
// Cache de ambientes
let environmentCache = [];
let lastScanTime = 0;
const CACHE_TTL = 60000; // 1 minuto
/**
 * Escaneia os diretórios configurados em busca de ambientes Protheus
 */
async function scanEnvironments(forceRefresh = false) {
    const now = Date.now();
    // Retorna cache se ainda válido
    if (!forceRefresh && environmentCache.length > 0 && (now - lastScanTime) < CACHE_TTL) {
        logger.debug('Returning cached environments');
        return environmentCache;
    }
    const config = (0, index_js_1.getConfig)();
    const environments = [];
    logger.info('Starting environment scan', { paths: config.protheus.scanPaths });
    for (const scanPath of config.protheus.scanPaths) {
        if (!(0, node_fs_1.existsSync)(scanPath)) {
            logger.debug('Scan path does not exist', { scanPath });
            continue;
        }
        // Busca arquivos INI
        const iniPattern = new RegExp(`(${config.protheus.iniPatterns.join('|')})$`, 'i');
        const iniFiles = (0, paths_js_1.findFiles)(scanPath, iniPattern, 8);
        logger.debug('Found INI files', { count: iniFiles.length, scanPath });
        for (const iniPath of iniFiles) {
            try {
                const parsed = await (0, ini_parser_js_1.parseIniFile)(iniPath);
                if (!parsed)
                    continue;
                const binaryType = (0, ini_parser_js_1.detectBinaryType)(parsed);
                // Apenas processa AppServers para ambientes
                if (binaryType !== 'appserver') {
                    logger.debug('Skipping non-appserver INI', { iniPath, type: binaryType });
                    continue;
                }
                const envConfigs = (0, ini_parser_js_1.extractEnvironments)(parsed);
                for (const envConfig of envConfigs) {
                    const env = await buildEnvironment(iniPath, envConfig, parsed.raw);
                    if (env) {
                        environments.push(env);
                    }
                }
            }
            catch (error) {
                logger.error('Error processing INI file', { iniPath, error });
            }
        }
    }
    logger.info('Environment scan complete', { count: environments.length });
    // Atualiza cache
    environmentCache = environments;
    lastScanTime = now;
    return environments;
}
/**
 * Constrói objeto de ambiente a partir da configuração
 */
async function buildEnvironment(iniPath, envConfig, fullConfig) {
    const binaryPath = (0, ini_parser_js_1.getBinaryPath)(iniPath, process.platform);
    // Gera ID único baseado no caminho do INI e nome da seção
    const id = (0, crypto_js_1.generateEnvironmentId)(iniPath, envConfig.name);
    const env = {
        id,
        name: envConfig.name,
        displayName: formatDisplayName(envConfig.name),
        iniPath,
        iniSection: envConfig.name,
        sourcePath: envConfig.sourcePath,
        rootPath: envConfig.rootPath,
        startProgram: envConfig.startProgram,
        tcpPort: envConfig.tcpPort,
        httpPort: envConfig.httpPort,
        httpEnabled: envConfig.httpEnabled || false,
        database: envConfig.database,
        license: envConfig.license,
        binaryPath: binaryPath || undefined,
        status: 'unknown',
        fullConfig,
    };
    // Busca informações do RPO
    if (envConfig.sourcePath && (0, node_fs_1.existsSync)(envConfig.sourcePath)) {
        const rpoInfo = await detectRpo(envConfig.sourcePath);
        if (rpoInfo) {
            env.rpoInfo = rpoInfo;
        }
    }
    // Determina status baseado na porta
    if (env.tcpPort) {
        env.status = await checkPortInUse(env.tcpPort) ? 'active' : 'inactive';
    }
    return env;
}
/**
 * Detecta informações do RPO
 */
async function detectRpo(sourcePath) {
    try {
        const rpoPattern = /\.rpo$/i;
        const rpoFiles = (0, paths_js_1.findFiles)(sourcePath, rpoPattern, 2);
        if (rpoFiles.length === 0) {
            // Tenta diretamente no sourcePath
            const files = await promises_1.default.readdir(sourcePath);
            const rpoFile = files.find(f => f.toLowerCase().endsWith('.rpo'));
            if (rpoFile) {
                rpoFiles.push(node_path_1.default.join(sourcePath, rpoFile));
            }
        }
        if (rpoFiles.length === 0)
            return null;
        // Pega o RPO mais recente
        let latestRpo = rpoFiles[0];
        let latestMtime = 0;
        for (const rpo of rpoFiles) {
            const info = (0, paths_js_1.getFileInfo)(rpo);
            if (info && info.modifiedAt.getTime() > latestMtime) {
                latestMtime = info.modifiedAt.getTime();
                latestRpo = rpo;
            }
        }
        const info = (0, paths_js_1.getFileInfo)(latestRpo);
        if (!info)
            return null;
        // Extrai versão e linguagem do nome do arquivo
        const fileName = node_path_1.default.basename(latestRpo).toLowerCase();
        const versionMatch = fileName.match(/ttt[pca]?(\d+)/);
        const version = versionMatch ? versionMatch[1] : 'unknown';
        let language = 'portuguese';
        if (fileName.includes('eng') || fileName.includes('_en')) {
            language = 'english';
        }
        else if (fileName.includes('esp') || fileName.includes('_es')) {
            language = 'spanish';
        }
        return {
            path: latestRpo,
            version,
            language,
            sizeBytes: info.size,
            modifiedAt: info.modifiedAt.toISOString(),
        };
    }
    catch (error) {
        logger.error('Error detecting RPO', { sourcePath, error });
        return null;
    }
}
/**
 * Verifica se uma porta está em uso
 */
async function checkPortInUse(port) {
    const net = await import('node:net');
    return new Promise(resolve => {
        const server = net.createServer();
        server.once('error', () => {
            resolve(true); // Porta em uso
        });
        server.once('listening', () => {
            server.close();
            resolve(false); // Porta disponível
        });
        server.listen(port, '127.0.0.1');
    });
}
/**
 * Formata nome de exibição do ambiente
 */
function formatDisplayName(name) {
    // P12_PRODUCAO -> Produção P12
    // HOMOLOGACAO -> Homologação
    // DEV_01 -> Dev 01
    const patterns = [
        [/producao/i, 'Produção'],
        [/production/i, 'Production'],
        [/homolog/i, 'Homologação'],
        [/staging/i, 'Staging'],
        [/dev/i, 'Desenvolvimento'],
        [/test/i, 'Teste'],
    ];
    let displayName = name;
    for (const [pattern, label] of patterns) {
        if (pattern.test(name)) {
            // Extrai versão/número se houver
            const versionMatch = name.match(/[Pp]?(\d+)/);
            const version = versionMatch ? versionMatch[1] : '';
            displayName = version ? `${label} P${version}` : label;
            break;
        }
    }
    return displayName;
}
/**
 * Obtém um ambiente pelo ID
 */
async function getEnvironmentById(id) {
    const environments = await scanEnvironments();
    return environments.find(e => e.id === id) || null;
}
/**
 * Obtém um ambiente pelo nome
 */
async function getEnvironmentByName(name) {
    const environments = await scanEnvironments();
    return environments.find(e => e.name.toLowerCase() === name.toLowerCase()) || null;
}
/**
 * Obtém um ambiente por ID ou nome (busca flexível)
 */
async function getEnvironment(idOrName) {
    const environments = await scanEnvironments();
    // 1. Busca por ID exato
    const byId = environments.find(e => e.id === idOrName);
    if (byId)
        return byId;
    // 2. Busca por nome (case insensitive)
    const byName = environments.find(e => e.name.toLowerCase() === idOrName.toLowerCase());
    if (byName)
        return byName;
    return null;
}
/**
 * Invalida o cache de ambientes
 */
function invalidateCache() {
    environmentCache = [];
    lastScanTime = 0;
}
//# sourceMappingURL=environment-detector.js.map