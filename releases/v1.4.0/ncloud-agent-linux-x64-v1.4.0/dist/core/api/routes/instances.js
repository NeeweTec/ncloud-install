"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.instancesRoutes = instancesRoutes;
const instance_detector_js_1 = require("../../scanner/instance-detector.js");
const logger_js_1 = require("../../utils/logger.js");
/**
 * Rotas de instâncias Protheus (N2 da hierarquia)
 */
async function instancesRoutes(fastify, _opts) {
    const logger = (0, logger_js_1.getLogger)();
    /**
     * GET /instances
     * Lista todas as instâncias Protheus detectadas
     */
    fastify.get('/', async (request, _reply) => {
        const { refresh } = request.query;
        logger.info('Listing instances', { refresh });
        const startTime = Date.now();
        const instances = await (0, instance_detector_js_1.detectInstances)(refresh);
        const scanDuration = Date.now() - startTime;
        const summary = {
            total: instances.length,
            active: instances.filter(i => i.status === 'active').length,
            inactive: instances.filter(i => i.status === 'inactive').length,
            byType: {
                production: instances.filter(i => i.type === 'PRODUCTION').length,
                development: instances.filter(i => i.type === 'DEVELOPMENT').length,
                testing: instances.filter(i => i.type === 'TESTING').length,
                qa: instances.filter(i => i.type === 'QA').length,
            },
        };
        return {
            instances,
            summary,
            lastScan: new Date().toISOString(),
            scanDuration,
        };
    });
    /**
     * GET /instances/:id
     * Detalhes de uma instância específica
     */
    fastify.get('/:id', async (request, reply) => {
        const { id } = request.params;
        const instance = await (0, instance_detector_js_1.getInstanceById)(id);
        if (!instance) {
            return reply.status(404).send({
                error: 'Not Found',
                message: `Instância '${id}' não encontrada`,
                statusCode: 404,
            });
        }
        return instance;
    });
    /**
     * GET /instances/:id/services
     * Lista serviços de uma instância específica
     */
    fastify.get('/:id/services', async (request, reply) => {
        const { id } = request.params;
        const instance = await (0, instance_detector_js_1.getInstanceById)(id);
        if (!instance) {
            return reply.status(404).send({
                error: 'Not Found',
                message: `Instância '${id}' não encontrada`,
                statusCode: 404,
            });
        }
        const summary = {
            total: instance.services.length,
            running: instance.services.filter(s => s.status === 'running').length,
            stopped: instance.services.filter(s => s.status === 'stopped').length,
        };
        return {
            services: instance.services,
            summary,
        };
    });
    /**
     * GET /instances/:id/environments
     * Lista ambientes/RPOs de uma instância específica
     */
    fastify.get('/:id/environments', async (request, reply) => {
        const { id } = request.params;
        const instance = await (0, instance_detector_js_1.getInstanceById)(id);
        if (!instance) {
            return reply.status(404).send({
                error: 'Not Found',
                message: `Instância '${id}' não encontrada`,
                statusCode: 404,
            });
        }
        return {
            environments: instance.environments,
            total: instance.environments.length,
        };
    });
}
//# sourceMappingURL=instances.js.map