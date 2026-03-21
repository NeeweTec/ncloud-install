"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.servicesRoutes = servicesRoutes;
const index_js_1 = require("../../services/index.js");
const logger_js_1 = require("../../utils/logger.js");
/**
 * Rotas de serviços Protheus
 */
async function servicesRoutes(fastify, _opts) {
    const logger = (0, logger_js_1.getLogger)();
    /**
     * GET /services
     * Lista todos os serviços Protheus
     */
    fastify.get('/', async (_request, _reply) => {
        logger.info('Listing services');
        const services = await (0, index_js_1.getServices)();
        const summary = {
            total: services.length,
            running: services.filter(s => s.status === 'running').length,
            stopped: services.filter(s => s.status === 'stopped').length,
        };
        return {
            services,
            summary,
        };
    });
    /**
     * GET /services/:id
     * Detalhes de um serviço específico
     */
    fastify.get('/:id', async (request, reply) => {
        const { id } = request.params;
        const service = await (0, index_js_1.getServiceById)(id);
        if (!service) {
            return reply.status(404).send({
                error: 'Not Found',
                message: `Serviço '${id}' não encontrado`,
                statusCode: 404,
            });
        }
        return service;
    });
    /**
     * POST /services/:id/start
     * Inicia um serviço
     */
    fastify.post('/:id/start', async (request, reply) => {
        const { id } = request.params;
        const { timeout = 60, waitForPort = true } = request.body || {};
        logger.info('Starting service', { id, timeout, waitForPort });
        try {
            const result = await (0, index_js_1.startService)(id, { timeout, waitForPort });
            if (!result.success) {
                return reply.status(400).send({
                    success: false,
                    error: result.error,
                    service: id,
                    currentStatus: result.currentStatus,
                });
            }
            return result;
        }
        catch (error) {
            logger.error('Error starting service', { error, id });
            return reply.status(500).send({
                success: false,
                error: error.message,
                service: id,
            });
        }
    });
    /**
     * POST /services/:id/stop
     * Para um serviço
     */
    fastify.post('/:id/stop', async (request, reply) => {
        const { id } = request.params;
        const { timeout = 30, force = false } = request.body || {};
        logger.info('Stopping service', { id, timeout, force });
        try {
            const result = await (0, index_js_1.stopService)(id, { timeout, force });
            if (!result.success) {
                return reply.status(400).send({
                    success: false,
                    error: result.error,
                    service: id,
                    currentStatus: result.currentStatus,
                });
            }
            return result;
        }
        catch (error) {
            logger.error('Error stopping service', { error, id });
            return reply.status(500).send({
                success: false,
                error: error.message,
                service: id,
            });
        }
    });
    /**
     * POST /services/:id/restart
     * Reinicia um serviço
     */
    fastify.post('/:id/restart', async (request, reply) => {
        const { id } = request.params;
        const { timeout = 60, force = false } = request.body || {};
        logger.info('Restarting service', { id, timeout, force });
        try {
            const result = await (0, index_js_1.restartService)(id, { timeout, force });
            if (!result.success) {
                return reply.status(400).send({
                    success: false,
                    error: result.error,
                    service: id,
                });
            }
            return result;
        }
        catch (error) {
            logger.error('Error restarting service', { error, id });
            return reply.status(500).send({
                success: false,
                error: error.message,
                service: id,
            });
        }
    });
    /**
     * GET /services/:id/logs
     * Retorna as últimas linhas do log
     */
    fastify.get('/:id/logs', async (request, reply) => {
        const { id } = request.params;
        const { lines = 100, filter, level } = request.query;
        logger.debug('Getting service logs', { id, lines, filter, level });
        try {
            const result = await (0, index_js_1.getServiceLogs)(id, { lines, filter, level });
            if (!result) {
                return reply.status(404).send({
                    error: 'Not Found',
                    message: `Serviço '${id}' não encontrado ou logs indisponíveis`,
                    statusCode: 404,
                });
            }
            return result;
        }
        catch (error) {
            logger.error('Error getting service logs', { error, id });
            return reply.status(500).send({
                error: 'Internal Server Error',
                message: 'Erro ao obter logs do serviço',
                statusCode: 500,
            });
        }
    });
}
//# sourceMappingURL=services.js.map