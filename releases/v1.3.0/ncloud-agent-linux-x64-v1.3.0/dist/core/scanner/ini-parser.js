"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseIniFile = parseIniFile;
exports.extractEnvironments = extractEnvironments;
exports.getIniValue = getIniValue;
exports.stringifyIni = stringifyIni;
exports.setIniValue = setIniValue;
exports.detectBinaryType = detectBinaryType;
exports.getBinaryPath = getBinaryPath;
const promises_1 = __importDefault(require("node:fs/promises"));
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
const ini_1 = __importDefault(require("ini"));
const logger_js_1 = require("../utils/logger.js");
const logger = (0, logger_js_1.getLogger)();
/**
 * Parse de arquivo INI
 */
async function parseIniFile(filePath) {
    if (!(0, node_fs_1.existsSync)(filePath)) {
        logger.warn('INI file not found', { filePath });
        return null;
    }
    try {
        const content = await promises_1.default.readFile(filePath, 'utf-8');
        const parsed = ini_1.default.parse(content);
        const sections = Object.entries(parsed).map(([name, keys]) => ({
            name,
            keys: keys,
        }));
        return {
            path: filePath,
            sections,
            raw: parsed,
        };
    }
    catch (error) {
        logger.error('Error parsing INI file', { filePath, error });
        return null;
    }
}
/**
 * Extrai configurações de ambiente de um INI parseado
 */
function extractEnvironments(parsed) {
    const environments = [];
    const generalSection = parsed.sections.find(s => s.name.toLowerCase() === 'general');
    // Encontra seções que parecem ser environments (têm SourcePath)
    for (const section of parsed.sections) {
        const keys = normalizeKeys(section.keys);
        // Se tem SourcePath ou Environment, é um ambiente
        if (keys.sourcepath || keys.environment) {
            const envName = keys.environment || section.name;
            const env = {
                name: envName,
                sourcePath: keys.sourcepath || '',
                rootPath: keys.rootpath || '',
                startProgram: keys.startprogram || 'SIGAMDI',
            };
            // Porta TCP
            if (keys.tcpport) {
                env.tcpPort = parseInt(keys.tcpport, 10);
            }
            // HTTP
            if (keys.httpport) {
                env.httpPort = parseInt(keys.httpport, 10);
                env.httpEnabled = true;
            }
            if (keys.http === '1' || keys.enablehttp === '1') {
                env.httpEnabled = true;
            }
            // RPC
            if (keys.rpcport) {
                env.rpcPort = parseInt(keys.rpcport, 10);
            }
            // SSL
            if (keys.sslport) {
                env.sslPort = parseInt(keys.sslport, 10);
            }
            // Database
            if (keys.dbdatabase || keys.dbalias || keys.dbserver) {
                env.database = {
                    type: keys.dbdatatype || keys.dbtype,
                    server: keys.dbserver,
                    port: keys.dbport ? parseInt(keys.dbport, 10) : undefined,
                    name: keys.dbdatabase || keys.dbalias,
                    dbAccessPort: keys.dbaccessport ? parseInt(keys.dbaccessport, 10) : 7890,
                };
            }
            // License
            if (keys.licenseserver) {
                const [licServer, licPort] = keys.licenseserver.split(':');
                env.license = {
                    server: licServer,
                    port: licPort ? parseInt(licPort, 10) : 5555,
                };
            }
            environments.push(env);
        }
    }
    return environments;
}
/**
 * Normaliza chaves para lowercase para facilitar busca
 */
function normalizeKeys(keys) {
    const normalized = {};
    for (const [key, value] of Object.entries(keys)) {
        normalized[key.toLowerCase().replace(/_/g, '')] = value;
    }
    return normalized;
}
/**
 * Obtém valor de uma seção/chave específica
 */
function getIniValue(parsed, section, key) {
    const sec = parsed.sections.find(s => s.name.toLowerCase() === section.toLowerCase());
    if (!sec)
        return undefined;
    const normalizedKey = key.toLowerCase();
    const foundKey = Object.keys(sec.keys).find(k => k.toLowerCase() === normalizedKey);
    return foundKey ? sec.keys[foundKey] : undefined;
}
/**
 * Converte ParsedIni de volta para string
 */
function stringifyIni(parsed) {
    return ini_1.default.stringify(parsed.raw);
}
/**
 * Atualiza valor em uma seção
 */
function setIniValue(parsed, section, key, value) {
    // Atualiza no raw
    if (!parsed.raw[section]) {
        parsed.raw[section] = {};
    }
    parsed.raw[section][key] = value;
    // Atualiza nas sections
    let sec = parsed.sections.find(s => s.name === section);
    if (!sec) {
        sec = { name: section, keys: {} };
        parsed.sections.push(sec);
    }
    sec.keys[key] = value;
}
/**
 * Detecta o tipo de binário Protheus pelo conteúdo do INI
 */
function detectBinaryType(parsed) {
    // Verifica se tem seções típicas de cada tipo
    const sectionNames = parsed.sections.map(s => s.name.toLowerCase());
    // DbAccess tem seções específicas
    if (sectionNames.some(s => s.includes('dbaccess') || s === 'drivers')) {
        return 'dbaccess';
    }
    // License server
    if (sectionNames.some(s => s.includes('license') || s === 'license server')) {
        return 'license';
    }
    // AppServer (mais comum)
    if (sectionNames.some(s => s === 'general' || s.includes('environment'))) {
        return 'appserver';
    }
    return 'unknown';
}
/**
 * Obtém caminho do binário a partir do INI
 */
function getBinaryPath(iniPath, platform) {
    const dir = node_path_1.default.dirname(iniPath);
    if (platform === 'win32') {
        // Tenta appserver.exe primeiro, depois outros
        const candidates = ['appserver.exe', 'dbaccess64.exe', 'dbaccess.exe'];
        for (const bin of candidates) {
            const binPath = node_path_1.default.join(dir, bin);
            if ((0, node_fs_1.existsSync)(binPath)) {
                return binPath;
            }
        }
    }
    else {
        // Linux
        const candidates = ['appsrvlinux', 'dbaccess64', 'dbaccess'];
        for (const bin of candidates) {
            const binPath = node_path_1.default.join(dir, bin);
            if ((0, node_fs_1.existsSync)(binPath)) {
                return binPath;
            }
        }
    }
    return '';
}
//# sourceMappingURL=ini-parser.js.map