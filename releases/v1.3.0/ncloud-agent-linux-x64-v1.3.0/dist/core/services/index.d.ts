import { DetectedService } from '../scanner/service-detector.js';
import { ServiceOperationResult, StartServiceOptions, StopServiceOptions } from './process-control.js';
import { LogReadOptions, LogResult } from './log-reader.js';
export * from './process-control.js';
export * from './log-reader.js';
export * from './port-checker.js';
/**
 * Obtém todos os serviços detectados
 */
export declare function getServices(): Promise<DetectedService[]>;
/**
 * Obtém um serviço pelo ID
 */
export declare function getServiceById(id: string): Promise<DetectedService | null>;
/**
 * Inicia um serviço
 */
export declare function startService(id: string, options?: StartServiceOptions): Promise<ServiceOperationResult>;
/**
 * Para um serviço
 */
export declare function stopService(id: string, options?: StopServiceOptions): Promise<ServiceOperationResult>;
/**
 * Reinicia um serviço
 */
export declare function restartService(id: string, options?: StartServiceOptions & StopServiceOptions): Promise<ServiceOperationResult>;
/**
 * Obtém logs de um serviço
 */
export declare function getServiceLogs(id: string, options?: LogReadOptions): Promise<LogResult | null>;
//# sourceMappingURL=index.d.ts.map