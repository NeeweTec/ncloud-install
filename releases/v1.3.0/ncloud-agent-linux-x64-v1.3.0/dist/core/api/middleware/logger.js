"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestLoggerMiddleware = requestLoggerMiddleware;
const logger_js_1 = require("../../utils/logger.js");
/**
 * Middleware para logging de requests
 */
function requestLoggerMiddleware(request, reply, done) {
    const logger = (0, logger_js_1.getLogger)();
    const startTime = Date.now();
    // Adiciona metadata ao request
    request.startTime = startTime;
    // Log do request
    logger.debug('Incoming request', {
        method: request.method,
        url: request.url,
        ip: request.ip,
        userAgent: request.headers['user-agent'],
    });
    // Hook para log do response
    reply.raw.on('finish', () => {
        const duration = Date.now() - startTime;
        const level = reply.statusCode >= 400 ? 'warn' : 'info';
        logger[level]('Request completed', {
            method: request.method,
            url: request.url,
            statusCode: reply.statusCode,
            duration: `${duration}ms`,
            ip: request.ip,
        });
    });
    done();
}
//# sourceMappingURL=logger.js.map