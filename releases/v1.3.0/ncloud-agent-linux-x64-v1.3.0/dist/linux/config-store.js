"use strict";
/**
 * ConfigStore para o Daemon Linux
 *
 * Gerenciador de configuração com sincronização automática
 * entre memória e disco para resolver problemas de cache.
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
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_CONFIG = exports.CONFIG_FILE = exports.CONFIG_DIR = exports.DaemonConfigStore = exports.daemonConfigStore = void 0;
exports.generateId = generateId;
exports.generateShortId = generateShortId;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const crypto = __importStar(require("crypto"));
const events_1 = require("events");
// ============================================================================
// CONFIGURAÇÃO PADRÃO
// ============================================================================
const CONFIG_DIR = process.env.NCLOUD_CONFIG
    ? path.dirname(process.env.NCLOUD_CONFIG)
    : path.join(os.homedir(), '.ncloud-agent');
exports.CONFIG_DIR = CONFIG_DIR;
const CONFIG_FILE = process.env.NCLOUD_CONFIG || path.join(CONFIG_DIR, 'config.json');
exports.CONFIG_FILE = CONFIG_FILE;
const DEFAULT_CONFIG = {
    server: { port: 3100, host: '0.0.0.0' },
    auth: { token: 'NcloudAgent2026SecureToken32Ch' },
    environments: [],
    instances: [],
    webhooks: [],
    monitor: {
        enabled: true,
        pollIntervalMs: 5000,
        enableProcessMetrics: true,
    },
    scanPaths: ['/totvs', '/opt/totvs'],
    autoStart: true,
};
exports.DEFAULT_CONFIG = DEFAULT_CONFIG;
// ============================================================================
// FUNÇÕES UTILITÁRIAS
// ============================================================================
/**
 * Gera um ID único baseado em UUID v4
 */
function generateId() {
    return crypto.randomUUID();
}
/**
 * Gera um ID curto baseado no timestamp e random
 * Formato: env_xxxxxxxxxxxx (12 chars hex)
 */
