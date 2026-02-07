/**
 * Métricas de memória
 */
export interface MemoryMetrics {
    totalBytes: number;
    usedBytes: number;
    freeBytes: number;
    usagePercent: number;
    cached?: number;
    buffers?: number;
    available?: number;
    swap?: {
        totalBytes: number;
        usedBytes: number;
        freeBytes: number;
        usagePercent: number;
    };
}
/**
 * Coleta métricas de memória
 */
export declare function collectMemoryMetrics(): Promise<MemoryMetrics>;
/**
 * Obtém uso de memória de um processo específico
 */
export declare function getProcessMemoryUsage(pid: number): Promise<{
    rss: number;
    heapTotal?: number;
    heapUsed?: number;
    external?: number;
} | null>;
//# sourceMappingURL=memory.d.ts.map