/**
 * Informações do RPO
 */
export interface RpoInfo {
    path: string;
    version: string;
    language: string;
    sizeBytes: number;
    modifiedAt: string;
    hashSha256?: string;
}
/**
 * Ambiente Protheus detectado
 */
export interface ProtheusEnvironment {
    name: string;
    displayName: string;
    iniPath: string;
    iniSection: string;
    sourcePath: string;
    rootPath: string;
    startProgram: string;
    tcpPort?: number;
    httpPort?: number;
    httpEnabled: boolean;
    rpoInfo?: RpoInfo;
    database?: {
        type?: string;
        server?: string;
        port?: number;
        name?: string;
        dbAccessPort?: number;
    };
    license?: {
        server?: string;
        port?: number;
    };
    binaryPath?: string;
    status: 'active' | 'inactive' | 'unknown';
    fullConfig?: Record<string, Record<string, string>>;
}
/**
 * Escaneia os diretórios configurados em busca de ambientes Protheus
 */
export declare function scanEnvironments(forceRefresh?: boolean): Promise<ProtheusEnvironment[]>;
/**
 * Obtém um ambiente pelo nome
 */
export declare function getEnvironmentByName(name: string): Promise<ProtheusEnvironment | null>;
/**
 * Invalida o cache de ambientes
 */
export declare function invalidateCache(): void;
//# sourceMappingURL=environment-detector.d.ts.map