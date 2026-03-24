"use strict";
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
exports.startWindowsAgent = startWindowsAgent;
exports.stopWindowsAgent = stopWindowsAgent;
exports.getWindowsAgentStatus = getWindowsAgentStatus;
exports.getWindowsEnvironments = getWindowsEnvironments;
exports.getWindowsServices = getWindowsServices;
const index_js_1 = require("../core/index.js");
const index_js_2 = require("../core/scanner/index.js");
const index_js_3 = require("../core/services/index.js");
__exportStar(require("./tray.js"), exports);
/**
 * Estado do agente Windows
 */
let isRunning = false;
/**
 * Inicia o agente no Windows
 */
async function startWindowsAgent(configPath) {
    if (isRunning) {
        throw new Error('Agent is already running');
    }
    try {
        await (0, index_js_1.startAgent)({ configPath });
        isRunning = true;
    }
    catch (error) {
        throw error;
    }
}
/**
 * Para o agente no Windows
 */
async function stopWindowsAgent() {
    if (!isRunning) {
        return;
    }
    await (0, index_js_1.stopAgent)();
    isRunning = false;
}
/**
 * Obtém status do agente
 */
function getWindowsAgentStatus() {
    try {
        const config = (0, index_js_1.getConfig)();
        return {
            running: isRunning,
            version: (0, index_js_1.getAgentVersion)(),
            port: config.server.port,
        };
    }
    catch {
        return {
            running: false,
            version: (0, index_js_1.getAgentVersion)(),
        };
    }
}
/**
 * Obtém ambientes para exibição
 */
async function getWindowsEnvironments() {
    const environments = await (0, index_js_2.scanEnvironments)();
    return environments.map(env => ({
        name: env.name,
        displayName: env.displayName,
        status: env.status,
        port: env.tcpPort,
        path: env.iniPath,
    }));
}
/**
 * Obtém serviços para exibição
 */
async function getWindowsServices() {
    const services = await (0, index_js_3.getServices)();
    return services.map(svc => ({
        id: svc.id,
        name: svc.name,
        type: svc.type,
        status: svc.status,
        port: svc.port,
        cpu: svc.metrics?.cpuPercent,
        memory: svc.metrics?.memoryBytes,
    }));
}
//# sourceMappingURL=index.js.map