import { z } from 'zod';
/**
 * Schema de validação para configuração de CORS
 */
export declare const corsConfigSchema: z.ZodObject<{
    enabled: z.ZodDefault<z.ZodBoolean>;
    origins: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    enabled: boolean;
    origins: string[];
}, {
    enabled?: boolean | undefined;
    origins?: string[] | undefined;
}>;
/**
 * Schema de validação para configuração do servidor
 */
export declare const serverConfigSchema: z.ZodObject<{
    port: z.ZodDefault<z.ZodNumber>;
    host: z.ZodDefault<z.ZodString>;
    cors: z.ZodDefault<z.ZodObject<{
        enabled: z.ZodDefault<z.ZodBoolean>;
        origins: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        enabled: boolean;
        origins: string[];
    }, {
        enabled?: boolean | undefined;
        origins?: string[] | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    port: number;
    host: string;
    cors: {
        enabled: boolean;
        origins: string[];
    };
}, {
    port?: number | undefined;
    host?: string | undefined;
    cors?: {
        enabled?: boolean | undefined;
        origins?: string[] | undefined;
    } | undefined;
}>;
/**
 * Schema de validação para autenticação
 */
export declare const authConfigSchema: z.ZodObject<{
    token: z.ZodString;
    tokenHash: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    token: string;
    tokenHash?: string | undefined;
}, {
    token: string;
    tokenHash?: string | undefined;
}>;
/**
 * Schema de validação para configuração de serviços Protheus
 */
export declare const serviceConfigSchema: z.ZodObject<{
    name: z.ZodString;
    defaultPort: z.ZodNumber;
    binaryName: z.ZodString;
    binaryNameWindows: z.ZodString;
}, "strip", z.ZodTypeAny, {
    name: string;
    defaultPort: number;
    binaryName: string;
    binaryNameWindows: string;
}, {
    name: string;
    defaultPort: number;
    binaryName: string;
    binaryNameWindows: string;
}>;
/**
 * Schema de validação para configuração do Protheus
 */
export declare const protheusConfigSchema: z.ZodObject<{
    scanPaths: z.ZodArray<z.ZodString, "many">;
    iniPatterns: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    scanPaths: string[];
    iniPatterns: string[];
}, {
    scanPaths: string[];
    iniPatterns?: string[] | undefined;
}>;
/**
 * Schema de validação para logging
 */
export declare const loggingConfigSchema: z.ZodObject<{
    level: z.ZodDefault<z.ZodEnum<["debug", "info", "warn", "error"]>>;
    file: z.ZodOptional<z.ZodString>;
    maxSize: z.ZodDefault<z.ZodString>;
    maxFiles: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    level: "debug" | "info" | "warn" | "error";
    maxSize: string;
    maxFiles: number;
    file?: string | undefined;
}, {
    level?: "debug" | "info" | "warn" | "error" | undefined;
    file?: string | undefined;
    maxSize?: string | undefined;
    maxFiles?: number | undefined;
}>;
/**
 * Schema de validação para métricas
 */
export declare const metricsConfigSchema: z.ZodObject<{
    enabled: z.ZodDefault<z.ZodBoolean>;
    interval: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    enabled: boolean;
    interval: number;
}, {
    enabled?: boolean | undefined;
    interval?: number | undefined;
}>;
/**
 * Schema principal de configuração do agente
 */
export declare const configSchema: z.ZodObject<{
    server: z.ZodDefault<z.ZodObject<{
        port: z.ZodDefault<z.ZodNumber>;
        host: z.ZodDefault<z.ZodString>;
        cors: z.ZodDefault<z.ZodObject<{
            enabled: z.ZodDefault<z.ZodBoolean>;
            origins: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        }, "strip", z.ZodTypeAny, {
            enabled: boolean;
            origins: string[];
        }, {
            enabled?: boolean | undefined;
            origins?: string[] | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        port: number;
        host: string;
        cors: {
            enabled: boolean;
            origins: string[];
        };
    }, {
        port?: number | undefined;
        host?: string | undefined;
        cors?: {
            enabled?: boolean | undefined;
            origins?: string[] | undefined;
        } | undefined;
    }>>;
    auth: z.ZodObject<{
        token: z.ZodString;
        tokenHash: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        token: string;
        tokenHash?: string | undefined;
    }, {
        token: string;
        tokenHash?: string | undefined;
    }>;
    protheus: z.ZodObject<{
        scanPaths: z.ZodArray<z.ZodString, "many">;
        iniPatterns: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        scanPaths: string[];
        iniPatterns: string[];
    }, {
        scanPaths: string[];
        iniPatterns?: string[] | undefined;
    }>;
    services: z.ZodDefault<z.ZodObject<{
        license: z.ZodDefault<z.ZodObject<{
            name: z.ZodString;
            defaultPort: z.ZodNumber;
            binaryName: z.ZodString;
            binaryNameWindows: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            name: string;
            defaultPort: number;
            binaryName: string;
            binaryNameWindows: string;
        }, {
            name: string;
            defaultPort: number;
            binaryName: string;
            binaryNameWindows: string;
        }>>;
        dbaccess: z.ZodDefault<z.ZodObject<{
            name: z.ZodString;
            defaultPort: z.ZodNumber;
            binaryName: z.ZodString;
            binaryNameWindows: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            name: string;
            defaultPort: number;
            binaryName: string;
            binaryNameWindows: string;
        }, {
            name: string;
            defaultPort: number;
            binaryName: string;
            binaryNameWindows: string;
        }>>;
        appserver: z.ZodDefault<z.ZodObject<{
            name: z.ZodString;
            defaultPort: z.ZodNumber;
            binaryName: z.ZodString;
            binaryNameWindows: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            name: string;
            defaultPort: number;
            binaryName: string;
            binaryNameWindows: string;
        }, {
            name: string;
            defaultPort: number;
            binaryName: string;
            binaryNameWindows: string;
        }>>;
    }, "strip", z.ZodTypeAny, {
        license: {
            name: string;
            defaultPort: number;
            binaryName: string;
            binaryNameWindows: string;
        };
        dbaccess: {
            name: string;
            defaultPort: number;
            binaryName: string;
            binaryNameWindows: string;
        };
        appserver: {
            name: string;
            defaultPort: number;
            binaryName: string;
            binaryNameWindows: string;
        };
    }, {
        license?: {
            name: string;
            defaultPort: number;
            binaryName: string;
            binaryNameWindows: string;
        } | undefined;
        dbaccess?: {
            name: string;
            defaultPort: number;
            binaryName: string;
            binaryNameWindows: string;
        } | undefined;
        appserver?: {
            name: string;
            defaultPort: number;
            binaryName: string;
            binaryNameWindows: string;
        } | undefined;
    }>>;
    logging: z.ZodDefault<z.ZodObject<{
        level: z.ZodDefault<z.ZodEnum<["debug", "info", "warn", "error"]>>;
        file: z.ZodOptional<z.ZodString>;
        maxSize: z.ZodDefault<z.ZodString>;
        maxFiles: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        level: "debug" | "info" | "warn" | "error";
        maxSize: string;
        maxFiles: number;
        file?: string | undefined;
    }, {
        level?: "debug" | "info" | "warn" | "error" | undefined;
        file?: string | undefined;
        maxSize?: string | undefined;
        maxFiles?: number | undefined;
    }>>;
    metrics: z.ZodDefault<z.ZodObject<{
        enabled: z.ZodDefault<z.ZodBoolean>;
        interval: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        enabled: boolean;
        interval: number;
    }, {
        enabled?: boolean | undefined;
        interval?: number | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    server: {
        port: number;
        host: string;
        cors: {
            enabled: boolean;
            origins: string[];
        };
    };
    auth: {
        token: string;
        tokenHash?: string | undefined;
    };
    protheus: {
        scanPaths: string[];
        iniPatterns: string[];
    };
    services: {
        license: {
            name: string;
            defaultPort: number;
            binaryName: string;
            binaryNameWindows: string;
        };
        dbaccess: {
            name: string;
            defaultPort: number;
            binaryName: string;
            binaryNameWindows: string;
        };
        appserver: {
            name: string;
            defaultPort: number;
            binaryName: string;
            binaryNameWindows: string;
        };
    };
    logging: {
        level: "debug" | "info" | "warn" | "error";
        maxSize: string;
        maxFiles: number;
        file?: string | undefined;
    };
    metrics: {
        enabled: boolean;
        interval: number;
    };
}, {
    auth: {
        token: string;
        tokenHash?: string | undefined;
    };
    protheus: {
        scanPaths: string[];
        iniPatterns?: string[] | undefined;
    };
    server?: {
        port?: number | undefined;
        host?: string | undefined;
        cors?: {
            enabled?: boolean | undefined;
            origins?: string[] | undefined;
        } | undefined;
    } | undefined;
    services?: {
        license?: {
            name: string;
            defaultPort: number;
            binaryName: string;
            binaryNameWindows: string;
        } | undefined;
        dbaccess?: {
            name: string;
            defaultPort: number;
            binaryName: string;
            binaryNameWindows: string;
        } | undefined;
        appserver?: {
            name: string;
            defaultPort: number;
            binaryName: string;
            binaryNameWindows: string;
        } | undefined;
    } | undefined;
    logging?: {
        level?: "debug" | "info" | "warn" | "error" | undefined;
        file?: string | undefined;
        maxSize?: string | undefined;
        maxFiles?: number | undefined;
    } | undefined;
    metrics?: {
        enabled?: boolean | undefined;
        interval?: number | undefined;
    } | undefined;
}>;
/**
 * Tipo inferido do schema de configuração
 */
export type AgentConfig = z.infer<typeof configSchema>;
export type ServerConfig = z.infer<typeof serverConfigSchema>;
export type AuthConfig = z.infer<typeof authConfigSchema>;
export type ProtheusConfig = z.infer<typeof protheusConfigSchema>;
export type LoggingConfig = z.infer<typeof loggingConfigSchema>;
export type MetricsConfig = z.infer<typeof metricsConfigSchema>;
export type ServiceConfig = z.infer<typeof serviceConfigSchema>;
//# sourceMappingURL=schema.d.ts.map