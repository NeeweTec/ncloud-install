/**
 * Métricas de CPU
 */
export interface CpuMetrics {
    cores: number;
    model: string;
    speed: number;
    usagePercent: number;
    perCore: number[];
    loadAverage: number[];
}
/**
 * Coleta métricas de CPU
 */
export declare function collectCpuMetrics(): Promise<CpuMetrics>;
/**
 * Obtém informações detalhadas de CPU
 */
export declare function getCpuInfo(): {
    manufacturer: string;
    brand: string;
    cores: number;
    physicalCores: number;
    speedMHz: number;
};
//# sourceMappingURL=cpu.d.ts.map