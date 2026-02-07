"use strict";
/**
 * Módulo de Configuração do Ncloud Agent
 *
 * Este módulo fornece uma API centralizada para gerenciamento de configuração
 * usando o ConfigStore para sincronização automática entre memória e disco.
 */
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
exports.getDefaultScanPaths = exports.getLogDir = exports.getConfigDir = exports.defaultConfig = exports.initStore = exports.getStore = exports.ConfigStore = exports.configStore = void 0;
exports.loadConfigFromFile = loadConfigFromFile;
exports.loadConfigFromEnv = loadConfigFromEnv;
exports.loadConfig = loadConfig;
exports.getConfig = getConfig;
exports.updateConfig = updateConfig;
exports.saveConfig = saveConfig;
exports.reloadConfig = reloadConfig;
exports.generateToken = generateToken;
exports.hashToken = hashToken;
exports.validateToken = validateToken;
const store_js_1 = require("./store.js");
Object.defineProperty(exports, "configStore", { enumerable: true, get: function () { return store_js_1.configStore; } });
Object.defineProperty(exports, "ConfigStore", { enumerable: true, get: function () { return store_js_1.ConfigStore; } });
Object.defineProperty(exports, "getStore", { enumerable: true, get: function () { return store_js_1.getStore; } });
Object.defineProperty(exports, "initStore", { enumerable: true, get: function () { return store_js_1.initStore; } });
const defaults_js_1 = require("./defaults.js");
/**
 * Carrega configuração de um arquivo JSON
 * @deprecated Use configStore.load() diretamente
 */
function loadConfigFromFile(filePath) {
    if (filePath) {
        const store = store_js_1.ConfigStore.getInstance({ configPath: filePath });
        return store.load();
    }
    return store_js_1.configStore.load();
}
/**
 * Carrega configuração de variáveis de ambiente
 */
function loadConfigFromEnv() {
    const envConfig = {};
    if (process.env.AGENT_PORT) {
        envConfig.server = {
            ...defaults_js_1.defaultConfig.server,
            port: parseInt(process.env.AGENT_PORT, 10),
        };
    }
    if (process.env.AGENT_HOST) {
        envConfig.server = {
            ...envConfig.server,
            ...defaults_js_1.defaultConfig.server,
            host: process.env.AGENT_HOST,
        };
    }
    if (process.env.AGENT_TOKEN) {
        envConfig.auth = {
            token: process.env.AGENT_TOKEN,
            tokenHash: store_js_1.configStore.hashToken(process.env.AGENT_TOKEN),
        };
    }
    if (process.env.PROTHEUS_SCAN_PATHS) {
        envConfig.protheus = {
            ...defaults_js_1.defaultConfig.protheus,
            scanPaths: process.env.PROTHEUS_SCAN_PATHS.split(',').map(p => p.trim()),
        };
    }
    if (process.env.LOG_LEVEL) {
        envConfig.logging = {
            ...defaults_js_1.defaultConfig.logging,
            level: process.env.LOG_LEVEL,
        };
    }
    if (process.env.METRICS_ENABLED !== undefined) {
        envConfig.metrics = {
            ...defaults_js_1.defaultConfig.metrics,
            enabled: process.env.METRICS_ENABLED === 'true',
        };
    }
    return envConfig;
}
/**
 * Carrega configuração combinando arquivo e variáveis de ambiente
 */
function loadConfig(filePath) {
    // Carrega do arquivo via store
    const store = filePath
        ? store_js_1.ConfigStore.getInstance({ configPath: filePath })
        : store_js_1.configStore;
    const fileConfig = store.load();
    const envConfig = loadConfigFromEnv();
    // Se há variáveis de ambiente, merge com a config
    if (Object.keys(envConfig).length > 0) {
        return store.set(envConfig);
    }
    return fileConfig;
}
/**
 * Retorna a configuração atual
 */
function getConfig() {
    return store_js_1.configStore.get();
}
/**
 * Atualiza a configuração (parcial)
 */
function updateConfig(updates) {
    return store_js_1.configStore.set(updates);
}
/**
 * Salva configuração em arquivo
 * @deprecated Use configStore.save() diretamente - o store salva automaticamente
 */
function saveConfig(config, filePath) {
    if (filePath) {
        // Se um caminho específico foi fornecido, usa getInstance com o caminho
        // Nota: Isso criará uma nova instância ou retornará a existente
        const tempStore = store_js_1.ConfigStore.getInstance({ configPath: filePath });
        tempStore.replace(config);
        tempStore.flush();
    }
    else {
        // Usa o store principal
        store_js_1.configStore.replace(config);
        store_js_1.configStore.flush(); // Força salvamento imediato
    }
}
/**
 * Recarrega a configuração do disco
 */
function reloadConfig() {
    return store_js_1.configStore.reload();
}
/**
 * Gera um token seguro
 */
function generateToken() {
    return store_js_1.configStore.generateToken();
}
/**
 * Gera hash SHA-256 do token
 */
function hashToken(token) {
    return store_js_1.configStore.hashToken(token);
}
/**
 * Valida um token contra o hash armazenado
 */
function validateToken(token, storedHash) {
    return store_js_1.configStore.validateToken(token, storedHash);
}
// Re-exports dos outros módulos
__exportStar(require("./schema.js"), exports);
var defaults_js_2 = require("./defaults.js");
Object.defineProperty(exports, "defaultConfig", { enumerable: true, get: function () { return defaults_js_2.defaultConfig; } });
Object.defineProperty(exports, "getConfigDir", { enumerable: true, get: function () { return defaults_js_2.getConfigDir; } });
Object.defineProperty(exports, "getLogDir", { enumerable: true, get: function () { return defaults_js_2.getLogDir; } });
Object.defineProperty(exports, "getDefaultScanPaths", { enumerable: true, get: function () { return defaults_js_2.getDefaultScanPaths; } });
//# sourceMappingURL=index.js.map