import { CpuMetrics } from './cpu.js';
import { MemoryMetrics } from './memory.js';
import { DiskMetrics } from './disk.js';
export * from './cpu.js';
export * from './memory.js';
export * from './disk.js';
/**
 * Interface de rede
 */
export interface NetworkInterface {
    name: string;
    bytesReceived?: number;
    bytesSent?: number;
    address?: string;
    family?: string;
}
/**
 * Métricas completas do sistema
 */
export interface SystemMetrics {
    timestamp: string;
    system: {
        hostname: string;
        uptime: number;
        loadAverage: number[];
        platform: string;
        arch: string;
    };
    cpu: CpuMetrics;
    memory: MemoryMetrics;
    disk: DiskMetrics;
    network: {
        interfaces: NetworkInterface[];
    };
    processes: {
        total: number;
        protheusRelated: number;
    };
}
/**
 * Coleta todas as métricas do sistema
 */
export declare function collectMetrics(): Promise<SystemMetrics>;
/**
 * Obtém métricas com cache
 */
export declare function getMetrics(): Promise<SystemMetrics>;
export declare function startMetricsCollection(intervalMs?: number): void;
/**
 * Para coleta periódica de métricas
 */
export declare function stopMetricsCollection(): void;
//# sourceMappingURL=index.d.ts.map