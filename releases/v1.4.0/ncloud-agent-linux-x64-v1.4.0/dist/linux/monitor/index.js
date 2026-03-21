"use strict";
/**
 * Monitor Module - Observabilidade em tempo real
 *
 * Este módulo fornece:
 * - Monitoramento contínuo de serviços
 * - Eventos de mudança de estado
 * - WebSocket para push em tempo real
 * - Webhooks para integrações externas
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
exports.RealtimeServer = exports.WebhookManager = exports.ServiceMonitor = void 0;
__exportStar(require("./types.js"), exports);
var service_monitor_js_1 = require("./service-monitor.js");
Object.defineProperty(exports, "ServiceMonitor", { enumerable: true, get: function () { return service_monitor_js_1.ServiceMonitor; } });
var webhook_manager_js_1 = require("./webhook-manager.js");
Object.defineProperty(exports, "WebhookManager", { enumerable: true, get: function () { return webhook_manager_js_1.WebhookManager; } });
var websocket_server_js_1 = require("./websocket-server.js");
Object.defineProperty(exports, "RealtimeServer", { enumerable: true, get: function () { return websocket_server_js_1.RealtimeServer; } });
//# sourceMappingURL=index.js.map