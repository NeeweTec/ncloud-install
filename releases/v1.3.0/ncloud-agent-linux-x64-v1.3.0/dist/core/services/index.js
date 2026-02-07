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
exports.getServices = getServices;
exports.getServiceById = getServiceById;
exports.startService = startService;
exports.stopService = stopService;
exports.restartService = restartService;
exports.getServiceLogs = getServiceLogs;
const service_detector_js_1 = require("../scanner/service-detector.js");
const process_control_js_1 = require("./process-control.js");
const log_reader_js_1 = require("./log-reader.js");
__exportStar(require("./process-control.js"), exports);
__exportStar(require("./log-reader.js"), exports);
__exportStar(require("./port-checker.js"), exports);
/**
 * Obtém todos os serviços detectados
 */
async function getServices() {
    return (0, service_detector_js_1.detectServices)();
}
/**
 * Obtém um serviço pelo ID
 */
async function getServiceById(id) {
    return (0, service_detector_js_1.getServiceById)(id);
}
/**
 * Inicia um serviço
 */
async function startService(id, options) {
    return (0, process_control_js_1.startServiceProcess)(id, options);
}
/**
 * Para um serviço
 */
async function stopService(id, options) {
    return (0, process_control_js_1.stopServiceProcess)(id, options);
}
/**
 * Reinicia um serviço
 */
async function restartService(id, options) {
    return (0, process_control_js_1.restartServiceProcess)(id, options);
}
/**
 * Obtém logs de um serviço
 */
async function getServiceLogs(id, options) {
    return (0, log_reader_js_1.readServiceLogs)(id, options);
}
//# sourceMappingURL=index.js.map