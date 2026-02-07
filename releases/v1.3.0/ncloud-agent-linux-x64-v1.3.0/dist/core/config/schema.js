"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.configSchema = exports.metricsConfigSchema = exports.loggingConfigSchema = exports.protheusConfigSchema = exports.serviceConfigSchema = exports.authConfigSchema = exports.serverConfigSchema = exports.corsConfigSchema = void 0;
const zod_1 = require("zod");
/**
 * Schema de validação para configuração de CORS
 */
exports.corsConfigSchema = zod_1.z.object({
    enabled: zod_1.z.boolean().default(true),
    origins: zod_1.z.array(zod_1.z.string()).default(['*']),
});
/**
 * Schema de validação para configuração do servidor
 */
exports.serverConfigSchema = zod_1.z.object({
    port: zod_1.z.number().min(1).max(65535).default(3100),
    host: zod_1.z.string().default('0.0.0.0'),
    cors: exports.corsConfigSchema.default({}),
});
/**
 * Schema de validação para autenticação
 */
exports.authConfigSchema = zod_1.z.object({
    token: zod_1.z.string().min(32, 'Token deve ter pelo menos 32 caracteres'),
    tokenHash: zod_1.z.string().optional(),
});
/**
 * Schema de validação para configuração de serviços Protheus
 */
exports.serviceConfigSchema = zod_1.z.object({
    name: zod_1.z.string(),
    defaultPort: zod_1.z.number(),
    binaryName: zod_1.z.string(),
    binaryNameWindows: zod_1.z.string(),
});
/**
 * Schema de validação para configuração do Protheus
 */
exports.protheusConfigSchema = zod_1.z.object({
    scanPaths: zod_1.z.array(zod_1.z.string()).min(1),
    iniPatterns: zod_1.z.array(zod_1.z.string()).default(['appserver.ini', 'dbaccess.ini']),
});
/**
 * Schema de validação para logging
 */
exports.loggingConfigSchema = zod_1.z.object({
    level: zod_1.z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    file: zod_1.z.string().optional(),
    maxSize: zod_1.z.string().default('10m'),
    maxFiles: zod_1.z.number().default(5),
});
/**
 * Schema de validação para métricas
 */
exports.metricsConfigSchema = zod_1.z.object({
    enabled: zod_1.z.boolean().default(true),
    interval: zod_1.z.number().default(30000),
});
/**
 * Schema principal de configuração do agente
 */
exports.configSchema = zod_1.z.object({
    server: exports.serverConfigSchema.default({}),
    auth: exports.authConfigSchema,
    protheus: exports.protheusConfigSchema,
    services: zod_1.z.object({
        license: exports.serviceConfigSchema.default({
            name: 'License Server',
            defaultPort: 5555,
            binaryName: 'appsrvlinux',
            binaryNameWindows: 'appserver.exe',
        }),
        dbaccess: exports.serviceConfigSchema.default({
            name: 'DbAccess',
            defaultPort: 7890,
            binaryName: 'dbaccess64',
            binaryNameWindows: 'dbaccess64.exe',
        }),
        appserver: exports.serviceConfigSchema.default({
            name: 'AppServer',
            defaultPort: 1234,
            binaryName: 'appsrvlinux',
            binaryNameWindows: 'appserver.exe',
        }),
    }).default({}),
    logging: exports.loggingConfigSchema.default({}),
    metrics: exports.metricsConfigSchema.default({}),
});
//# sourceMappingURL=schema.js.map