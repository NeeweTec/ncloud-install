"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createServer = createServer;
exports.startServer = startServer;
exports.stopServer = stopServer;
exports.getServer = getServer;
const fastify_1 = __importDefault(require("fastify"));
const cors_1 = __importDefault(require("@fastify/cors"));
const helmet_1 = __importDefault(require("@fastify/helmet"));
const logger_js_1 = require("../utils/logger.js");
const index_js_1 = require("../config/index.js");
const auth_js_1 = require("./middleware/auth.js");
const logger_js_2 = require("./middleware/logger.js");
// Routes
const health_js_1 = require("./routes/health.js");
const info_js_1 = require("./routes/info.js");
const environments_js_1 = require("./routes/environments.js");
const services_js_1 = require("./routes/services.js");
const files_js_1 = require("./routes/files.js");
const metrics_js_1 = require("./routes/metrics.js");
let server = null;
/**
 * Cria e configura a instância do servidor Fastify
 */
async function createServer() {
    const config = (0, index_js_1.getConfig)();
    const logger = (0, logger_js_1.getLogger)();
    const app = (0, fastify_1.default)({
        logger: false, // Usamos Winston
        trustProxy: true,
        bodyLimit: 10 * 1024 * 1024, // 10MB
    });
    // CORS
    if (config.server.cors.enabled) {
        await app.register(cors_1.default, {
            origin: config.server.cors.origins,
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
            credentials: true,
        });
    }
    // Helmet (security headers)
    await app.register(helmet_1.default, {
        contentSecurityPolicy: false, // Desabilitar para API
    });
    // Request logging middleware
    app.addHook('onRequest', logger_js_2.requestLoggerMiddleware);
    // Auth middleware (exceto /health)
    app.addHook('preHandler', auth_js_1.authMiddleware);
    // Error handler global
    app.setErrorHandler((error, request, reply) => {
        logger.error('Request error', {
            error: error.message,
            stack: error.stack,
            url: request.url,
            method: request.method,
        });
        const statusCode = error.statusCode || 500;
        reply.status(statusCode).send({
            error: error.name || 'Internal Server Error',
            message: error.message,
            statusCode,
        });
    });
    // Registrar rotas
    await app.register(health_js_1.healthRoutes, { prefix: '' });
    await app.register(info_js_1.infoRoutes, { prefix: '' });
    await app.register(environments_js_1.environmentsRoutes, { prefix: '/environments' });
    await app.register(services_js_1.servicesRoutes, { prefix: '/services' });
    await app.register(files_js_1.filesRoutes, { prefix: '/files' });
    await app.register(metrics_js_1.metricsRoutes, { prefix: '' });
    // 404 handler
    app.setNotFoundHandler((request, reply) => {
        reply.status(404).send({
            error: 'Not Found',
            message: `Route ${request.method} ${request.url} not found`,
            statusCode: 404,
        });
    });
    server = app;
    return app;
}
/**
 * Inicia o servidor
 */
async function startServer() {
    const config = (0, index_js_1.getConfig)();
    const logger = (0, logger_js_1.getLogger)();
    if (!server) {
        server = await createServer();
    }
    try {
        await server.listen({
            port: config.server.port,
            host: config.server.host,
        });
        logger.info(`🚀 Ncloud Agent running on http://${config.server.host}:${config.server.port}`);
    }
    catch (error) {
        logger.error('Failed to start server', { error });
        throw error;
    }
}
/**
 * Para o servidor
 */
async function stopServer() {
    const logger = (0, logger_js_1.getLogger)();
    if (server) {
        try {
            await server.close();
            logger.info('Server stopped');
            server = null;
        }
        catch (error) {
            logger.error('Error stopping server', { error });
            throw error;
        }
    }
}
/**
 * Obtém a instância do servidor
 */
function getServer() {
    return server;
}
//# sourceMappingURL=server.js.map