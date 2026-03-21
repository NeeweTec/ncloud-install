"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizePath = normalizePath;
exports.pathExists = pathExists;
exports.isDirectory = isDirectory;
exports.isFile = isFile;
exports.listDirectories = listDirectories;
exports.listFiles = listFiles;
exports.findFiles = findFiles;
exports.getFileInfo = getFileInfo;
exports.createBackup = createBackup;
exports.getHomeDir = getHomeDir;
exports.getTempDir = getTempDir;
exports.resolvePath = resolvePath;
const node_path_1 = __importDefault(require("node:path"));
const node_fs_1 = __importDefault(require("node:fs"));
const node_os_1 = __importDefault(require("node:os"));
/**
 * Normaliza um caminho para o SO atual
 */
function normalizePath(p) {
    return node_path_1.default.normalize(p);
}
/**
 * Verifica se um caminho existe
 */
function pathExists(p) {
    try {
        node_fs_1.default.accessSync(p);
        return true;
    }
    catch {
        return false;
    }
}
/**
 * Verifica se é um diretório
 */
function isDirectory(p) {
    try {
        return node_fs_1.default.statSync(p).isDirectory();
    }
    catch {
        return false;
    }
}
/**
 * Verifica se é um arquivo
 */
function isFile(p) {
    try {
        return node_fs_1.default.statSync(p).isFile();
    }
    catch {
        return false;
    }
}
/**
 * Lista diretórios em um caminho
 */
function listDirectories(p) {
    if (!isDirectory(p)) {
        return [];
    }
    try {
        return node_fs_1.default.readdirSync(p, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .map(dirent => node_path_1.default.join(p, dirent.name));
    }
    catch {
        return [];
    }
}
/**
 * Lista arquivos em um diretório com filtro opcional
 */
function listFiles(dir, pattern) {
    if (!isDirectory(dir)) {
        return [];
    }
    try {
        const files = node_fs_1.default.readdirSync(dir, { withFileTypes: true })
            .filter(dirent => dirent.isFile())
            .map(dirent => node_path_1.default.join(dir, dirent.name));
        if (pattern) {
            return files.filter(f => pattern.test(node_path_1.default.basename(f)));
        }
        return files;
    }
    catch {
        return [];
    }
}
/**
 * Busca recursivamente por arquivos com um padrão
 */
function findFiles(dir, pattern, maxDepth = 10) {
    const results = [];
    function search(currentDir, depth) {
        if (depth > maxDepth)
            return;
        try {
            const entries = node_fs_1.default.readdirSync(currentDir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = node_path_1.default.join(currentDir, entry.name);
                if (entry.isFile() && pattern.test(entry.name)) {
                    results.push(fullPath);
                }
                else if (entry.isDirectory()) {
                    // Ignorar diretórios comuns que não interessam
                    const ignoreDirs = ['node_modules', '.git', 'logs', 'temp', 'tmp'];
                    if (!ignoreDirs.includes(entry.name)) {
                        search(fullPath, depth + 1);
                    }
                }
            }
        }
        catch {
            // Ignorar erros de permissão
        }
    }
    search(dir, 0);
    return results;
}
/**
 * Obtém informações de um arquivo
 */
function getFileInfo(filePath) {
    try {
        const stats = node_fs_1.default.statSync(filePath);
        const mode = stats.mode.toString(8).slice(-3);
        return {
            path: filePath,
            name: node_path_1.default.basename(filePath),
            size: stats.size,
            modifiedAt: stats.mtime,
            createdAt: stats.birthtime,
            permissions: mode,
        };
    }
    catch {
        return null;
    }
}
/**
 * Cria um backup de arquivo
 */
function createBackup(filePath) {
    if (!isFile(filePath)) {
        return null;
    }
    try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '').slice(0, 15);
        const backupPath = `${filePath}.bak.${timestamp}`;
        node_fs_1.default.copyFileSync(filePath, backupPath);
        return backupPath;
    }
    catch {
        return null;
    }
}
/**
 * Obtém o diretório home do usuário
 */
function getHomeDir() {
    return node_os_1.default.homedir();
}
/**
 * Obtém o diretório temporário do sistema
 */
function getTempDir() {
    return node_os_1.default.tmpdir();
}
/**
 * Resolve um caminho relativo a partir de um diretório base
 */
function resolvePath(basePath, relativePath) {
    if (node_path_1.default.isAbsolute(relativePath)) {
        return relativePath;
    }
    return node_path_1.default.resolve(basePath, relativePath);
}
//# sourceMappingURL=paths.js.map