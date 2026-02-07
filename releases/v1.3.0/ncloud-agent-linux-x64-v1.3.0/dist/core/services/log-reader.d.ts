/**
 * Opções para leitura de logs
 */
export interface LogReadOptions {
    lines?: number;
    filter?: string;
    level?: 'ERROR' | 'WARN' | 'INFO';
}
/**
 * Linha de log parseada
 */
export interface LogLine {
    timestamp?: string;
    level?: string;
    message: string;
    raw: string;
}
/**
 * Resultado da leitura de logs
 */
export interface LogResult {
    service: string;
    logPath: string;
    lines: LogLine[];
    totalLines: number;
    logSizeBytes: number;
    lastModified: string;
}
/**
 * Lê logs de um serviço
 */
export declare function readServiceLogs(serviceId: string, options?: LogReadOptions): Promise<LogResult | null>;
/**
 * Stream de logs em tempo real (para futuro WebSocket)
 */
export declare function streamLogs(logPath: string, abortSignal?: AbortSignal): AsyncGenerator<LogLine>;
//# sourceMappingURL=log-reader.d.ts.map