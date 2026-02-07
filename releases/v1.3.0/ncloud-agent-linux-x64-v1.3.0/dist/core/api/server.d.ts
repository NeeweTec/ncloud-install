import { FastifyInstance } from 'fastify';
/**
 * Cria e configura a instância do servidor Fastify
 */
export declare function createServer(): Promise<FastifyInstance>;
/**
 * Inicia o servidor
 */
export declare function startServer(): Promise<void>;
/**
 * Para o servidor
 */
export declare function stopServer(): Promise<void>;
/**
 * Obtém a instância do servidor
 */
export declare function getServer(): FastifyInstance | null;
//# sourceMappingURL=server.d.ts.map