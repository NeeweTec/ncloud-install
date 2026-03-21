"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = authMiddleware;
exports.isValidToken = isValidToken;
const index_js_1 = require("../../config/index.js");
const logger_js_1 = require("../../utils/logger.js");
const crypto_js_1 = require("../../utils/crypto.js");
// Rotas que não precisam de autenticação
const PUBLIC_ROUTES = ['/health', '/health/'];
/**
 * Middleware de autenticação via Bearer Token
 */
async function authMiddleware(request, reply) {
    const logger = (0, logger_js_1.getLogger)();
    const url = request.url.split('?')[0]; // Remove query string
    // Verifica se é rota pública
    if (PUBLIC_ROUTES.includes(url)) {
        return;
    }
    const authHeader = request.headers.authorization;
    if (!authHeader) {
        logger.warn('Unauthorized request - no auth header', {
            ip: request.ip,
            url: request.url,
        });
        return reply.status(401).send({
            error: 'Unauthorized',
            message: 'Token de autenticação não fornecido',
            statusCode: 401,
        });
    }
    // Extrai o token do header "Bearer <token>"
    const [type, token] = authHeader.split(' ');
    if (type !== 'Bearer' || !token) {
        logger.warn('Unauthorized request - invalid auth format', {
            ip: request.ip,
            url: request.url,
        });
        return reply.status(401).send({
            error: 'Unauthorized',
            message: 'Formato de autenticação inválido. Use: Bearer <token>',
            statusCode: 401,
        });
    }
    // Valida o token
    const config = (0, index_js_1.getConfig)();
    const tokenHash = (0, index_js_1.hashToken)(token);
    const storedHash = config.auth.tokenHash || (0, index_js_1.hashToken)(config.auth.token);
    // Em dev, também aceita comparação direta do token
    const isDev = process.env.NODE_ENV !== 'production';
    const directMatch = isDev && token === config.auth.token;
    if (!directMatch && !(0, crypto_js_1.secureCompare)(tokenHash, storedHash)) {
        logger.warn('Unauthorized request - invalid token', {
            ip: request.ip,
            url: request.url,
        });
        return reply.status(401).send({
            error: 'Unauthorized',
            message: 'Token inválido',
            statusCode: 401,
        });
    }
    // Token válido - continua
    logger.debug('Request authenticated', {
        ip: request.ip,
        url: request.url,
    });
}
/**
 * Verifica se um token é válido
 */
function isValidToken(token) {
    const config = (0, index_js_1.getConfig)();
    const tokenHash = (0, index_js_1.hashToken)(token);
    const storedHash = config.auth.tokenHash || (0, index_js_1.hashToken)(config.auth.token);
    return (0, crypto_js_1.secureCompare)(tokenHash, storedHash);
}
//# sourceMappingURL=auth.js.map