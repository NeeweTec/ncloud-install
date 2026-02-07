import { FastifyRequest, FastifyReply, HookHandlerDoneFunction } from 'fastify';
/**
 * Middleware para logging de requests
 */
export declare function requestLoggerMiddleware(request: FastifyRequest, reply: FastifyReply, done: HookHandlerDoneFunction): void;
declare module 'fastify' {
    interface FastifyRequest {
        startTime?: number;
    }
}
//# sourceMappingURL=logger.d.ts.map