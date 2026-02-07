export * from './logger.js';
export * from './crypto.js';
export * from './paths.js';
/**
 * Aguarda um tempo em milissegundos
 */
export declare function sleep(ms: number): Promise<void>;
/**
 * Retry com backoff exponencial
 */
export declare function retry<T>(fn: () => Promise<T>, options?: {
    maxRetries?: number;
    initialDelay?: number;
    maxDelay?: number;
    factor?: number;
}): Promise<T>;
/**
 * Formata bytes para string legível
 */
export declare function formatBytes(bytes: number): string;
/**
 * Formata duração em milissegundos para string legível
 */
export declare function formatDuration(ms: number): string;
/**
 * Valida se uma string é um endereço IP válido
 */
export declare function isValidIP(ip: string): boolean;
/**
 * Valida se uma porta é válida
 */
export declare function isValidPort(port: number): boolean;
/**
 * Debounce de função
 */
export declare function debounce<T extends (...args: unknown[]) => unknown>(fn: T, delay: number): (...args: Parameters<T>) => void;
/**
 * Throttle de função
 */
export declare function throttle<T extends (...args: unknown[]) => unknown>(fn: T, limit: number): (...args: Parameters<T>) => void;
//# sourceMappingURL=index.d.ts.map