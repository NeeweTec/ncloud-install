import { AgentConfig } from './schema.js';
/**
 * Carrega configuração de um arquivo JSON
 */
export declare function loadConfigFromFile(filePath?: string): AgentConfig;
/**
 * Carrega configuração de variáveis de ambiente
 */
export declare function loadConfigFromEnv(): Partial<AgentConfig>;
/**
 * Carrega configuração combinando arquivo e variáveis de ambiente
 */
export declare function loadConfig(filePath?: string): AgentConfig;
/**
 * Retorna a configuração atual
 */
export declare function getConfig(): AgentConfig;
/**
 * Salva configuração em arquivo
 */
export declare function saveConfig(config: AgentConfig, filePath?: string): void;
/**
 * Gera um token seguro
 */
export declare function generateToken(): string;
/**
 * Gera hash SHA-256 do token
 */
export declare function hashToken(token: string): string;
/**
 * Valida um token contra o hash armazenado
 */
export declare function validateToken(token: string, storedHash: string): boolean;
export * from './schema.js';
export * from './defaults.js';
//# sourceMappingURL=index.d.ts.map