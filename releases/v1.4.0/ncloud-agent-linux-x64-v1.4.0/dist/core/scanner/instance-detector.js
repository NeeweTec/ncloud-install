"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectInstances = detectInstances;
exports.getInstanceById = getInstanceById;
exports.getInstanceByName = getInstanceByName;
exports.invalidateInstanceCache = invalidateInstanceCache;
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
const ini_parser_js_1 = require("./ini-parser.js");
const logger_js_1 = require("../utils/logger.js");
const paths_js_1 = require("../utils/paths.js");
const index_js_1 = require("../config/index.js");
const crypto_js_1 = require("../utils/crypto.js");
const logger = (0, logger_js_1.getLogger)();
// Cache de instâncias
let instanceCache = [];
let lastScanTime = 0;
const CACHE_TTL = 60000; // 1 minuto
/**
 * Detecta todas as instâncias Protheus nos caminhos configurados
 *
 * Lógica de agrupamento:
 * 1. Escaneia scanPaths em busca de arquivos INI
 * 2. Agrupa INIs por diretório base (cada diretório com binários = 1 instância)
 * 3. Para cada instância, detecta serviços (binários) e ambientes (seções INI)
 */
async function detectInstances(forceRefresh = false) {
    const now = Date.now();
    // Retorna cache se ainda válido
    if (!forceRefresh && instanceCache.length > 0 && (now - lastScanTime) < CACHE_TTL) {
        logger.debug('Returning cached instances');
        return instanceCache;
    }
    const config = (0, index_js_1.getConfig)();
    const instances = [];
    // Map para agrupar INIs por diretório base
    const instanceDirs = new Map();
    logger.info('Starting instance detection', { paths: config.protheus.scanPaths });
    for (const scanPath of config.protheus.scanPaths) {
        if (!(0, node_fs_1.existsSync)(scanPath)) {
            logger.debug('Scan path does not exist', { scanPath });
            continue;
        }
        // Busca arquivos INI
        const iniPattern = new RegExp(`(${config.protheus.iniPatterns.join('|')})$`, 'i');
        const iniFiles = (0, paths_js_1.findFiles)(scanPath, iniPattern, 8);
        for (const iniPath of iniFiles) {
            const dir = node_path_1.default.dirname(iniPath);
            // Agrupa por diretório
            if (!instanceDirs.has(dir)) {
                instanceDirs.set(dir, []);
            }
            instanceDirs.get(dir).push(iniPath);
        }
    }
    // Para cada diretório com INIs, cria uma instância
    for (const [dir, iniFiles] of instanceDirs) {
        try {
            const instance = await buildInstance(dir, iniFiles);
            if (instance) {
                instances.push(instance);
            }
        }
        catch (error) {
            logger.error('Error building instance', { dir, error });
        }
    }
    logger.info('Instance detection complete', { count: instances.length });
    // Atualiza cache
    instanceCache = instances;
    lastScanTime = now;
    return instances;
}
/**
 * Constrói um objeto de instância a partir de um diretório
 */
