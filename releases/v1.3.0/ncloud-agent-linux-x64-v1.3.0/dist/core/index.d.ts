export * from './config/index.js';
export * from './utils/index.js';
export * from './api/index.js';
export * from './scanner/index.js';
export * from './services/index.js';
export * from './metrics/index.js';
/**
 * Opções de inicialização do agente
 */
export interface AgentOptions {
    configPath?: string;
    logLevel?: 'debug' | 'info' | 'warn' | 'error';
    logFile?: string;
}
/**
 * Inicializa e inicia o agente
 */
export declare function startAgent(options?: AgentOptions): Promise<void>;
/**
 * Para o agente
 */
export declare function stopAgent(): Promise<void>;
/**
 * Verifica se o agente está rodando
 */
export declare function isAgentRunning(): boolean;
/**
 * Obtém versão do agente
 */
export declare function getAgentVersion(): string;
//# sourceMappingURL=index.d.ts.map