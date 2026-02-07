import { AgentConfig } from './schema.js';
/**
 * Determina o diretório de configuração baseado no SO
 */
export declare function getConfigDir(): string;
/**
 * Determina o diretório de logs baseado no SO
 */
export declare function getLogDir(): string;
/**
 * Caminhos padrão para scan do Protheus baseado no SO
 */
export declare function getDefaultScanPaths(): string[];
/**
 * Configuração padrão do agente
 */
export declare const defaultConfig: Partial<AgentConfig>;
/**
 * Informações do sistema
 */
export declare const systemInfo: {
    hostname: string;
    platform: NodeJS.Platform;
    arch: NodeJS.Architecture;
    osType: string;
    osRelease: string;
    cpus: number;
    totalMemory: number;
    nodeVersion: string;
};
//# sourceMappingURL=defaults.d.ts.map