function generateShortId(prefix = 'env') {
    const timestamp = Date.now().toString(16);
    const random = crypto.randomBytes(4).toString('hex');
    return `${prefix}_${timestamp}${random}`.substring(0, prefix.length + 13);
}
// ============================================================================
// DAEMON CONFIG STORE
// ============================================================================
class DaemonConfigStore extends events_1.EventEmitter {
    static instance = null;
    data;
    previousData = null;
    configPath;
    configDir;
    isDirty = false;
    saveTimeout = null;
    saveDebounce;
    constructor(configPath, saveDebounce = 100) {
        super();
        this.configPath = configPath || CONFIG_FILE;
        this.configDir = path.dirname(this.configPath);
        this.saveDebounce = saveDebounce;
        this.data = this.loadFromDisk();
    }
    /**
     * Obtém instância singleton
     */
    static getInstance(configPath) {
        if (!DaemonConfigStore.instance) {
            DaemonConfigStore.instance = new DaemonConfigStore(configPath);
        }
        return DaemonConfigStore.instance;
    }
    /**
     * Reseta a instância (útil para testes)
     */
    static resetInstance() {
        if (DaemonConfigStore.instance) {
            DaemonConfigStore.instance.removeAllListeners();
            if (DaemonConfigStore.instance.saveTimeout) {
                clearTimeout(DaemonConfigStore.instance.saveTimeout);
            }
            DaemonConfigStore.instance = null;
        }
    }
    /**
     * Carrega configuração do disco
     */
    loadFromDisk() {
        try {
            this.ensureConfigDir();
            if (fs.existsSync(this.configPath)) {
                const data = fs.readFileSync(this.configPath, 'utf-8');
                const loaded = JSON.parse(data);
                console.log(`📁 Configuração carregada de: ${this.configPath}`);
                // Migra environments antigos que não têm ID
                const environments = this.migrateEnvironments(loaded.environments || []);
                const needsMigration = environments.some((env, i) => !loaded.environments?.[i]?.id || !loaded.environments?.[i]?.createdAt);
                // CRÍTICO: Preserva o token do arquivo - NUNCA usar default se existir token no arquivo
                const fileToken = loaded.auth?.token;
                const fileTokenHash = loaded.auth?.tokenHash;
                // Se existe um token no arquivo E é diferente do default, usa o do arquivo
                const auth = fileToken && fileToken !== DEFAULT_CONFIG.auth.token
                    ? { token: fileToken, tokenHash: fileTokenHash || this.hashToken(fileToken) }
                    : fileToken
                        ? { token: fileToken, tokenHash: fileTokenHash || this.hashToken(fileToken) }
                        : { token: this.generateSecureToken(), tokenHash: undefined }; // Gera novo se não existir
                // Adiciona hash se não tiver
                if (!auth.tokenHash) {
                    auth.tokenHash = this.hashToken(auth.token);
                }
                console.log(`🔑 Token carregado: ${auth.token.substring(0, 8)}...`);
                const config = {
                    ...DEFAULT_CONFIG,
                    ...loaded,
                    auth, // Usa SEMPRE o token do arquivo (ou novo gerado)
                    instances: loaded.instances || [],
                    environments,
                    webhooks: loaded.webhooks || [],
                    monitor: { ...DEFAULT_CONFIG.monitor, ...loaded.monitor },
                };
                // Salva automaticamente se houve migração OU se gerou novo token
                if ((needsMigration && environments.length > 0) || !fileToken) {
                    if (!fileToken) {
                        console.log(`🔑 Novo token gerado automaticamente`);
                    }
                    if (needsMigration && environments.length > 0) {
                        console.log(`🔄 Migrando ${environments.length} environment(s) para novo formato com ID`);
                    }
                    this.isDirty = true;
                }
                return config;
            }
        }
        catch (error) {
            console.error('Erro ao carregar configuração:', error);
            // Em caso de erro, tenta ler o token existente do arquivo para não perdê-lo
            try {
                const rawData = fs.readFileSync(this.configPath, 'utf-8');
                const tokenMatch = rawData.match(/"token"\s*:\s*"([^"]+)"/);
                if (tokenMatch && tokenMatch[1] && tokenMatch[1] !== DEFAULT_CONFIG.auth.token) {
                    console.log('⚠️ Erro no JSON mas token preservado');
                    return {
                        ...DEFAULT_CONFIG,
                        auth: { token: tokenMatch[1], tokenHash: this.hashToken(tokenMatch[1]) }
                    };
                }
            }
            catch { }
        }
        // Se não existe arquivo, gera um token seguro novo
        const newToken = this.generateSecureToken();
        console.log(`🔑 Gerando novo token: ${newToken.substring(0, 8)}...`);
        return {
            ...DEFAULT_CONFIG,
            auth: { token: newToken, tokenHash: this.hashToken(newToken) }
        };
    }
    /**
     * Gera um token seguro aleatório
     */
    generateSecureToken() {
        return crypto.randomBytes(32).toString('hex');
    }
    /**
     * Migra environments antigos para o novo formato com ID
     */
    migrateEnvironments(environments) {
        const now = new Date().toISOString();
        return environments.map(env => ({
            id: env.id || generateId(),
            name: env.name || '',
            displayName: env.displayName || env.name || '',
            rootPath: env.rootPath || '',
            iniPath: env.iniPath || '',
            enabled: env.enabled ?? true,
            type: env.type || 'appserver',
            port: env.port,
            instanceId: env.instanceId,
            createdAt: env.createdAt || now,
            updatedAt: env.updatedAt || now,
        }));
    }
    /**
     * Garante que o diretório de configuração existe
     */
    ensureConfigDir() {
        if (!fs.existsSync(this.configDir)) {
            fs.mkdirSync(this.configDir, { recursive: true });
        }
    }
    /**
     * Retorna a configuração atual
     */
    get() {
        return this.data;
    }
    /**
     * Atualiza a configuração (merge parcial)
     */
    set(updates) {
        this.previousData = { ...this.data };
        this.data = this.deepMerge(this.data, updates);
        this.isDirty = true;
        this.emit('change', this.data, this.previousData);
        this.scheduleSave();
        return this.data;
    }
    /**
     * Substitui completamente a configuração
     */
    replace(config) {
        this.previousData = this.data;
        this.data = { ...config };
        this.isDirty = true;
        this.emit('change', this.data, this.previousData);
        this.scheduleSave();
        return this.data;
    }
    /**
     * Salva a configuração no disco
     */
    save(force = false) {
        if (!force && !this.isDirty) {
            return true;
        }
        try {
            this.ensureConfigDir();
            // Prepara dados para salvar (protege o token)
            const configToSave = {
                ...this.data,
                auth: {
                    ...this.data.auth,
                    token: this.data.auth.token,
                    tokenHash: this.data.auth.tokenHash || this.hashToken(this.data.auth.token),
                },
            };
            const content = JSON.stringify(configToSave, null, 2);
            // Salva atomicamente
            const tempPath = `${this.configPath}.tmp`;
            fs.writeFileSync(tempPath, content, 'utf-8');
            fs.renameSync(tempPath, this.configPath);
            this.isDirty = false;
            this.emit('save', this.data);
            return true;
        }
        catch (error) {
            console.error('Erro ao salvar configuração:', error);
            this.emit('error', error);
            return false;
        }
    }
    /**
     * Agenda salvamento com debounce
     */
    scheduleSave() {
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }
        this.saveTimeout = setTimeout(() => {
            this.save();
            this.saveTimeout = null;
        }, this.saveDebounce);
    }
    /**
     * Força salvamento imediato
     */
    flush() {
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
            this.saveTimeout = null;
        }
        return this.save(true);
    }
    /**
     * Recarrega configuração do disco
     */
    reload() {
        this.previousData = this.data;
        this.data = this.loadFromDisk();
        this.isDirty = false;
        this.emit('reload', this.data, this.previousData);
        return this.data;
    }
    /**
     * Gera hash do token
     */
    hashToken(token) {
        return crypto.createHash('sha256').update(token).digest('hex');
    }
    /**
     * Deep merge de objetos
     */
    deepMerge(target, source) {
        const result = { ...target };
        for (const key in source) {
            if (source[key] !== undefined) {
                const sourceValue = source[key];
                const targetValue = result[key];
                if (typeof sourceValue === 'object' &&
                    sourceValue !== null &&
                    !Array.isArray(sourceValue) &&
                    typeof targetValue === 'object' &&
                    targetValue !== null &&
                    !Array.isArray(targetValue)) {
                    result[key] = this.deepMerge(targetValue, sourceValue);
                }
                else {
                    result[key] = sourceValue;
                }
            }
        }
        return result;
    }
    // ============================================================================
    // MÉTODOS DE CONVENIÊNCIA PARA ENVIRONMENTS
    // ============================================================================
    /**
     * Adiciona um environment (gera ID automaticamente se não fornecido)
     */
    addEnvironment(env) {
        const now = new Date().toISOString();
        // Verifica se já existe por nome ou rootPath
        const exists = this.data.environments.some(e => e.name === env.name || e.rootPath === env.rootPath);
        if (exists) {
            throw new Error(`Environment com nome '${env.name}' ou rootPath '${env.rootPath}' já existe`);
        }
        const newEnv = {
            id: env.id || generateId(),
            name: env.name,
            displayName: env.displayName,
            rootPath: env.rootPath,
            iniPath: env.iniPath,
            enabled: env.enabled,
            type: env.type,
            port: env.port,
            instanceId: env.instanceId,
            createdAt: env.createdAt || now,
            updatedAt: env.updatedAt || now,
        };
        this.previousData = { ...this.data };
        this.data.environments.push(newEnv);
        this.isDirty = true;
        this.emit('change', this.data, this.previousData);
        this.scheduleSave();
        return newEnv;
    }
    /**
     * Remove um environment por ID ou nome
     */
    removeEnvironment(idOrName) {
        const index = this.data.environments.findIndex(e => e.id === idOrName || e.name === idOrName);
        if (index !== -1) {
            this.previousData = { ...this.data };
            this.data.environments.splice(index, 1);
            this.isDirty = true;
            this.emit('change', this.data, this.previousData);
            this.scheduleSave();
            return true;
        }
        return false;
    }
    /**
     * Atualiza um environment por ID ou nome
     */
    updateEnvironment(idOrName, updates) {
        const env = this.data.environments.find(e => e.id === idOrName || e.name === idOrName);
        if (env) {
            this.previousData = { ...this.data };
            Object.assign(env, updates, { updatedAt: new Date().toISOString() });
            this.isDirty = true;
            this.emit('change', this.data, this.previousData);
            this.scheduleSave();
            return env;
        }
        return null;
    }
    /**
     * Obtém um environment por ID ou nome
     */
    getEnvironment(idOrName) {
        return this.data.environments.find(e => e.id === idOrName || e.name === idOrName);
    }
    /**
     * Obtém um environment por ID
     */
    getEnvironmentById(id) {
        return this.data.environments.find(e => e.id === id);
    }
    /**
     * Obtém um environment por nome
     */
    getEnvironmentByName(name) {
        return this.data.environments.find(e => e.name === name);
    }
    /**
     * Lista todos os environments
     */
    listEnvironments(enabledOnly = false) {
        if (enabledOnly) {
            return this.data.environments.filter(e => e.enabled);
        }
        return [...this.data.environments];
    }
    // ============================================================================
    // MÉTODOS DE CONVENIÊNCIA PARA INSTANCES
    // ============================================================================
    /**
     * Adiciona uma instance (gera ID automaticamente se não fornecido)
     */
    addInstance(instance) {
        const now = new Date().toISOString();
        const newInstance = {
            id: instance.id || generateId(),
            name: instance.name,
            displayName: instance.displayName,
            type: instance.type,
            description: instance.description,
            services: instance.services || [],
            enabled: instance.enabled ?? true,
            createdAt: instance.createdAt || now,
            updatedAt: instance.updatedAt || now,
        };
        const exists = this.data.instances.some(i => i.id === newInstance.id);
        if (exists) {
            throw new Error(`Instance com ID '${newInstance.id}' já existe`);
        }
        this.previousData = { ...this.data };
        this.data.instances.push(newInstance);
        this.isDirty = true;
        this.emit('change', this.data, this.previousData);
        this.scheduleSave();
        return newInstance;
    }
    /**
     * Lista todas as instances
     */
    listInstances(enabledOnly = false) {
        if (enabledOnly) {
            return this.data.instances.filter(i => i.enabled);
        }
        return [...this.data.instances];
    }
    /**
     * Remove uma instance
     */
    removeInstance(id) {
        const index = this.data.instances.findIndex(i => i.id === id);
        if (index !== -1) {
            this.previousData = { ...this.data };
            this.data.instances.splice(index, 1);
            this.isDirty = true;
            this.emit('change', this.data, this.previousData);
            this.scheduleSave();
            return true;
        }
        return false;
    }
    /**
     * Atualiza uma instance
     */
    updateInstance(id, updates) {
        const instance = this.data.instances.find(i => i.id === id);
        if (instance) {
            this.previousData = { ...this.data };
            Object.assign(instance, updates, { updatedAt: new Date().toISOString() });
            this.isDirty = true;
            this.emit('change', this.data, this.previousData);
            this.scheduleSave();
            return instance;
        }
        return null;
    }
    /**
     * Obtém uma instance por ID
     */
    getInstance(id) {
        return this.data.instances.find(i => i.id === id);
    }
    /**
     * Adiciona serviço a uma instance
     */
    addServiceToInstance(instanceId, serviceName) {
        const instance = this.data.instances.find(i => i.id === instanceId);
        if (instance && !instance.services.includes(serviceName)) {
            this.previousData = { ...this.data };
            instance.services.push(serviceName);
            instance.updatedAt = new Date().toISOString();
            this.isDirty = true;
            this.emit('change', this.data, this.previousData);
            this.scheduleSave();
            return true;
        }
        return false;
    }
    /**
     * Remove serviço de uma instance
     */
    removeServiceFromInstance(instanceId, serviceName) {
        const instance = this.data.instances.find(i => i.id === instanceId);
        if (instance) {
            const index = instance.services.indexOf(serviceName);
            if (index !== -1) {
                this.previousData = { ...this.data };
                instance.services.splice(index, 1);
                instance.updatedAt = new Date().toISOString();
                this.isDirty = true;
                this.emit('change', this.data, this.previousData);
                this.scheduleSave();
                return true;
            }
        }
        return false;
    }
    /**
     * Registra listener para mudanças
     */
    onChange(listener) {
        this.on('change', listener);
        return () => this.off('change', listener);
    }
    /**
     * Retorna o caminho do arquivo de configuração
     */
    getConfigPath() {
        return this.configPath;
    }
    // ============================================================================
    // MÉTODOS DE CONVENIÊNCIA PARA WEBHOOKS
    // ============================================================================
    /**
     * Lista todos os webhooks
     */
    listWebhooks() {
        return [...this.data.webhooks];
    }
    /**
     * Obtém webhook por ID
     */
    getWebhook(id) {
        return this.data.webhooks.find(w => w.id === id);
    }
    /**
     * Adiciona um webhook
     */
    addWebhook(webhook) {
        const now = new Date().toISOString();
        const newWebhook = {
            ...webhook,
            id: generateId(),
            createdAt: now,
            updatedAt: now,
            failureCount: 0,
        };
        this.previousData = { ...this.data };
        this.data.webhooks.push(newWebhook);
        this.isDirty = true;
        this.emit('change', this.data, this.previousData);
        this.scheduleSave();
        return newWebhook;
    }
    /**
     * Atualiza um webhook
     */
    updateWebhook(id, updates) {
        const webhook = this.data.webhooks.find(w => w.id === id);
        if (webhook) {
            this.previousData = { ...this.data };
            Object.assign(webhook, updates, { updatedAt: new Date().toISOString() });
            this.isDirty = true;
            this.emit('change', this.data, this.previousData);
            this.scheduleSave();
            return webhook;
        }
        return null;
    }
    /**
     * Remove um webhook
     */
    removeWebhook(id) {
        const index = this.data.webhooks.findIndex(w => w.id === id);
        if (index !== -1) {
            this.previousData = { ...this.data };
            this.data.webhooks.splice(index, 1);
            this.isDirty = true;
            this.emit('change', this.data, this.previousData);
            this.scheduleSave();
            return true;
        }
        return false;
    }
    // ============================================================================
    // MÉTODOS PARA MONITOR
    // ============================================================================
    /**
     * Obtém configuração do monitor
     */
    getMonitorConfig() {
        return { ...this.data.monitor };
    }
    /**
     * Atualiza configuração do monitor
     */
    setMonitorConfig(updates) {
        this.previousData = { ...this.data };
        this.data.monitor = { ...this.data.monitor, ...updates };
        this.isDirty = true;
        this.emit('change', this.data, this.previousData);
        this.scheduleSave();
        return this.data.monitor;
    }
}
exports.DaemonConfigStore = DaemonConfigStore;
// Exporta instância singleton e classe
exports.daemonConfigStore = DaemonConfigStore.getInstance();
//# sourceMappingURL=config-store.js.map