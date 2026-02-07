"use strict";
/**
 * WebSocket Server - Comunicação em tempo real
 *
 * Permite que clientes recebam eventos em tempo real via WebSocket.
 * Suporta:
 * - Conexões múltiplas
 * - Subscrição por tipo de evento
 * - Autenticação via token
 * - Heartbeat para manter conexões vivas
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
exports.RealtimeServer = void 0;
const ws_1 = require("ws");
const crypto = __importStar(require("crypto"));
class RealtimeServer {
    wss = null;
    clients = new Map();
    tokenValidator;
    statusProvider;
    heartbeatInterval = null;
    heartbeatMs = 30000;
    constructor(tokenValidator, statusProvider) {
        this.tokenValidator = tokenValidator;
        this.statusProvider = statusProvider;
    }
    /**
     * Inicia o servidor WebSocket
     */
    start(port) {
        if (this.wss) {
            console.log('[WS] Already running');
            return;
        }
        this.wss = new ws_1.WebSocketServer({
            port,
            path: '/ws',
            verifyClient: (info, callback) => this.verifyClient(info, callback),
        });
        this.wss.on('connection', (ws, request) => this.handleConnection(ws, request));
        this.wss.on('error', (error) => console.error('[WS] Server error:', error));
        // Heartbeat para detectar conexões mortas
        this.heartbeatInterval = setInterval(() => this.heartbeat(), this.heartbeatMs);
        console.log(`[WS] WebSocket server started on port ${port}`);
    }
    /**
     * Para o servidor WebSocket
     */
    stop() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
        if (this.wss) {
            // Fecha todas as conexões
            for (const [, { ws }] of this.clients) {
                ws.close(1001, 'Server shutting down');
            }
            this.clients.clear();
            this.wss.close();
            this.wss = null;
            console.log('[WS] WebSocket server stopped');
        }
    }
    /**
     * Broadcast de evento para todos os clientes inscritos
     */
    broadcast(event) {
        const message = { type: 'event', event };
        const payload = JSON.stringify(message);
        for (const [, { ws, client }] of this.clients) {
            // Verifica se cliente está inscrito neste tipo de evento
            if (client.subscriptions.length === 0 || client.subscriptions.includes(event.type) || client.subscriptions.includes('*')) {
                if (ws.readyState === ws_1.WebSocket.OPEN) {
                    ws.send(payload);
                }
            }
        }
    }
    /**
     * Envia evento para cliente específico
     */
    sendToClient(clientId, event) {
        const entry = this.clients.get(clientId);
        if (!entry || entry.ws.readyState !== ws_1.WebSocket.OPEN)
            return false;
        const message = { type: 'event', event };
        entry.ws.send(JSON.stringify(message));
        return true;
    }
    /**
     * Obtém lista de clientes conectados
     */
    getClients() {
        return Array.from(this.clients.values()).map(({ client }) => client);
    }
    /**
     * Obtém número de clientes conectados
     */
    getClientCount() {
        return this.clients.size;
    }
    // ============================================================================
    // MÉTODOS PRIVADOS
    // ============================================================================
    /**
     * Verifica autenticação do cliente
     */
    verifyClient(info, callback) {
        const url = new URL(info.req.url || '/', `http://${info.req.headers.host}`);
        const token = url.searchParams.get('token') || this.extractBearerToken(info.req);
        if (!token) {
            callback(false, 401, 'Token required');
            return;
        }
        if (!this.tokenValidator.validate(token)) {
            callback(false, 403, 'Invalid token');
            return;
        }
        callback(true);
    }
    /**
     * Extrai token Bearer do header Authorization
     */
    extractBearerToken(req) {
        const auth = req.headers.authorization;
        if (!auth || !auth.startsWith('Bearer '))
            return null;
        return auth.slice(7);
    }
    /**
     * Trata nova conexão
     */
    handleConnection(ws, request) {
        const clientId = crypto.randomUUID();
        const client = {
            id: clientId,
            subscriptions: ['*'], // Por padrão, recebe todos os eventos
            connectedAt: Date.now(),
        };
        // Adiciona propriedade para controle de heartbeat
        ws.isAlive = true;
        ws.on('pong', () => { ws.isAlive = true; });
        this.clients.set(clientId, { ws, client });
        console.log(`[WS] Client connected: ${clientId} (total: ${this.clients.size})`);
        // Envia confirmação de conexão
        const welcome = {
            type: 'connected',
            clientId,
            events: client.subscriptions,
        };
        ws.send(JSON.stringify(welcome));
        // Handlers de eventos
        ws.on('message', (data) => this.handleMessage(clientId, data));
        ws.on('close', () => this.handleClose(clientId));
        ws.on('error', (error) => console.error(`[WS] Client ${clientId} error:`, error));
    }
    /**
     * Trata mensagem recebida
     */
    handleMessage(clientId, data) {
        const entry = this.clients.get(clientId);
        if (!entry)
            return;
        try {
            const message = JSON.parse(data.toString());
            switch (message.type) {
                case 'subscribe':
                    if (message.events && Array.isArray(message.events)) {
                        entry.client.subscriptions = message.events;
                        const response = { type: 'subscribed', events: message.events };
                        entry.ws.send(JSON.stringify(response));
                    }
                    break;
                case 'unsubscribe':
                    if (message.events && Array.isArray(message.events)) {
                        entry.client.subscriptions = entry.client.subscriptions.filter(e => !message.events.includes(e));
                        const response = { type: 'unsubscribed', events: message.events };
                        entry.ws.send(JSON.stringify(response));
                    }
                    break;
                case 'ping':
                    entry.ws.send(JSON.stringify({ type: 'pong' }));
                    break;
                case 'get_status':
                    let status;
                    if (message.serviceId) {
                        const snapshot = this.statusProvider.getSnapshot(message.serviceId);
                        status = snapshot || [];
                    }
                    else {
                        status = this.statusProvider.getAllSnapshots();
                    }
                    const statusResponse = { type: 'status', status };
                    entry.ws.send(JSON.stringify(statusResponse));
                    break;
                default:
                    entry.ws.send(JSON.stringify({ type: 'error', error: 'Unknown message type' }));
            }
        }
        catch (error) {
            entry.ws.send(JSON.stringify({ type: 'error', error: 'Invalid message format' }));
        }
    }
    /**
     * Trata desconexão
     */
    handleClose(clientId) {
        this.clients.delete(clientId);
        console.log(`[WS] Client disconnected: ${clientId} (total: ${this.clients.size})`);
    }
    /**
     * Heartbeat para verificar conexões ativas
     */
    heartbeat() {
        for (const [clientId, { ws }] of this.clients) {
            if (ws.isAlive === false) {
                console.log(`[WS] Client ${clientId} timed out`);
                ws.terminate();
                this.clients.delete(clientId);
                continue;
            }
            ws.isAlive = false;
            ws.ping();
        }
    }
}
exports.RealtimeServer = RealtimeServer;
exports.default = RealtimeServer;
//# sourceMappingURL=websocket-server.js.map