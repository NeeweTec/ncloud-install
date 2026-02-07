"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.healthRoutes = healthRoutes;
const startTime = Date.now();
const VERSION = '1.0.0';
/**
 * Rotas de health check
 */
async function healthRoutes(fastify, _opts) {
    /**
     * GET /health
     * Health check do agente - não requer autenticação
     */
    fastify.get('/health', {
        schema: {
            description: 'Health check do agente',
            tags: ['Health'],
            response: {
                200: {
                    type: 'object',
                    properties: {
                        status: { type: 'string' },
                        version: { type: 'string' },
                        uptime: { type: 'number' },
                        timestamp: { type: 'string' },
                    },
                },
            },
        },
    }, async (_request, _reply) => {
        const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);
        return {
            status: 'ok',
            version: VERSION,
            uptime: uptimeSeconds,
            timestamp: new Date().toISOString(),
        };
    });
}
//# sourceMappingURL=health.js.map