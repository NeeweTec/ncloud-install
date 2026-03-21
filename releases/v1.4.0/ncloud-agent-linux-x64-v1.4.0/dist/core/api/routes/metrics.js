"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.metricsRoutes = metricsRoutes;
const index_js_1 = require("../../metrics/index.js");
const logger_js_1 = require("../../utils/logger.js");
/**
 * Rotas de métricas
 */
async function metricsRoutes(fastify, _opts) {
    const logger = (0, logger_js_1.getLogger)();
    /**
     * GET /metrics
     * Métricas do servidor
     */
    fastify.get('/metrics', async (_request, _reply) => {
        logger.debug('Collecting metrics');
        const metrics = await (0, index_js_1.collectMetrics)();
        return metrics;
    });
}
//# sourceMappingURL=metrics.js.map