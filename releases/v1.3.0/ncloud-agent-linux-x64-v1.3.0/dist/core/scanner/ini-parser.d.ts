/**
 * Estrutura de uma seção INI
 */
export interface IniSection {
    name: string;
    keys: Record<string, string>;
}
/**
 * Estrutura do arquivo INI parseado
 */
export interface ParsedIni {
    path: string;
    sections: IniSection[];
    raw: Record<string, Record<string, string>>;
}
/**
 * Configuração de ambiente extraída do INI
 */
export interface EnvironmentConfig {
    name: string;
    sourcePath: string;
    rootPath: string;
    startProgram: string;
    tcpPort?: number;
    httpPort?: number;
    httpEnabled?: boolean;
    rpcPort?: number;
    sslPort?: number;
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
}
/**
 * Parse de arquivo INI
 */
export declare function parseIniFile(filePath: string): Promise<ParsedIni | null>;
/**
 * Extrai configurações de ambiente de um INI parseado
 */
export declare function extractEnvironments(parsed: ParsedIni): EnvironmentConfig[];
/**
 * Obtém valor de uma seção/chave específica
 */
export declare function getIniValue(parsed: ParsedIni, section: string, key: string): string | undefined;
/**
 * Converte ParsedIni de volta para string
 */
export declare function stringifyIni(parsed: ParsedIni): string;
/**
 * Atualiza valor em uma seção
 */
export declare function setIniValue(parsed: ParsedIni, section: string, key: string, value: string): void;
/**
 * Detecta o tipo de binário Protheus pelo conteúdo do INI
 */
export declare function detectBinaryType(parsed: ParsedIni): 'appserver' | 'dbaccess' | 'license' | 'unknown';
/**
 * Obtém caminho do binário a partir do INI
 */
export declare function getBinaryPath(iniPath: string, platform: NodeJS.Platform): string;
//# sourceMappingURL=ini-parser.d.ts.map