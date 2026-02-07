/**
 * Tipos de serviço Protheus
 */
export type ServiceType = 'LICENSE_SERVER' | 'DBACCESS' | 'APPSERVER';
/**
 * Status do serviço
 */
export type ServiceStatus = 'running' | 'stopped' | 'starting' | 'stopping' | 'unknown';
/**
 * Métricas do serviço
 */
export interface ServiceMetrics {
    cpuPercent: number;
    memoryBytes: number;
    memoryPercent: number;
    activeThreads?: number;
    activeConnections?: number;
    maxConnections?: number;
}
/**
 * Informação de serviço detectado
 */
export interface DetectedService {
    id: string;
    type: ServiceType;
    name: string;
    status: ServiceStatus;
    port?: number;
    pid?: number;
    environment?: string;
    binaryPath: string;
    configPath: string;
    uptimeSince?: string;
    uptimeSeconds?: number;
    metrics?: ServiceMetrics;
    logPath?: string;
    logSizeBytes?: number;
    commandLine?: string;
    workingDirectory?: string;
}
/**
 * Detecta todos os serviços Protheus
 */
export declare function detectServices(forceRefresh?: boolean): Promise<DetectedService[]>;
/**
 * Obtém serviço por ID
 * Busca flexível: tenta ID exato, depois name, depois environment/porta
 */
export declare function getServiceById(id: string): Promise<DetectedService | null>;
/**
 * Invalida cache de serviços
 */
export declare function invalidateServiceCache(): void;
//# sourceMappingURL=service-detector.d.ts.map