/**
 * Informações de partição/disco
 */
export interface DiskPartition {
    mount: string;
    device: string;
    fsType?: string;
    totalBytes: number;
    usedBytes: number;
    freeBytes: number;
    usagePercent: number;
}
/**
 * Métricas de disco
 */
export interface DiskMetrics {
    partitions: DiskPartition[];
    totalBytes: number;
    usedBytes: number;
    freeBytes: number;
}
/**
 * Coleta métricas de disco
 */
export declare function collectDiskMetrics(): Promise<DiskMetrics>;
/**
 * Obtém uso de disco de um diretório específico
 */
export declare function getDirectoryUsage(dirPath: string): Promise<{
    path: string;
    sizeBytes: number;
    fileCount: number;
} | null>;
//# sourceMappingURL=disk.d.ts.map