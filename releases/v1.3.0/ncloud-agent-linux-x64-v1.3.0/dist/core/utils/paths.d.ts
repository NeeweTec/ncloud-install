/**
 * Normaliza um caminho para o SO atual
 */
export declare function normalizePath(p: string): string;
/**
 * Verifica se um caminho existe
 */
export declare function pathExists(p: string): boolean;
/**
 * Verifica se é um diretório
 */
export declare function isDirectory(p: string): boolean;
/**
 * Verifica se é um arquivo
 */
export declare function isFile(p: string): boolean;
/**
 * Lista diretórios em um caminho
 */
export declare function listDirectories(p: string): string[];
/**
 * Lista arquivos em um diretório com filtro opcional
 */
export declare function listFiles(dir: string, pattern?: RegExp): string[];
/**
 * Busca recursivamente por arquivos com um padrão
 */
export declare function findFiles(dir: string, pattern: RegExp, maxDepth?: number): string[];
/**
 * Obtém informações de um arquivo
 */
export declare function getFileInfo(filePath: string): {
    path: string;
    name: string;
    size: number;
    modifiedAt: Date;
    createdAt: Date;
    permissions: string;
} | null;
/**
 * Cria um backup de arquivo
 */
export declare function createBackup(filePath: string): string | null;
/**
 * Obtém o diretório home do usuário
 */
export declare function getHomeDir(): string;
/**
 * Obtém o diretório temporário do sistema
 */
export declare function getTempDir(): string;
/**
 * Resolve um caminho relativo a partir de um diretório base
 */
export declare function resolvePath(basePath: string, relativePath: string): string;
//# sourceMappingURL=paths.d.ts.map