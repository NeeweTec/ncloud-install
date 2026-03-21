"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.environmentsRoutes = environmentsRoutes;
const index_js_1 = require("../../scanner/index.js");
const logger_js_1 = require("../../utils/logger.js");
const promises_1 = __importDefault(require("node:fs/promises"));
const paths_js_1 = require("../../utils/paths.js");
/**
 * Rotas de ambientes Protheus
 */
async function environmentsRoutes(fastify, _opts) {
    const logger = (0, logger_js_1.getLogger)();
    /**
     * GET /environments
     * Lista todos os ambientes Protheus detectados
     */
    fastify.get('/', async (request, _reply) => {
        const { refresh } = request.query;
        logger.info('Scanning environments', { refresh });
        const startTime = Date.now();
        const environments = await (0, index_js_1.scanEnvironments)(refresh);
        const scanDuration = Date.now() - startTime;
        return {
            environments,
            lastScan: new Date().toISOString(),
            scanDuration,
        };
    });
    /**
     * GET /environments/:idOrName
     * Detalhes de um ambiente específico (busca por ID ou nome)
     */
    fastify.get('/:idOrName', async (request, reply) => {
        const { idOrName } = request.params;
        const environment = await (0, index_js_1.getEnvironment)(idOrName);
        if (!environment) {
            return reply.status(404).send({
                error: 'Not Found',
                message: `Ambiente '${idOrName}' não encontrado`,
                statusCode: 404,
            });
        }
        return environment;
    });
    /**
     * GET /environments/:idOrName/ini
     * Retorna o conteúdo do arquivo INI
     */
    fastify.get('/:idOrName/ini', async (request, reply) => {
        const { idOrName } = request.params;
        const { format = 'parsed' } = request.query;
        const environment = await (0, index_js_1.getEnvironment)(idOrName);
        if (!environment) {
            return reply.status(404).send({
                error: 'Not Found',
                message: `Ambiente '${idOrName}' não encontrado`,
                statusCode: 404,
            });
        }
        const iniPath = environment.iniPath;
        try {
            const stats = await promises_1.default.stat(iniPath);
            const content = await promises_1.default.readFile(iniPath, 'utf-8');
            if (format === 'raw') {
                return {
                    path: iniPath,
                    content,
                };
            }
            // Parse do INI
            const sections = parseIniContent(content);
            return {
                path: iniPath,
                encoding: 'utf-8',
                sizeBytes: stats.size,
                modifiedAt: stats.mtime.toISOString(),
                sections,
            };
        }
        catch (error) {
            logger.error('Error reading INI file', { error, iniPath });
            return reply.status(500).send({
                error: 'Internal Server Error',
                message: 'Erro ao ler arquivo INI',
                statusCode: 500,
            });
        }
    });
    /**
     * PUT /environments/:idOrName/ini
     * Atualiza o arquivo INI
     */
    fastify.put('/:idOrName/ini', async (request, reply) => {
        const { idOrName } = request.params;
        const { content, createBackup: shouldBackup = true } = request.body;
        const environment = await (0, index_js_1.getEnvironment)(idOrName);
        if (!environment) {
            return reply.status(404).send({
                error: 'Not Found',
                message: `Ambiente '${idOrName}' não encontrado`,
                statusCode: 404,
            });
        }
        const iniPath = environment.iniPath;
        let backupPath = null;
        try {
            // Criar backup se solicitado
            if (shouldBackup) {
                backupPath = (0, paths_js_1.createBackup)(iniPath);
                logger.info('INI backup created', { backupPath });
            }
            // Hash do conteúdo anterior
            const previousContent = await promises_1.default.readFile(iniPath, 'utf-8');
            const previousHash = hashContent(previousContent);
            // Salvar novo conteúdo
            await promises_1.default.writeFile(iniPath, content, 'utf-8');
            const newHash = hashContent(content);
            logger.info('INI file updated', { id: environment.id, name: environment.name, iniPath });
            return {
                success: true,
                path: iniPath,
                backupPath,
                previousHash,
                newHash,
            };
        }
        catch (error) {
            logger.error('Error updating INI file', { error, iniPath });
            return reply.status(500).send({
                error: 'Internal Server Error',
                message: 'Erro ao atualizar arquivo INI',
                statusCode: 500,
            });
        }
    });
}
/**
 * Parse de conteúdo INI para estrutura
 */
function parseIniContent(content) {
    const sections = [];
    let currentSection = null;
    const lines = content.split(/\r?\n/);
    for (const line of lines) {
        const trimmed = line.trim();
        // Ignorar comentários e linhas vazias
        if (!trimmed || trimmed.startsWith(';') || trimmed.startsWith('#')) {
            continue;
        }
        // Nova seção
        const sectionMatch = trimmed.match(/^\[(.+)\]$/);
        if (sectionMatch) {
            if (currentSection) {
                sections.push(currentSection);
            }
            currentSection = { name: sectionMatch[1], keys: [] };
            continue;
        }
        // Key=Value
        const keyValueMatch = trimmed.match(/^([^=]+)=(.*)$/);
        if (keyValueMatch && currentSection) {
            currentSection.keys.push({
                key: keyValueMatch[1].trim(),
                value: keyValueMatch[2].trim(),
            });
        }
    }
    // Adiciona última seção
    if (currentSection) {
        sections.push(currentSection);
    }
    return sections;
}
/**
 * Gera hash simples do conteúdo
 */
function hashContent(content) {
    const { createHash } = require('node:crypto');
    return createHash('sha256').update(content).digest('hex').substring(0, 12);
}
//# sourceMappingURL=environments.js.map