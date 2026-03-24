"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
// API exposta ao renderer
const electronAPI = {
    // ==================== API STATUS ====================
    getApiStatus: () => electron_1.ipcRenderer.invoke('get-api-status'),
    startApi: () => electron_1.ipcRenderer.invoke('start-api'),
    stopApi: () => electron_1.ipcRenderer.invoke('stop-api'),
    restartApi: () => electron_1.ipcRenderer.invoke('restart-api'),
    // ==================== CONFIGURAÇÃO ====================
    getConfig: () => electron_1.ipcRenderer.invoke('get-config'),
    saveConfig: (config) => electron_1.ipcRenderer.invoke('save-config', config),
    // ==================== SERVIÇOS (CRUD) ====================
    getServices: () => electron_1.ipcRenderer.invoke('get-services'),
    addService: (svc) => electron_1.ipcRenderer.invoke('add-service', svc),
    updateService: (name, updates) => electron_1.ipcRenderer.invoke('update-service', name, updates),
    removeService: (name) => electron_1.ipcRenderer.invoke('remove-service', name),
    // Aliases deprecated para compatibilidade
    getEnvironments: () => electron_1.ipcRenderer.invoke('get-services'),
    addEnvironment: (env) => electron_1.ipcRenderer.invoke('add-service', env),
    updateEnvironment: (name, updates) => electron_1.ipcRenderer.invoke('update-service', name, updates),
    removeEnvironment: (name) => electron_1.ipcRenderer.invoke('remove-service', name),
    // ==================== COMPONENTES ====================
    getComponents: () => electron_1.ipcRenderer.invoke('get-components'),
    addComponents: (components) => electron_1.ipcRenderer.invoke('add-components', components),
    removeComponent: (path) => electron_1.ipcRenderer.invoke('remove-component', path),
    // ==================== CONTROLE DE SERVIÇOS ====================
    startService: (name) => electron_1.ipcRenderer.invoke('start-service', name),
    stopService: (name) => electron_1.ipcRenderer.invoke('stop-service', name),
    restartService: (name) => electron_1.ipcRenderer.invoke('restart-service', name),
    getServiceStatus: (name) => electron_1.ipcRenderer.invoke('get-service-status', name),
    getAllServicesStatus: () => electron_1.ipcRenderer.invoke('get-all-services-status'),
    // ==================== DIÁLOGOS ====================
    selectDirectory: () => electron_1.ipcRenderer.invoke('select-directory'),
    selectIniFile: () => electron_1.ipcRenderer.invoke('select-ini-file'),
    // ==================== SCAN ====================
    scanDirectories: (directories) => electron_1.ipcRenderer.invoke('scan-directories', directories),
    checkDirectory: (path) => electron_1.ipcRenderer.invoke('check-directory', path),
    listSubdirectories: (path) => electron_1.ipcRenderer.invoke('list-subdirectories', path),
    // ==================== NAVEGAÇÃO DE ARQUIVOS ====================
    listDirectory: (path) => electron_1.ipcRenderer.invoke('list-directory', path),
    getServiceDirectories: (name) => electron_1.ipcRenderer.invoke('get-service-directories', name),
    // ==================== INSTÂNCIAS ====================
    getInstances: () => electron_1.ipcRenderer.invoke('get-instances'),
    getInstance: (id) => electron_1.ipcRenderer.invoke('get-instance', id),
    createInstance: (data) => electron_1.ipcRenderer.invoke('create-instance', data),
    updateInstance: (id, updates) => electron_1.ipcRenderer.invoke('update-instance', id, updates),
    deleteInstance: (id) => electron_1.ipcRenderer.invoke('delete-instance', id),
    addServiceToInstance: (instanceId, serviceName) => electron_1.ipcRenderer.invoke('add-service-to-instance', instanceId, serviceName),
    removeServiceFromInstance: (instanceId, serviceName) => electron_1.ipcRenderer.invoke('remove-service-from-instance', instanceId, serviceName),
    startInstanceServices: (instanceId) => electron_1.ipcRenderer.invoke('start-instance-services', instanceId),
    stopInstanceServices: (instanceId) => electron_1.ipcRenderer.invoke('stop-instance-services', instanceId),
    // ==================== ENVIRONMENTS DO INI ====================
    getServiceIniEnvironments: (serviceName) => electron_1.ipcRenderer.invoke('get-service-ini-environments', serviceName),
    getAllIniEnvironments: () => electron_1.ipcRenderer.invoke('get-all-ini-environments'),
    // ==================== DOCUMENTAÇÃO ====================
    getApiDocs: () => electron_1.ipcRenderer.invoke('get-api-docs'),
    // ==================== WEBHOOKS ====================
    getWebhooks: () => electron_1.ipcRenderer.invoke('get-webhooks'),
    getWebhook: (id) => electron_1.ipcRenderer.invoke('get-webhook', id),
    createWebhook: (data) => electron_1.ipcRenderer.invoke('create-webhook', data),
    updateWebhook: (id, updates) => electron_1.ipcRenderer.invoke('update-webhook', id, updates),
    deleteWebhook: (id) => electron_1.ipcRenderer.invoke('delete-webhook', id),
    testWebhook: (id) => electron_1.ipcRenderer.invoke('test-webhook', id),
    getWebhookDeliveries: (id, limit) => electron_1.ipcRenderer.invoke('get-webhook-deliveries', id, limit),
    // ==================== EVENTOS ====================
    onApiStatusChange: (callback) => {
        electron_1.ipcRenderer.on('api-status-change', (_event, status) => callback(status));
    },
    // Evento de atualização de status dos serviços (monitoramento em tempo real)
    onServicesStatusUpdate: (callback) => {
        const handler = (_event, data) => callback(data);
        electron_1.ipcRenderer.on('services-status-update', handler);
        // Retorna função para remover o listener
        return () => electron_1.ipcRenderer.removeListener('services-status-update', handler);
    },
    // Remove todos os listeners de um evento
    removeAllListeners: (channel) => {
        electron_1.ipcRenderer.removeAllListeners(channel);
    },
};
// Expõe a API para o renderer
electron_1.contextBridge.exposeInMainWorld('electronAPI', electronAPI);
//# sourceMappingURL=preload.js.map