"use strict";
/**
 * Sistema de System Tray para Windows
 * Este módulo é usado pelo Electron para gerenciar o ícone na bandeja
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTrayState = getTrayState;
exports.generateTrayMenu = generateTrayMenu;
exports.getTrayTooltip = getTrayTooltip;
exports.getTrayIcon = getTrayIcon;
const index_js_1 = require("../core/config/index.js");
const index_js_2 = require("../core/index.js");
/**
 * Obtém estado atual para o tray
 */
function getTrayState() {
    try {
        const config = (0, index_js_1.getConfig)();
        return {
            running: true,
            port: config.server.port,
            version: (0, index_js_2.getAgentVersion)(),
            environments: 0,
            services: 0,
        };
    }
    catch {
        return {
            running: false,
            port: 3100,
            version: (0, index_js_2.getAgentVersion)(),
            environments: 0,
            services: 0,
        };
    }
}
/**
 * Gera menu do tray
 */
function generateTrayMenu(state, handlers) {
    return [
        {
            label: `☁️ Ncloud Agent v${state.version}`,
            enabled: false,
        },
        { type: 'separator' },
        {
            label: `Status: ${state.running ? '🟢 Ativo' : '🔴 Inativo'}`,
            enabled: false,
        },
        {
            label: `Porta: ${state.port}`,
            enabled: false,
        },
        { type: 'separator' },
        {
            label: 'Abrir Painel',
            click: handlers.onOpenPanel,
        },
        {
            label: 'Ver Logs',
            click: handlers.onOpenLogs,
        },
        { type: 'separator' },
        {
            label: 'Reiniciar Agente',
            click: handlers.onRestart,
        },
        {
            label: 'Parar Agente',
            click: handlers.onStop,
            enabled: state.running,
        },
        { type: 'separator' },
        {
            label: 'Sair',
            click: handlers.onQuit,
        },
    ];
}
/**
 * Tooltip do tray
 */
function getTrayTooltip(state) {
    if (state.running) {
        return `Ncloud Agent - Ativo na porta ${state.port}`;
    }
    return 'Ncloud Agent - Inativo';
}
/**
 * Ícone do tray baseado no estado
 */
function getTrayIcon(running) {
    return running ? 'active' : 'inactive';
}
//# sourceMappingURL=tray.js.map