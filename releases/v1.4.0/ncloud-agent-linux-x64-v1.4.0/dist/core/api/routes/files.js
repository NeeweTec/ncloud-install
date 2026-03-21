"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.filesRoutes = filesRoutes;
const index_js_1 = require("../../scanner/index.js");
const logger_js_1 = require("../../utils/logger.js");
const paths_js_1 = require("../../utils/paths.js");
const index_js_2 = require("../../config/index.js");
const node_path_1 = __importDefault(require("node:path"));
/**
 * Rotas de arquivos
 */
async function filesRoutes(fastify, _opts) {
    const logger = (0, logger_js_1.getLogger)();
    /**
     * GET /files
     * Lista arquivos gerenciados
     */
    fastify.get('/', async (request, _reply) => {
        const { type, environment } = request.query;
        logger.info('Listing files', { type, environment });
        const config = (0, index_js_2.getConfig)();
        const files = [];
        // Scan para encontrar arquivos
        const environments = await (0, index_js_1.scanEnvironments)();
        for (const env of environments) {
            // Filtrar por ambiente se especificado
            if (environment && env.name !== environment) {
                continue;
            }
            // Arquivos RPO
            if (!type || type === 'rpo') {
                const rpoPattern = /\.rpo$/i;
                const rpoFiles = (0, paths_js_1.findFiles)(node_path_1.default.dirname(env.sourcePath), rpoPattern, 3);
                for (const rpoPath of rpoFiles) {
                    const info = (0, paths_js_1.getFileInfo)(rpoPath);
                    if (info) {
                        files.push({
                            path: rpoPath,
                            name: info.name,
                            type: 'rpo',
                            environment: env.name,
                            sizeBytes: info.size,
                            modifiedAt: info.modifiedAt.toISOString(),
                            permissions: info.permissions,
                        });
                    }
                }
            }
            // Arquivos INI
            if (!type || type === 'ini') {
                const info = (0, paths_js_1.getFileInfo)(env.iniPath);
                if (info) {
                    files.push({
                        path: env.iniPath,
                        name: info.name,
                        type: 'ini',
                        environment: env.name,
                        sizeBytes: info.size,
                        modifiedAt: info.modifiedAt.toISOString(),
                        permissions: info.permissions,
                    });
                }
            }
        }
        // Arquivos de log
        if (!type || type === 'log') {
            for (const scanPath of config.protheus.scanPaths) {
                const logPattern = /\.(log|txt)$/i;
                const logFiles = (0, paths_js_1.findFiles)(scanPath, logPattern, 5);
                // Limitar a 50 logs mais recentes
                const recentLogs = logFiles
                    .map(logPath => ({ path: logPath, info: (0, paths_js_1.getFileInfo)(logPath) }))
                    .filter(item => item.info !== null)
                    .sort((a, b) => (b.info.modifiedAt.getTime() - a.info.modifiedAt.getTime()))
                    .slice(0, 50);
                for (const { path: logPath, info } of recentLogs) {
                    if (info) {
                        files.push({
                            path: logPath,
                            name: info.name,
                            type: 'log',
                            sizeBytes: info.size,
                            modifiedAt: info.modifiedAt.toISOString(),
                            permissions: info.permissions,
                        });
                    }
                }
            }
        }
        // Summary
        const summary = {
            total: files.length,
            byType: {
                rpo: files.filter(f => f.type === 'rpo').length,
                ini: files.filter(f => f.type === 'ini').length,
                log: files.filter(f => f.type === 'log').length,
                binary: files.filter(f => f.type === 'binary').length,
            },
        };
        return {
            files,
            summary,
        };
    });
}
//# sourceMappingURL=files.js.map