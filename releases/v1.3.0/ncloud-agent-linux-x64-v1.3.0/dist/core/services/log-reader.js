"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.readServiceLogs = readServiceLogs;
exports.streamLogs = streamLogs;
const promises_1 = __importDefault(require("node:fs/promises"));
const node_fs_1 = require("node:fs");
const node_readline_1 = __importDefault(require("node:readline"));
const logger_js_1 = require("../utils/logger.js");
const service_detector_js_1 = require("../scanner/service-detector.js");
const logger = (0, logger_js_1.getLogger)();
/**
 * Lê logs de um serviço
 */
async function readServiceLogs(serviceId, options = {}) {
    const { lines = 100, filter, level } = options;
    const service = await (0, service_detector_js_1.getServiceById)(serviceId);
    if (!service) {
        logger.warn('Service not found for log reading', { serviceId });
        return null;
    }
    if (!service.logPath || !(0, node_fs_1.existsSync)(service.logPath)) {
        logger.warn('Log path not found', { serviceId, logPath: service.logPath });
        return null;
    }
    try {
        const stats = (0, node_fs_1.statSync)(service.logPath);
        const logLines = await readLastLines(service.logPath, Math.min(lines, 1000));
        // Parse e filtra linhas
        let parsedLines = logLines.map(line => parseLine(line));
        // Filtro por nível
        if (level) {
            parsedLines = parsedLines.filter(l => l.level === level);
        }
        // Filtro por texto
        if (filter) {
            const filterLower = filter.toLowerCase();
            parsedLines = parsedLines.filter(l => l.message.toLowerCase().includes(filterLower) ||
                l.raw.toLowerCase().includes(filterLower));
        }
        // Limita ao número solicitado
        parsedLines = parsedLines.slice(-lines);
        return {
            service: serviceId,
            logPath: service.logPath,
            lines: parsedLines,
            totalLines: parsedLines.length,
            logSizeBytes: stats.size,
            lastModified: stats.mtime.toISOString(),
        };
    }
    catch (error) {
        logger.error('Error reading service logs', { serviceId, error });
        return null;
    }
}
/**
 * Lê as últimas N linhas de um arquivo
 */
async function readLastLines(filePath, numLines) {
    const stats = (0, node_fs_1.statSync)(filePath);
    const fileSize = stats.size;
    // Para arquivos pequenos, lê tudo
    if (fileSize < 1024 * 1024) {
        const content = await promises_1.default.readFile(filePath, 'utf-8');
        const lines = content.split(/\r?\n/).filter(Boolean);
        return lines.slice(-numLines);
    }
    // Para arquivos grandes, lê do final
    const chunkSize = Math.min(fileSize, 1024 * 100); // 100KB chunks
    const lines = [];
    let position = fileSize;
    const fd = await promises_1.default.open(filePath, 'r');
    try {
        while (lines.length < numLines && position > 0) {
            const readSize = Math.min(chunkSize, position);
            position -= readSize;
            const buffer = Buffer.alloc(readSize);
            await fd.read(buffer, 0, readSize, position);
            const chunk = buffer.toString('utf-8');
            const chunkLines = chunk.split(/\r?\n/).filter(Boolean);
            lines.unshift(...chunkLines);
        }
    }
    finally {
        await fd.close();
    }
    return lines.slice(-numLines);
}
/**
 * Parse de uma linha de log
 */
function parseLine(line) {
    const result = {
        message: line,
        raw: line,
    };
    // Padrões comuns de timestamp do Protheus
    const patterns = [
        // [05/02/2026 10:00:00] [INFO] message
        /^\[(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2})\]\s*\[?(\w+)\]?\s*(.*)$/,
        // 2026-02-05 10:00:00 INFO message
        /^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})\s+(\w+)\s+(.*)$/,
        // 05/02/2026 10:00:00 - message
        /^(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2})\s*[-:]\s*(.*)$/,
    ];
    for (const pattern of patterns) {
        const match = line.match(pattern);
        if (match) {
            result.timestamp = match[1];
            if (match.length === 4) {
                result.level = normalizeLevel(match[2]);
                result.message = match[3];
            }
            else {
                result.message = match[2];
                // Infere nível pelo conteúdo
                result.level = inferLevel(result.message);
            }
            break;
        }
    }
    // Se não casou com padrão, tenta inferir nível
    if (!result.level) {
        result.level = inferLevel(line);
    }
    return result;
}
/**
 * Normaliza nível de log
 */
function normalizeLevel(level) {
    const upper = level.toUpperCase();
    if (upper.includes('ERR'))
        return 'ERROR';
    if (upper.includes('WARN'))
        return 'WARN';
    if (upper.includes('INF'))
        return 'INFO';
    if (upper.includes('DEBUG') || upper.includes('DBG'))
        return 'DEBUG';
    return upper;
}
/**
 * Infere nível baseado no conteúdo
 */
function inferLevel(message) {
    const lower = message.toLowerCase();
    if (lower.includes('error') ||
        lower.includes('erro') ||
        lower.includes('exception') ||
        lower.includes('failed') ||
        lower.includes('falha')) {
        return 'ERROR';
    }
    if (lower.includes('warning') ||
        lower.includes('aviso') ||
        lower.includes('warn')) {
        return 'WARN';
    }
    return 'INFO';
}
/**
 * Stream de logs em tempo real (para futuro WebSocket)
 */
async function* streamLogs(logPath, abortSignal) {
    if (!(0, node_fs_1.existsSync)(logPath)) {
        return;
    }
    const rl = node_readline_1.default.createInterface({
        input: (0, node_fs_1.createReadStream)(logPath, { encoding: 'utf-8' }),
        crlfDelay: Infinity,
    });
    for await (const line of rl) {
        if (abortSignal?.aborted) {
            break;
        }
        if (line.trim()) {
            yield parseLine(line);
        }
    }
}
//# sourceMappingURL=log-reader.js.map