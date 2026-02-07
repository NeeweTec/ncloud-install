/**
 * Resultado da verificação de porta
 */
export interface PortCheckResult {
    port: number;
    host: string;
    available: boolean;
    responseTime?: number;
    error?: string;
}
/**
 * Verifica se uma porta está disponível (não em uso)
 */
export declare function isPortAvailable(port: number, host?: string): Promise<boolean>;
/**
 * Verifica se uma porta está em uso e respondendo
 */
export declare function checkPort(port: number, host?: string, timeout?: number): Promise<PortCheckResult>;
/**
 * Verifica múltiplas portas
 */
export declare function checkPorts(ports: Array<{
    port: number;
    host?: string;
}>, timeout?: number): Promise<PortCheckResult[]>;
/**
 * Encontra uma porta disponível em um range
 */
export declare function findAvailablePort(startPort: number, endPort?: number, host?: string): Promise<number | null>;
/**
 * Aguarda uma porta ficar disponível (serviço parar)
 */
export declare function waitForPortAvailable(port: number, host?: string, timeout?: number, checkInterval?: number): Promise<boolean>;
/**
 * Aguarda uma porta ficar em uso (serviço iniciar)
 */
export declare function waitForPortInUse(port: number, host?: string, timeout?: number, checkInterval?: number): Promise<boolean>;
/**
 * Obtém informações sobre qual processo está usando uma porta
 */
export declare function getProcessUsingPort(port: number): Promise<{
    pid?: number;
    processName?: string;
} | null>;
//# sourceMappingURL=port-checker.d.ts.map