async function buildInstance(basePath, iniFiles) {
    // Verifica se há binários Protheus no diretório
    const hasBinary = (0, ini_parser_js_1.getBinaryPath)(iniFiles[0], process.platform);
    if (!hasBinary) {
        logger.debug('No binary found for instance directory', { basePath });
        return null;
    }
    const dirName = node_path_1.default.basename(basePath);
    const id = (0, crypto_js_1.generateInstanceId)(basePath, dirName);
    const type = inferInstanceType(basePath);
    const instance = {
        id,
        name: dirName,
        displayName: formatInstanceDisplayName(dirName, type),
        basePath,
        type,
        status: 'unknown',
        services: [],
        environments: [],
    };
    // Detecta serviços e ambientes por cada arquivo INI
    for (const iniPath of iniFiles) {
        try {
            const parsed = await (0, ini_parser_js_1.parseIniFile)(iniPath);
            if (!parsed)
                continue;
            const binaryType = (0, ini_parser_js_1.detectBinaryType)(parsed);
            const binaryPath = (0, ini_parser_js_1.getBinaryPath)(iniPath, process.platform);
            // Cria um serviço para cada INI/binário detectado
            const serviceType = mapBinaryTypeToServiceType(binaryType);
            const service = {
                id: `${id}_${serviceType}_${node_path_1.default.basename(iniPath, '.ini')}`.toLowerCase(),
                type: serviceType,
                name: `${serviceType} (${node_path_1.default.basename(iniPath)})`,
                status: 'stopped',
                binaryPath: binaryPath || '',
                configPath: iniPath,
                instanceId: id,
                workingDirectory: basePath,
            };
            instance.services.push(service);
            // Para AppServers, extrai ambientes (seções do INI)
            if (binaryType === 'appserver') {
                const envConfigs = (0, ini_parser_js_1.extractEnvironments)(parsed);
                for (const envConfig of envConfigs) {
                    const env = {
                        id: `${service.id}_${envConfig.name}`.toLowerCase().replace(/\s+/g, '_'),
                        name: envConfig.name,
                        displayName: formatEnvironmentDisplayName(envConfig.name),
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
                        serviceId: service.id,
                    };
                    instance.environments.push(env);
                }
            }
        }
        catch (error) {
            logger.error('Error processing INI for instance', { iniPath, basePath, error });
        }
    }
    // Determina status: se qualquer serviço está rodando, a instância está ativa
    if (instance.services.some(s => s.status === 'running')) {
        instance.status = 'active';
    }
    else if (instance.services.length > 0) {
        instance.status = 'inactive';
    }
    return instance;
}
/**
 * Infere o tipo de instância pelo nome/caminho do diretório
 */
function inferInstanceType(basePath) {
    const lower = basePath.toLowerCase();
    if (/prod(u[cç][aã]o)?/i.test(lower) || /production/i.test(lower)) {
        return 'PRODUCTION';
    }
    if (/homolog/i.test(lower) || /qa/i.test(lower) || /qualidade/i.test(lower)) {
        return 'QA';
    }
    if (/test/i.test(lower) || /tst/i.test(lower)) {
        return 'TESTING';
    }
    if (/dev/i.test(lower) || /desenvolvimento/i.test(lower)) {
        return 'DEVELOPMENT';
    }
    // Default: produção (mais comum)
    return 'PRODUCTION';
}
/**
 * Formata nome de exibição da instância
 */
function formatInstanceDisplayName(dirName, type) {
    const typeLabels = {
        PRODUCTION: 'Produção',
        DEVELOPMENT: 'Desenvolvimento',
        TESTING: 'Testes',
        QA: 'QA / Homologação',
    };
    // Remove prefixos/sufixos comuns 
    const cleanName = dirName
        .replace(/^(totvs|protheus)[_-]?/i, '')
        .replace(/[_-]/g, ' ')
        .trim();
    if (cleanName) {
        return `${cleanName} (${typeLabels[type]})`;
    }
    return typeLabels[type];
}
/**
 * Formata nome de exibição do ambiente
 */
function formatEnvironmentDisplayName(name) {
    const patterns = [
        [/producao/i, 'Produção'],
        [/production/i, 'Production'],
        [/homolog/i, 'Homologação'],
        [/staging/i, 'Staging'],
        [/dev/i, 'Desenvolvimento'],
        [/test/i, 'Teste'],
    ];
    for (const [pattern, label] of patterns) {
        if (pattern.test(name)) {
            const versionMatch = name.match(/[Pp]?(\d+)/);
            const version = versionMatch ? versionMatch[1] : '';
            return version ? `${label} P${version}` : label;
        }
    }
    return name;
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
 * Obtém uma instância pelo ID
 */
async function getInstanceById(id) {
    const instances = await detectInstances();
    return instances.find(i => i.id === id) || null;
}
/**
 * Obtém uma instância pelo nome (case insensitive)
 */
async function getInstanceByName(name) {
    const instances = await detectInstances();
    return instances.find(i => i.name.toLowerCase() === name.toLowerCase()) || null;
}
/**
 * Invalida o cache de instâncias
 */
function invalidateInstanceCache() {
    instanceCache = [];
    lastScanTime = 0;
}
//# sourceMappingURL=instance-detector.js.map