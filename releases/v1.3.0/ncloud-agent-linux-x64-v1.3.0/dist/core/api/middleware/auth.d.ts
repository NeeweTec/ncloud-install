import { FastifyRequest, FastifyReply } from 'fastify';
/**
 * Middleware de autenticação via Bearer Token
 */
export declare function authMiddleware(request: FastifyRequest, reply: FastifyReply): Promise<void>;
/**
 * Verifica se um token é válido
 */
export declare function isValidToken(token: string): boolean;
//# sourceMappingURL=auth.d.ts.map