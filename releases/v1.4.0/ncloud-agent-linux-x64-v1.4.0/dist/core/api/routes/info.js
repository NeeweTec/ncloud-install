"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.infoRoutes = infoRoutes;
const node_os_1 = __importDefault(require("node:os"));
const index_js_1 = require("../../config/index.js");
const VERSION = '1.0.0';
/**
 * Rotas de informação do servidor
 */
async function infoRoutes(fastify, _opts) {
    /**
     * GET /info
     * Informações detalhadas do servidor
     */
    fastify.get('/info', {
        schema: {
            description: 'Informações do servidor',
            tags: ['Info'],
            security: [{ bearerAuth: [] }],
            response: {
                200: {
                    type: 'object',
                    properties: {
                        hostname: { type: 'string' },
                        platform: { type: 'string' },
                        arch: { type: 'string' },
                        osType: { type: 'string' },
                        osRelease: { type: 'string' },
                        cpus: { type: 'number' },
                        totalMemory: { type: 'number' },
                        freeMemory: { type: 'number' },
                        networkInterfaces: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    name: { type: 'string' },
                                    address: { type: 'string' },
                                    family: { type: 'string' },
                                },
                            },
                        },
                        agentVersion: { type: 'string' },
                        nodeVersion: { type: 'string' },
                        configuredPaths: {
                            type: 'array',
                            items: { type: 'string' },
                        },
                    },
                },
            },
        },
    }, async (_request, _reply) => {
        const config = (0, index_js_1.getConfig)();
        const networkInterfaces = getNetworkInterfaces();
        return {
            hostname: node_os_1.default.hostname(),
            platform: process.platform,
            arch: process.arch,
            osType: node_os_1.default.type(),
            osRelease: node_os_1.default.release(),
            cpus: node_os_1.default.cpus().length,
            totalMemory: node_os_1.default.totalmem(),
            freeMemory: node_os_1.default.freemem(),
            networkInterfaces,
            agentVersion: VERSION,
            nodeVersion: process.version,
            configuredPaths: config.protheus.scanPaths,
        };
    });
}
/**
 * Obtém interfaces de rede ativas
 */
function getNetworkInterfaces() {
    const interfaces = node_os_1.default.networkInterfaces();
    const result = [];
    for (const [name, addrs] of Object.entries(interfaces)) {
        if (!addrs)
            continue;
        for (const addr of addrs) {
            // Ignorar loopback e link-local
            if (!addr.internal && !addr.address.startsWith('fe80::')) {
                result.push({
                    name,
                    address: addr.address,
                    family: addr.family,
                });
            }
        }
    }
    return result;
}
//# sourceMappingURL=info.js.map