"use strict";
/**
 * ServiceMonitor - Monitoramento contínuo de serviços em background
 *
 * Este módulo monitora periodicamente o estado dos serviços Protheus
 * e emite eventos quando há mudanças de estado.
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
exports.ServiceMonitor = void 0;
const events_1 = require("events");
const child_process_1 = require("child_process");
const util_1 = require("util");
const net = __importStar(require("net"));
const fs = __importStar(require("fs"));
const execAsync = (0, util_1.promisify)(child_process_1.exec);
class ServiceMonitor extends events_1.EventEmitter {
    static instance = null;
    configProvider;
    options;
    isRunning = false;
    pollTimer = null;
    // Cache de estados anteriores para detectar mudanças
    previousStates = new Map();
    // Cache de snapshots atuais
    snapshots = new Map();
    // Tempo de início dos serviços (para calcular uptime)
    startTimes = new Map();
    // Listeners externos
    eventListeners = new Set();
    constructor(configProvider, options) {
        super();
        this.configProvider = configProvider;
        this.options = {
            pollIntervalMs: options?.pollIntervalMs ?? 5000,
            staleThresholdMs: options?.staleThresholdMs ?? 30000,
            enableProcessMetrics: options?.enableProcessMetrics ?? true,
        };
    }
    /**
     * Obtém ou cria instância singleton
     */
    static getInstance(configProvider, options) {
        if (!ServiceMonitor.instance) {
            if (!configProvider) {
                throw new Error('ConfigProvider required for first initialization');
            }
            ServiceMonitor.instance = new ServiceMonitor(configProvider, options);
        }
        return ServiceMonitor.instance;
    }
    /**
     * Inicia o monitoramento
     */
    start() {
        if (this.isRunning) {
            console.log('[Monitor] Already running');
            return;
        }
        console.log(`[Monitor] Starting with ${this.options.pollIntervalMs}ms poll interval`);
        this.isRunning = true;
        // Primeira verificação imediata
        this.poll();
        // Agenda verificações periódicas
        this.pollTimer = setInterval(() => this.poll(), this.options.pollIntervalMs);
        this.emitSystemEvent('system:agent_started', { pollInterval: this.options.pollIntervalMs });
    }
    /**
     * Para o monitoramento
     */
    stop() {
        if (!this.isRunning)
            return;
        console.log('[Monitor] Stopping');
        this.isRunning = false;
        if (this.pollTimer) {
            clearInterval(this.pollTimer);
            this.pollTimer = null;
        }
        this.emitSystemEvent('system:agent_stopped', {});
    }
    /**
     * Executa uma verificação de todos os serviços
     */
    async poll() {
        const environments = this.configProvider.getEnvironments().filter(e => e.enabled);
        for (const env of environments) {
            try {
                await this.checkService(env);
            }
            catch (error) {
                console.error(`[Monitor] Error checking ${env.name}:`, error);
            }
        }
    }
    /**
     * Força refresh de um serviço específico
     */
    async refresh(serviceId) {
        const env = this.configProvider.getEnvironments().find(e => e.id === serviceId || e.name === serviceId);
        if (!env)
            return null;
        await this.checkService(env);
        return this.snapshots.get(env.id) || null;
    }
    /**
     * Obtém snapshot atual de um serviço
     */
    getSnapshot(serviceId) {
        return this.snapshots.get(serviceId);
    }
    /**
     * Obtém todos os snapshots atuais
     */
    getAllSnapshots() {
        return Array.from(this.snapshots.values());
    }
    /**
     * Verifica se os dados estão obsoletos
     */
    isStale(serviceId) {
        const snapshot = this.snapshots.get(serviceId);
        if (!snapshot)
            return true;
        return Date.now() - snapshot.lastChecked > this.options.staleThresholdMs;
    }
    /**
     * Adiciona listener de eventos de monitoramento
     */
    onEvent(listener) {
        this.eventListeners.add(listener);
        return () => this.eventListeners.delete(listener);
    }
    /**
     * Remove listener de eventos de monitoramento
     */
    offEvent(listener) {
        this.eventListeners.delete(listener);
    }
    // ============================================================================
    // MÉTODOS PRIVADOS
    // ============================================================================
    /**
     * Verifica estado de um serviço específico
     */
    async checkService(env) {
        const port = env.port || await this.detectPort(env);
        const previousState = this.previousStates.get(env.id) || 'unknown';
        let currentState = 'stopped';
        let pid;
        let memory;
        let cpu;
        if (port && port > 0) {
            const isRunning = await this.checkPortInUse(port);
            if (isRunning) {
                currentState = 'running';
                pid = await this.getPidByPort(port);
                if (pid && this.options.enableProcessMetrics) {
                    const metrics = await this.getProcessMetrics(pid);
                    memory = metrics.memory;
                    cpu = metrics.cpu;
                }
                // Registra tempo de início se acabou de iniciar
                if (previousState !== 'running' && !this.startTimes.has(env.id)) {
                    this.startTimes.set(env.id, Date.now());
                }
            }
            else {
                // Limpa tempo de início se parou
                this.startTimes.delete(env.id);
            }
        }
        // Calcula uptime
        const startTime = this.startTimes.get(env.id);
        const uptime = startTime ? Math.floor((Date.now() - startTime) / 1000) : undefined;
        // Cria snapshot
        const snapshot = {
            id: env.id,
            name: env.name,
            displayName: env.displayName,
            type: env.type,
            state: currentState,
            pid,
            port: port || undefined,
            memory,
            cpu,
            uptime,
            lastChecked: Date.now(),
        };
        // Atualiza cache
        this.snapshots.set(env.id, snapshot);
        // Detecta e emite eventos de mudança
        if (previousState !== currentState && previousState !== 'unknown') {
            this.emitStateChange(env, previousState, currentState, snapshot);
        }
        // Atualiza estado anterior
        this.previousStates.set(env.id, currentState);
    }
    /**
     * Detecta porta do serviço a partir do INI
     */
    async detectPort(env) {
        try {
            if (!fs.existsSync(env.iniPath))
                return 0;
            const content = fs.readFileSync(env.iniPath, 'latin1');
            const lines = content.split(/\r?\n/);
            for (const line of lines) {
                const match = line.match(/^(?:PORT|TCPPORT)\s*=\s*(\d+)/i);
                if (match)
                    return parseInt(match[1], 10);
            }
            // Tenta porta específica para license server
            if (env.type === 'license') {
                for (const line of lines) {
                    const match = line.match(/^LICENSESVRPORT\s*=\s*(\d+)/i);
                    if (match)
                        return parseInt(match[1], 10);
                }
            }
        }
        catch (error) {
            // Silently fail
        }
        return 0;
    }
    /**
     * Verifica se uma porta está em uso
     */
    checkPortInUse(port) {
        return new Promise((resolve) => {
            const socket = new net.Socket();
            socket.setTimeout(1000);
            socket.on('connect', () => {
                socket.destroy();
                resolve(true);
            });
            socket.on('timeout', () => {
                socket.destroy();
                resolve(false);
            });
            socket.on('error', () => {
                socket.destroy();
                resolve(false);
            });
            socket.connect(port, '127.0.0.1');
        });
    }
    /**
     * Obtém PID pelo número da porta
     */
    async getPidByPort(port) {
        try {
            const { stdout } = await execAsync(`ss -tlnp 2>/dev/null | grep ':${port} ' | head -1`);
            const match = stdout.match(/pid=(\d+)/);
            if (match)
                return parseInt(match[1], 10);
            // Fallback para lsof
            const { stdout: lsofOut } = await execAsync(`lsof -i :${port} -t 2>/dev/null | head -1`);
            if (lsofOut.trim())
                return parseInt(lsofOut.trim(), 10);
        }
        catch {
            // Silently fail
        }
        return undefined;
    }
    /**
     * Obtém métricas de um processo
     */
    async getProcessMetrics(pid) {
        const result = {};
        try {
            // Memória em MB
            const { stdout: memOut } = await execAsync(`ps -p ${pid} -o rss= 2>/dev/null`);
            if (memOut.trim()) {
                result.memory = Math.round(parseInt(memOut.trim(), 10) / 1024);
            }
            // CPU (ps %cpu é uma média desde início do processo)
            const { stdout: cpuOut } = await execAsync(`ps -p ${pid} -o %cpu= 2>/dev/null`);
            if (cpuOut.trim()) {
                result.cpu = parseFloat(cpuOut.trim());
            }
        }
        catch {
            // Silently fail
        }
        return result;
    }
    /**
     * Emite evento de mudança de estado
     */
    emitStateChange(env, previousState, currentState, snapshot) {
        let eventType;
        if (previousState === 'running' && currentState === 'stopped') {
            // Pode ser crash ou stop normal
            eventType = 'service:stopped';
        }
        else if (previousState === 'stopped' && currentState === 'running') {
            eventType = 'service:started';
        }
        else {
            eventType = 'service:health_changed';
        }
        const event = {
            type: eventType,
            serviceId: env.id,
            serviceName: env.name,
            timestamp: Date.now(),
            previousState,
            currentState,
            details: {
                pid: snapshot.pid,
                port: snapshot.port,
            },
        };
        console.log(`[Monitor] ${env.name}: ${previousState} -> ${currentState}`);
        this.dispatchEvent(event);
    }
    /**
     * Emite evento do sistema
     */
    emitSystemEvent(type, details) {
        const event = { type, timestamp: Date.now(), details };
        this.dispatchEvent(event);
    }
    /**
     * Despacha evento para todos os listeners
     */
    dispatchEvent(event) {
        // Emite via EventEmitter (para uso interno)
        this.emit('event', event);
        this.emit(event.type, event);
        // Notifica listeners externos
        for (const listener of this.eventListeners) {
            try {
                const result = listener(event);
                if (result instanceof Promise) {
                    result.catch(err => console.error('[Monitor] Listener error:', err));
                }
            }
            catch (err) {
                console.error('[Monitor] Listener error:', err);
            }
        }
    }
    /**
     * Notifica mudança de configuração (chamar quando config mudar)
     */
    notifyConfigChange() {
        this.emitSystemEvent('system:config_changed', {});
        // Força refresh imediato
        this.poll();
    }
}
exports.ServiceMonitor = ServiceMonitor;
exports.default = ServiceMonitor;
//# sourceMappingURL=service-monitor.js.map