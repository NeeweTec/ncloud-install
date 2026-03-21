"use strict";
/**
 * WebhookManager - Gerenciamento e disparo de webhooks
 *
 * Responsável por:
 * - Armazenar configurações de webhooks
 * - Disparar webhooks quando eventos ocorrem
 * - Retry com backoff exponencial
 * - Assinatura HMAC para segurança
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
exports.WebhookManager = void 0;
const crypto = __importStar(require("crypto"));
const https = __importStar(require("https"));
const http = __importStar(require("http"));
const url_1 = require("url");
const events_1 = require("events");
class WebhookManager extends events_1.EventEmitter {
    static instance = null;
    store;
    webhooks = new Map();
    deliveryHistory = [];
    maxHistorySize = 1000;
    agentInfo;
    constructor(store, agentInfo) {
        super();
        this.store = store;
        this.agentInfo = agentInfo;
        this.loadWebhooks();
    }
    /**
     * Obtém ou cria instância singleton
     */
    static getInstance(store, agentInfo) {
        if (!WebhookManager.instance) {
            if (!store || !agentInfo) {
                throw new Error('Store and agentInfo required for first initialization');
            }
            WebhookManager.instance = new WebhookManager(store, agentInfo);
        }
        return WebhookManager.instance;
    }
    /**
     * Reseta instância (para testes)
     */
    static resetInstance() {
        WebhookManager.instance = null;
    }
    // ============================================================================
    // CRUD DE WEBHOOKS
    // ============================================================================
    /**
     * Lista todos os webhooks
     */
    list() {
        return Array.from(this.webhooks.values());
    }
    /**
     * Obtém webhook por ID
     */
    get(id) {
        return this.webhooks.get(id);
    }
    /**
     * Cria novo webhook
     */
    create(config) {
        const webhook = {
            ...config,
            id: crypto.randomUUID(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            failureCount: 0,
        };
        this.webhooks.set(webhook.id, webhook);
        this.saveWebhooks();
        console.log(`[Webhook] Created: ${webhook.name} (${webhook.id})`);
        return webhook;
    }
    /**
     * Atualiza webhook existente
     */
    update(id, updates) {
        const webhook = this.webhooks.get(id);
        if (!webhook)
            return null;
        const updated = {
            ...webhook,
            ...updates,
            updatedAt: new Date().toISOString(),
        };
        this.webhooks.set(id, updated);
        this.saveWebhooks();
        console.log(`[Webhook] Updated: ${updated.name} (${id})`);
        return updated;
    }
    /**
     * Remove webhook
     */
    delete(id) {
        const webhook = this.webhooks.get(id);
        if (!webhook)
            return false;
        this.webhooks.delete(id);
        this.saveWebhooks();
        console.log(`[Webhook] Deleted: ${webhook.name} (${id})`);
        return true;
    }
    /**
     * Testa webhook enviando evento de teste
     */
    async test(id) {
        const webhook = this.webhooks.get(id);
        if (!webhook) {
            return {
                webhookId: id,
                payloadId: 'test',
                success: false,
                error: 'Webhook not found',
                attempts: 0,
                timestamp: new Date().toISOString(),
            };
        }
        const testEvent = {
            type: 'system:agent_started',
            timestamp: Date.now(),
            details: { test: true },
        };
        return this.deliverToWebhook(webhook, testEvent, true);
    }
    // ============================================================================
    // DISPARO DE WEBHOOKS
    // ============================================================================
    /**
     * Dispara evento para todos os webhooks inscritos
     */
    async dispatch(event) {
        const enabledWebhooks = Array.from(this.webhooks.values()).filter(w => w.enabled && w.events.includes(event.type));
        if (enabledWebhooks.length === 0)
            return;
        console.log(`[Webhook] Dispatching ${event.type} to ${enabledWebhooks.length} webhook(s)`);
        const results = await Promise.allSettled(enabledWebhooks.map(webhook => this.deliverToWebhook(webhook, event)));
        // Processa resultados
        results.forEach((result, index) => {
            if (result.status === 'rejected') {
                console.error(`[Webhook] Delivery failed for ${enabledWebhooks[index].name}:`, result.reason);
            }
        });
    }
    /**
     * Entrega evento para um webhook específico
     */
    async deliverToWebhook(webhook, event, isTest = false) {
        const payloadId = crypto.randomUUID();
        const payload = {
            id: payloadId,
            timestamp: new Date().toISOString(),
            event,
            agent: this.agentInfo,
        };
        const body = JSON.stringify(payload);
        let lastError;
        let statusCode;
        let responseTime;
        let attempts = 0;
        // Tenta entregar com retry
        for (let i = 0; i <= webhook.retryCount; i++) {
            attempts = i + 1;
            try {
                const startTime = Date.now();
                const response = await this.sendRequest(webhook, body);
                responseTime = Date.now() - startTime;
                statusCode = response.statusCode;
                if (response.statusCode >= 200 && response.statusCode < 300) {
                    // Sucesso
                    const result = this.recordDelivery(webhook.id, payloadId, true, statusCode, responseTime, undefined, attempts);
                    if (!isTest) {
                        this.updateWebhookStatus(webhook.id, true);
                    }
                    return result;
                }
                lastError = `HTTP ${response.statusCode}`;
            }
            catch (error) {
                lastError = error instanceof Error ? error.message : String(error);
            }
            // Aguarda antes de retry (backoff exponencial)
            if (i < webhook.retryCount) {
                const delay = webhook.retryDelayMs * Math.pow(2, i);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        // Falha após todas as tentativas
        const result = this.recordDelivery(webhook.id, payloadId, false, statusCode, responseTime, lastError, attempts);
        if (!isTest) {
            this.updateWebhookStatus(webhook.id, false);
        }
        return result;
    }
    /**
     * Envia requisição HTTP
     */
    sendRequest(webhook, body) {
        return new Promise((resolve, reject) => {
            const url = new url_1.URL(webhook.url);
            const isHttps = url.protocol === 'https:';
            const client = isHttps ? https : http;
            const headers = {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body).toString(),
                'User-Agent': `NcloudAgent/${this.agentInfo.version}`,
                'X-Webhook-ID': webhook.id,
                ...webhook.headers,
            };
            // Assinatura HMAC se secret definido
            if (webhook.secret) {
                const signature = crypto
                    .createHmac('sha256', webhook.secret)
                    .update(body)
                    .digest('hex');
                headers['X-Signature-256'] = `sha256=${signature}`;
            }
            const options = {
                hostname: url.hostname,
                port: url.port || (isHttps ? 443 : 80),
                path: url.pathname + url.search,
                method: 'POST',
                headers,
                timeout: webhook.timeoutMs,
            };
            const req = client.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => resolve({ statusCode: res.statusCode || 0, body: data }));
            });
            req.on('error', reject);
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });
            req.write(body);
            req.end();
        });
    }
    // ============================================================================
    // HISTÓRICO E STATUS
    // ============================================================================
    /**
     * Obtém histórico de entregas
     */
    getDeliveryHistory(webhookId, limit = 100) {
        let history = this.deliveryHistory;
        if (webhookId) {
            history = history.filter(d => d.webhookId === webhookId);
        }
        return history.slice(-limit);
    }
    /**
     * Registra resultado de entrega
     */
    recordDelivery(webhookId, payloadId, success, statusCode, responseTime, error, attempts) {
        const result = {
            webhookId,
            payloadId,
            success,
            statusCode,
            responseTime,
            error,
            attempts: attempts || 1,
            timestamp: new Date().toISOString(),
        };
        this.deliveryHistory.push(result);
        // Limita tamanho do histórico
        if (this.deliveryHistory.length > this.maxHistorySize) {
            this.deliveryHistory = this.deliveryHistory.slice(-this.maxHistorySize);
        }
        this.emit('delivery', result);
        return result;
    }
    /**
     * Atualiza status do webhook após entrega
     */
    updateWebhookStatus(id, success) {
        const webhook = this.webhooks.get(id);
        if (!webhook)
            return;
        webhook.lastTriggeredAt = new Date().toISOString();
        webhook.lastStatus = success ? 'success' : 'failed';
        if (!success) {
            webhook.failureCount++;
        }
        else {
            webhook.failureCount = 0;
        }
        this.webhooks.set(id, webhook);
        this.saveWebhooks();
    }
    // ============================================================================
    // PERSISTÊNCIA
    // ============================================================================
    /**
     * Carrega webhooks do store
     */
    loadWebhooks() {
        try {
            const webhooks = this.store.getWebhooks();
            this.webhooks.clear();
            for (const webhook of webhooks) {
                this.webhooks.set(webhook.id, webhook);
            }
            console.log(`[Webhook] Loaded ${this.webhooks.size} webhook(s)`);
        }
        catch (error) {
            console.error('[Webhook] Error loading webhooks:', error);
        }
    }
    /**
     * Salva webhooks no store
     */
    saveWebhooks() {
        try {
            this.store.saveWebhooks(Array.from(this.webhooks.values()));
        }
        catch (error) {
            console.error('[Webhook] Error saving webhooks:', error);
        }
    }
}
exports.WebhookManager = WebhookManager;
exports.default = WebhookManager;
//# sourceMappingURL=webhook-manager.js.map