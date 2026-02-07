import winston from 'winston';
/**
 * Cria instância do logger
 */
export declare function createLogger(options?: {
    level?: string;
    logFile?: string;
}): winston.Logger;
/**
 * Obtém o logger global
 */
export declare function getLogger(): winston.Logger;
/**
 * Inicializa o logger global com configurações
 */
export declare function initLogger(options?: {
    level?: string;
    logFile?: string;
}): winston.Logger;
export declare const logger: winston.Logger;
//# sourceMappingURL=logger.d.ts.map