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
exports.invalidateInstanceCache = exports.getInstanceByName = exports.getInstanceById = exports.detectInstances = exports.getEnvironment = exports.getEnvironmentByName = exports.getEnvironmentById = exports.scanEnvironments = void 0;
__exportStar(require("./ini-parser.js"), exports);
var environment_detector_js_1 = require("./environment-detector.js");
Object.defineProperty(exports, "scanEnvironments", { enumerable: true, get: function () { return environment_detector_js_1.scanEnvironments; } });
Object.defineProperty(exports, "getEnvironmentById", { enumerable: true, get: function () { return environment_detector_js_1.getEnvironmentById; } });
Object.defineProperty(exports, "getEnvironmentByName", { enumerable: true, get: function () { return environment_detector_js_1.getEnvironmentByName; } });
Object.defineProperty(exports, "getEnvironment", { enumerable: true, get: function () { return environment_detector_js_1.getEnvironment; } });
var instance_detector_js_1 = require("./instance-detector.js");
Object.defineProperty(exports, "detectInstances", { enumerable: true, get: function () { return instance_detector_js_1.detectInstances; } });
Object.defineProperty(exports, "getInstanceById", { enumerable: true, get: function () { return instance_detector_js_1.getInstanceById; } });
Object.defineProperty(exports, "getInstanceByName", { enumerable: true, get: function () { return instance_detector_js_1.getInstanceByName; } });
Object.defineProperty(exports, "invalidateInstanceCache", { enumerable: true, get: function () { return instance_detector_js_1.invalidateInstanceCache; } });
//# sourceMappingURL=index.js.map