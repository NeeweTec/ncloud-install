"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigStore = exports.configStore = void 0;
exports.getStore = getStore;
exports.initStore = initStore;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const node_crypto_1 = require("node:crypto");
const node_events_1 = require("node:events");
const schema_js_1 = require("./schema.js");
const defaults_js_1 = require("./defaults.js");
/**
 * ConfigStore - Gerenciador centralizado de configuração
 *
 * Resolve o problema de sincronização entre memória e disco:
 * - Mantém uma única fonte de verdade em memória
 * - Sincroniza automaticamente com o arquivo JSON
 * - Emite eventos quando a configuração muda
 * - Suporta watch para mudanças externas
 */
class ConfigStore extends node_events_1.EventEmitter {
    static instance = null;
    data = null;
    previousData = null;
    configPath;
    isLoaded = false;
    isDirty = false;
    watcher = null;
    saveTimeout = null;
    options;
    lastFileHash = '';
    constructor(options = {}) {
        super();
        this.options = {
            configPath: options.configPath || this.findConfigFile() || node_path_1.default.join((0, defaults_js_1.getConfigDir)(), 'config.json'),
            watchFile: options.watchFile ?? false,
            autoSave: options.autoSave ?? true,
            saveDebounce: options.saveDebounce ?? 100,
        };
        this.configPath = this.options.configPath;
    }
    /**
     * Obtém a instância singleton do ConfigStore
     */
    static getInstance(options) {
        if (!ConfigStore.instance) {
            ConfigStore.instance = new ConfigStore(options);
        }
        return ConfigStore.instance;
    }
    /**
     * Reseta a instância singleton (útil para testes)
     */
    static resetInstance() {
        if (ConfigStore.instance) {
            ConfigStore.instance.stopWatching();
            ConfigStore.instance.removeAllListeners();
            ConfigStore.instance = null;
        }
    }
    /**
     * Encontra o arquivo de configuração em ordem de prioridade
     */
    findConfigFile() {
        const candidates = [
            process.env.CONFIG_PATH,
            process.env.NCLOUD_CONFIG,
            node_path_1.default.join(process.cwd(), 'config.dev.json'),
            node_path_1.default.join(process.cwd(), 'config.json'),
            node_path_1.default.join((0, defaults_js_1.getConfigDir)(), 'config.json'),
        ].filter(Boolean);
        for (const candidate of candidates) {
            if (node_fs_1.default.existsSync(candidate)) {
                return candidate;
            }
        }
        return null;
    }
    /**
     * Carrega a configuração do arquivo
     * @param forceReload - Força recarregamento mesmo se já carregado
     */
    load(forceReload = false) {
        if (this.isLoaded && !forceReload && this.data) {
            return this.data;
        }
        let fileConfig = {};
        // Tenta ler do arquivo
        if (node_fs_1.default.existsSync(this.configPath)) {
            try {
                const content = node_fs_1.default.readFileSync(this.configPath, 'utf-8');
                fileConfig = JSON.parse(content);
                this.lastFileHash = this.hashContent(content);
                console.log(`📁 Configuração carregada de: ${this.configPath}`);
            }
            catch (error) {
                console.error(`Erro ao ler configuração de ${this.configPath}:`, error);
                this.emit('error', error);
            }
        }
        else {
            console.log('⚠️  Arquivo de configuração não encontrado, usando padrões');
        }
        // Em desenvolvimento, adiciona config de dev se auth não existe
        const isDev = process.env.NODE_ENV !== 'production';
        if (isDev && !fileConfig.auth) {
            const devToken = 'dev-token-ncloud-agent-development-mode-32chars';
            fileConfig = this.deepMerge({
                auth: {
                    token: devToken,
                    tokenHash: (0, node_crypto_1.createHash)('sha256').update(devToken).digest('hex'),
                },
            }, fileConfig);
        }
        // Merge com config padrão
        const mergedConfig = this.deepMerge(defaults_js_1.defaultConfig, fileConfig);
        // Valida com Zod
        const result = schema_js_1.configSchema.safeParse(mergedConfig);
        if (!result.success) {
            const error = new Error(`Configuração inválida: ${result.error.message}`);
            this.emit('error', error);
            throw error;
        }
        this.previousData = this.data;
        this.data = result.data;
        this.isLoaded = true;
        this.isDirty = false;
        // Inicia watch se configurado
        if (this.options.watchFile && !this.watcher) {
            this.startWatching();
        }
        // Emite evento de reload se não é a primeira carga
        if (this.previousData !== null) {
            this.emit('reload', this.data, this.previousData);
        }
        return this.data;
    }
    /**
     * Retorna a configuração atual
     * @throws Error se a configuração não foi carregada
     */
    get() {
        if (!this.isLoaded || !this.data) {
            return this.load();
        }
        return this.data;
    }
    /**
     * Atualiza a configuração (parcial ou completa)
     * Sincroniza automaticamente com o disco se autoSave está habilitado
     */
    set(updates) {
        if (!this.data) {
            this.load();
        }
        this.previousData = this.data ? { ...this.data } : null;
        // Merge profundo das atualizações
        const newConfig = this.deepMerge(this.data, updates);
        // Valida a nova configuração
        const result = schema_js_1.configSchema.safeParse(newConfig);
        if (!result.success) {
            const error = new Error(`Configuração inválida: ${result.error.message}`);
            this.emit('error', error);
            throw error;
        }
        this.data = result.data;
        this.isDirty = true;
        // Emite evento de mudança
        this.emit('change', this.data, this.previousData);
        // Salva automaticamente com debounce
        if (this.options.autoSave) {
            this.scheduleSave();
        }
        return this.data;
    }
    /**
     * Substitui completamente a configuração
     */
    replace(config) {
        const result = schema_js_1.configSchema.safeParse(config);
        if (!result.success) {
            const error = new Error(`Configuração inválida: ${result.error.message}`);
            this.emit('error', error);
            throw error;
        }
        this.previousData = this.data;
        this.data = result.data;
        this.isDirty = true;
        this.isLoaded = true;
        this.emit('change', this.data, this.previousData);
        if (this.options.autoSave) {
            this.scheduleSave();
        }
        return this.data;
    }
    /**
     * Salva a configuração no disco
     * @param force - Força salvamento mesmo se não há mudanças
     */
    save(force = false) {
        if (!force && !this.isDirty) {
            return true;
        }
        if (!this.data) {
            console.error('Nenhuma configuração para salvar');
            return false;
        }
        try {
            // Garante que o diretório existe
            const configDir = node_path_1.default.dirname(this.configPath);
            if (!node_fs_1.default.existsSync(configDir)) {
                node_fs_1.default.mkdirSync(configDir, { recursive: true });
            }
            // Prepara dados para salvar (protege o token)
            const configToSave = {
                ...this.data,
                auth: {
                    ...this.data.auth,
                    token: '***REDACTED***',
                    tokenHash: this.data.auth.tokenHash || this.hashToken(this.data.auth.token),
                },
            };
            const content = JSON.stringify(configToSave, null, 2);
            // Salva atomicamente (escreve em temp e renomeia)
            const tempPath = `${this.configPath}.tmp`;
            node_fs_1.default.writeFileSync(tempPath, content, 'utf-8');
            node_fs_1.default.renameSync(tempPath, this.configPath);
            this.lastFileHash = this.hashContent(content);
            this.isDirty = false;
            this.emit('save', this.data);
            console.log(`💾 Configuração salva em: ${this.configPath}`);
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
        }, this.options.saveDebounce);
    }
    /**
     * Força salvamento imediato (cancela debounce pendente)
     */
    flush() {
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
            this.saveTimeout = null;
        }
        return this.save(true);
    }
    /**
     * Recarrega a configuração do disco
     */
    reload() {
        return this.load(true);
    }
    /**
     * Inicia watch no arquivo para mudanças externas
     */
    startWatching() {
        if (this.watcher) {
            return;
        }
        try {
            const dir = node_path_1.default.dirname(this.configPath);
            const filename = node_path_1.default.basename(this.configPath);
            this.watcher = node_fs_1.default.watch(dir, (eventType, changedFile) => {
                if (changedFile === filename && eventType === 'change') {
                    // Verifica se o arquivo realmente mudou (evita loops)
                    try {
                        const content = node_fs_1.default.readFileSync(this.configPath, 'utf-8');
                        const newHash = this.hashContent(content);
                        if (newHash !== this.lastFileHash) {
                            console.log('🔄 Configuração alterada externamente, recarregando...');
                            this.reload();
                        }
                    }
                    catch {
                        // Arquivo pode estar sendo escrito
                    }
                }
            });
            console.log('👀 Watching configuração para mudanças externas');
        }
        catch (error) {
            console.error('Erro ao iniciar watch:', error);
        }
    }
    /**
     * Para o watch de arquivo
     */
    stopWatching() {
        if (this.watcher) {
            this.watcher.close();
            this.watcher = null;
        }
    }
    /**
     * Verifica se há mudanças não salvas
     */
    hasUnsavedChanges() {
        return this.isDirty;
    }
    /**
     * Retorna o caminho do arquivo de configuração
     */
    getConfigPath() {
        return this.configPath;
    }
    /**
     * Gera hash SHA-256 do token
     */
    hashToken(token) {
        return (0, node_crypto_1.createHash)('sha256').update(token).digest('hex');
    }
    /**
     * Gera hash do conteúdo (para detectar mudanças)
     */
    hashContent(content) {
        return (0, node_crypto_1.createHash)('md5').update(content).digest('hex');
    }
    /**
     * Deep merge de objetos
     */
    deepMerge(target, source) {
        const result = { ...target };
        for (const key in source) {
            if (source[key] !== undefined) {
                if (typeof source[key] === 'object' &&
                    source[key] !== null &&
                    !Array.isArray(source[key]) &&
                    typeof result[key] === 'object' &&
                    result[key] !== null) {
                    result[key] = this.deepMerge(result[key], source[key]);
                }
                else {
                    result[key] = source[key];
                }
            }
        }
        return result;
    }
    /**
     * Registra listener para mudanças
     */
    onChange(listener) {
        this.on('change', listener);
        return () => this.off('change', listener);
    }
    /**
     * Gera um token seguro
     */
    generateToken() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let token = '';
        const randomBytes = new Uint8Array(64);
        globalThis.crypto.getRandomValues(randomBytes);
        for (let i = 0; i < 64; i++) {
            token += chars[randomBytes[i] % chars.length];
        }
        return token;
    }
    /**
     * Valida um token contra o hash armazenado
     */
    validateToken(token, storedHash) {
        const tokenHash = this.hashToken(token);
        return tokenHash === storedHash;
    }
}
exports.ConfigStore = ConfigStore;
// Exporta instância singleton e classe
exports.configStore = ConfigStore.getInstance();
// Funções utilitárias para compatibilidade retroativa
function getStore() {
    return ConfigStore.getInstance();
}
function initStore(options) {
    return ConfigStore.getInstance(options);
}
//# sourceMappingURL=store.js.map