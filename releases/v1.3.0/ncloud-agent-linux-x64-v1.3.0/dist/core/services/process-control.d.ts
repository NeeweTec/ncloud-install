/**
 * Resultado de operação de serviço
 */
export interface ServiceOperationResult {
    success: boolean;
    service: string;
    previousStatus?: string;
    currentStatus?: string;
    pid?: number;
    port?: number;
    error?: string;
    startupTime?: number;
    shutdownTime?: number;
    stopTime?: number;
    startTime?: number;
    totalTime?: number;
}
/**
 * Opções para iniciar serviço
 */
export interface StartServiceOptions {
    timeout?: number;
    waitForPort?: boolean;
}
/**
 * Opções para parar serviço
 */
export interface StopServiceOptions {
    timeout?: number;
    force?: boolean;
}
/**
 * Inicia um serviço
 */
export declare function startServiceProcess(serviceId: string, options?: StartServiceOptions): Promise<ServiceOperationResult>;
/**
 * Para um serviço
 */
export declare function stopServiceProcess(serviceId: string, options?: StopServiceOptions): Promise<ServiceOperationResult>;
/**
 * Reinicia um serviço
 */
export declare function restartServiceProcess(serviceId: string, options?: StopServiceOptions & StartServiceOptions): Promise<ServiceOperationResult>;
//# sourceMappingURL=process-control.d.ts.map