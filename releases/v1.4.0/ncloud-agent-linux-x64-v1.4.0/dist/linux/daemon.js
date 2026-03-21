#!/usr/bin/env node
"use strict";
/**
 * Ncloud Agent - Daemon para Linux
 * Servidor API que roda como serviço systemd
 *
 * Recursos:
 * - Gerenciamento de serviços Protheus (AppServer, DbAccess, License Server)
 * - Gerenciamento de Instâncias (grupos de serviços)
 * - Extração de Environments dos INIs
 * - Navegação de arquivos
 * - Métricas do sistema
 * - Documentação da API
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fastify_1 = __importDefault(require("fastify"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const crypto = __importStar(require("crypto"));
const child_process_1 = require("child_process");
const util_1 = require("util");
const config_store_js_1 = require("./config-store.js");
const index_js_1 = require("./monitor/index.js");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
// ============================================================================
// CONFIGURAÇÃO - USANDO CONFIG STORE CENTRALIZADO
// ============================================================================
const VERSION = '1.3.0';
// Getter para obter config atualizada (sempre da memória sincronizada)
const getConfig = () => config_store_js_1.daemonConfigStore.get();
const serviceStartTimes = new Map();
// Componentes de monitoramento (inicializados em main)
let serviceMonitor = null;
let webhookManager = null;
let realtimeServer = null;
// ============================================================================
// PARSER INI
// ============================================================================
function parseIniFile(filePath) {
    try {
        if (!fs.existsSync(filePath))
            return null;
        const content = fs.readFileSync(filePath, 'utf-8');
        const result = {};
        let section = 'general';
        for (const line of content.split(/\r?\n/)) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith(';') || trimmed.startsWith('#'))
                continue;
            const secMatch = trimmed.match(/^\[([^\]]+)\]$/);
            if (secMatch) {
                section = secMatch[1].toLowerCase();
                if (!result[section])
                    result[section] = {};
                continue;
            }
            const kvMatch = trimmed.match(/^([^=]+)=(.*)$/);
            if (kvMatch) {
                if (!result[section])
                    result[section] = {};
                result[section][kvMatch[1].trim().toLowerCase()] = kvMatch[2].trim();
            }
        }
        return result;
    }
    catch {
        return null;
    }
}
function getIniValue(ini, section, key) {
    return ini?.[section.toLowerCase()]?.[key.toLowerCase()];
}
// ============================================================================
// EXTRAÇÃO DE ENVIRONMENTS DO INI
// ============================================================================
function extractEnvironmentsFromIni(iniPath) {
    const environments = [];
    try {
        if (!fs.existsSync(iniPath))
            return environments;
        const content = fs.readFileSync(iniPath, 'utf-8');
        const lines = content.split(/\r?\n/);
        let currentSection = null;
        let currentConfig = {};
        let isCommented = false;
        for (const line of lines) {
            const trimmed = line.trim();
            // Detecta seção comentada
            if (trimmed.match(/^[;#]\s*\[/)) {
                isCommented = true;
                continue;
            }
            // Detecta nova seção
            const sectionMatch = trimmed.match(/^\[([^\]]+)\]$/);
            if (sectionMatch) {
                // Salva seção anterior se for environment válido
                if (currentSection && currentConfig['sourcepath'] && currentConfig['rootpath']) {
                    environments.push(createEnvironmentFromConfig(currentSection, currentConfig));
                }
                currentSection = sectionMatch[1];
                currentConfig = {};
                isCommented = false;
                continue;
            }
            // Ignora linhas de seções comentadas
            if (isCommented)
                continue;
            // Ignora comentários
            if (trimmed.startsWith(';') || trimmed.startsWith('#') || !trimmed)
                continue;
            // Parse key=value
            const kvMatch = trimmed.match(/^([^=]+)=(.*)$/);
            if (kvMatch && currentSection) {
                currentConfig[kvMatch[1].trim().toLowerCase()] = kvMatch[2].trim();
            }
        }
        // Processa última seção
        if (currentSection && currentConfig['sourcepath'] && currentConfig['rootpath']) {
            environments.push(createEnvironmentFromConfig(currentSection, currentConfig));
        }
    }
    catch (error) {
        console.error('Erro ao extrair environments:', error);
    }
    return environments;
}
function createEnvironmentFromConfig(name, config) {
    return {
        name,
        sourcePath: config['sourcepath'] || '',
        rootPath: config['rootpath'] || '',
        startPath: config['startpath'],
        rpoCustom: config['rpocustom'],
        rpoDb: config['rpodb'],
        rpoLanguage: config['rpolanguage'],
        rpoVersion: config['rpoversion'],
        dbAlias: config['dbalias'],
        dbServer: config['dbserver'],
        dbDatabase: config['dbdatabase'],
        dbPort: config['dbport'] ? parseInt(config['dbport'], 10) : undefined,
        sqliteServer: config['sqliteserver'],
        sqlitePort: config['sqliteport'] ? parseInt(config['sqliteport'], 10) : undefined,
        rawConfig: { ...config },
    };
}
// ============================================================================
// DETECÇÃO DE PORTAS
// ============================================================================
function detectServicePort(ini, type) {
    if (!ini)
        return 0;
    const sections = {
        'dbaccess': [['general', 'port']],
        'license': [['licenseserver', 'port'], ['tcp', 'port']],
        'appserver': [['tcp', 'port']],
        'rest': [['httprest', 'port'], ['tcp', 'port']],
    };
    for (const [sec, key] of (sections[type] || sections['appserver'])) {
        const val = getIniValue(ini, sec, key);
        if (val) {
            const port = parseInt(val, 10);
            if (port > 0)
                return port;
        }
    }
    return 0;
}
// ============================================================================
// CONTROLE DE PROCESSOS
// ============================================================================
async function checkPortInUse(port) {
    try {
        const { stdout } = await execAsync(`ss -tlnp 2>/dev/null | grep ":${port} " || netstat -tlnp 2>/dev/null | grep ":${port} " || true`);
        return stdout.trim().length > 0;
    }
    catch {
        return false;
    }
}
async function getPidByPort(port) {
    try {
        const { stdout } = await execAsync(`ss -tlnp 2>/dev/null | grep ":${port} " | grep -oP 'pid=\\K\\d+' | head -1`);
        const pid = parseInt(stdout.trim(), 10);
        if (!isNaN(pid) && pid > 0)
            return pid;
    }
    catch { }
    return undefined;
}
async function getProcessMemory(pid) {
    try {
        const { stdout } = await execAsync(`ps -p ${pid} -o rss= 2>/dev/null`);
        return Math.round(parseInt(stdout.trim(), 10) / 1024);
    }
    catch { }
    return undefined;
}
async function getServiceStatus(env) {
    let ini = parseIniFile(env.iniPath);
    let port = env.port || detectServicePort(ini, env.type);
    if (port === 0 && env.type === 'license') {
        const altPath = path.join(env.rootPath, 'appserver.ini');
        if (fs.existsSync(altPath)) {
            port = detectServicePort(parseIniFile(altPath), env.type);
        }
    }
    // Encontra instância associada
    const instance = getConfig().instances.find(inst => inst.services.includes(env.name));
    const status = {
        id: env.id,
        name: env.name,
        displayName: env.displayName,
        type: env.type,
        status: 'stopped',
        port: port || undefined,
        path: env.rootPath,
        configFile: env.iniPath,
        instanceId: instance?.id,
        instanceName: instance?.displayName,
    };
    if (port > 0 && await checkPortInUse(port)) {
        status.status = 'running';
        status.pid = await getPidByPort(port);
        if (status.pid) {
            status.memory = await getProcessMemory(status.pid);
            const startTime = serviceStartTimes.get(env.name);
            if (startTime) {
                status.uptime = Math.floor((Date.now() - startTime) / 1000);
            }
        }
    }
    return status;
}
async function startService(env) {
    const status = await getServiceStatus(env);
    if (status.status === 'running') {
        return { success: true, message: 'Serviço já está em execução' };
    }
    let executable = env.type === 'dbaccess'
        ? path.join(env.rootPath, fs.existsSync(path.join(env.rootPath, 'dbaccess64')) ? 'dbaccess64' : 'dbaccess')
        : path.join(env.rootPath, 'appsrvlinux');
    if (!fs.existsSync(executable)) {
        return { success: false, message: `Executável não encontrado: ${executable}` };
    }
    try {
        const child = (0, child_process_1.spawn)(executable, [], {
            cwd: env.rootPath,
            detached: true,
            stdio: 'ignore',
            env: { ...process.env, LD_LIBRARY_PATH: `${env.rootPath}:${process.env.LD_LIBRARY_PATH || ''}` },
        });
        child.unref();
        serviceStartTimes.set(env.name, Date.now());
        await new Promise(r => setTimeout(r, 15000));
        const newStatus = await getServiceStatus(env);
        return newStatus.status === 'running'
            ? { success: true, message: 'Serviço iniciado com sucesso' }
            : { success: false, message: 'Serviço não respondeu na porta' };
    }
    catch (error) {
        return { success: false, message: `Erro: ${error}` };
    }
}
async function stopService(env) {
    const status = await getServiceStatus(env);
    if (status.status === 'stopped') {
        return { success: true, message: 'Serviço já está parado' };
    }
    if (!status.pid) {
        return { success: false, message: 'PID não encontrado' };
    }
    try {
        await execAsync(`kill ${status.pid}`);
        await new Promise(r => setTimeout(r, 2000));
        if ((await getServiceStatus(env)).status === 'stopped') {
            serviceStartTimes.delete(env.name);
            return { success: true, message: 'Serviço parado com sucesso' };
        }
        await execAsync(`kill -9 ${status.pid}`);
        serviceStartTimes.delete(env.name);
        return { success: true, message: 'Serviço parado (forçado)' };
    }
    catch (error) {
        return { success: false, message: `Erro: ${error}` };
    }
}
// ============================================================================
// DIRETÓRIOS DO SERVIÇO
// ============================================================================
function getServiceDirectories(env) {
    const ini = parseIniFile(env.iniPath);
    const result = { binary: env.rootPath };
    if (ini) {
        const appEnv = getIniValue(ini, 'general', 'app_environment');
        const sections = [appEnv, 'environment', 'protheus'].filter(Boolean);
        for (const sec of sections) {
            if (!result.sourcePath)
                result.sourcePath = getIniValue(ini, sec, 'sourcepath');
            if (!result.rpoCustom)
                result.rpoCustom = getIniValue(ini, sec, 'rpocustom');
            if (!result.rootPath)
                result.rootPath = getIniValue(ini, sec, 'rootpath');
            if (!result.startPath)
                result.startPath = getIniValue(ini, sec, 'startpath');
        }
        result.logPath = getIniValue(ini, 'general', 'logpath');
        if (appEnv)
            result.environment = appEnv;
    }
    return result;
}
// ============================================================================
// NAVEGAÇÃO DE ARQUIVOS
// ============================================================================
function listDirectory(dirPath) {
    try {
        if (!fs.existsSync(dirPath))
            return [];
        return fs.readdirSync(dirPath, { withFileTypes: true })
            .filter(e => !e.name.startsWith('.'))
            .map(entry => {
            const fullPath = path.join(dirPath, entry.name);
            const stats = fs.statSync(fullPath);
            return {
                name: entry.name,
                path: fullPath,
                type: (entry.isDirectory() ? 'directory' : 'file'),
                size: entry.isFile() ? stats.size : undefined,
                modified: stats.mtime.toISOString(),
                extension: entry.isFile() ? path.extname(entry.name).toLowerCase() : undefined,
            };
        })
            .sort((a, b) => {
            if (a.type !== b.type)
                return a.type === 'directory' ? -1 : 1;
            return a.name.localeCompare(b.name);
        });
    }
    catch {
        return [];
    }
}
// ============================================================================
// DOCUMENTAÇÃO DA API
// ============================================================================
function generateApiDocs() {
    return [
        // Health & Info
        { method: 'GET', path: '/health', description: 'Verifica saúde da API', category: 'Sistema', auth: false },
        { method: 'GET', path: '/info', description: 'Informações do sistema', category: 'Sistema', auth: true },
        { method: 'GET', path: '/metrics', description: 'Métricas de CPU, memória e sistema', category: 'Sistema', auth: true },
        // Services
        { method: 'GET', path: '/services', description: 'Lista todos os serviços configurados', category: 'Serviços', auth: true },
        { method: 'GET', path: '/services/:id', description: 'Status de um serviço específico', category: 'Serviços', auth: true },
        { method: 'POST', path: '/services/:id/start', description: 'Inicia um serviço', category: 'Serviços', auth: true },
        { method: 'POST', path: '/services/:id/stop', description: 'Para um serviço', category: 'Serviços', auth: true },
        { method: 'POST', path: '/services/:id/restart', description: 'Reinicia um serviço', category: 'Serviços', auth: true },
        { method: 'GET', path: '/services/:id/directories', description: 'Lista diretórios do serviço', category: 'Serviços', auth: true },
        { method: 'GET', path: '/services/:id/files', description: 'Navega arquivos do serviço', category: 'Serviços', auth: true },
        { method: 'GET', path: '/services/:id/environments', description: 'Lista environments do INI do serviço', category: 'Serviços', auth: true },
        // Instances
        { method: 'GET', path: '/instances', description: 'Lista todas as instâncias', category: 'Instâncias', auth: true },
        { method: 'GET', path: '/instances/:id', description: 'Detalhes de uma instância', category: 'Instâncias', auth: true },
        { method: 'POST', path: '/instances', description: 'Cria uma nova instância', category: 'Instâncias', auth: true,
            requestBody: { name: 'string', displayName: 'string', type: 'DESENVOLVIMENTO|QA|PRODUCAO', description: 'string' } },
        { method: 'PUT', path: '/instances/:id', description: 'Atualiza uma instância', category: 'Instâncias', auth: true },
        { method: 'DELETE', path: '/instances/:id', description: 'Remove uma instância', category: 'Instâncias', auth: true },
        { method: 'POST', path: '/instances/:id/services/:serviceId', description: 'Adiciona serviço à instância', category: 'Instâncias', auth: true },
        { method: 'DELETE', path: '/instances/:id/services/:serviceId', description: 'Remove serviço da instância', category: 'Instâncias', auth: true },
        { method: 'POST', path: '/instances/:id/start-all', description: 'Inicia todos os serviços da instância', category: 'Instâncias', auth: true },
        { method: 'POST', path: '/instances/:id/stop-all', description: 'Para todos os serviços da instância', category: 'Instâncias', auth: true },
        // Environments
        { method: 'GET', path: '/environments', description: 'Lista ambientes configurados', category: 'Ambientes', auth: true },
        { method: 'GET', path: '/environments/all', description: 'Lista todos os environments de todos os INIs', category: 'Ambientes', auth: true },
        // Files
        { method: 'GET', path: '/files', description: 'Lista arquivos de um diretório', category: 'Arquivos', auth: true },
        // Config
        { method: 'GET', path: '/config', description: 'Retorna configuração atual', category: 'Configuração', auth: true },
        { method: 'PUT', path: '/config', description: 'Atualiza configuração', category: 'Configuração', auth: true },
        // Docs
        { method: 'GET', path: '/docs', description: 'Documentação da API (HTML)', category: 'Documentação', auth: false },
        { method: 'GET', path: '/docs/json', description: 'Documentação da API (JSON)', category: 'Documentação', auth: false },
    ];
}
function generateApiDocsHtml() {
    const docs = generateApiDocs();
    const categories = [...new Set(docs.map(d => d.category))];
    const methodColors = {
        GET: '#61affe',
        POST: '#49cc90',
        PUT: '#fca130',
        DELETE: '#f93e3e',
    };
    let html = `<!DOCTYPE html>
<html>
<head>
  <title>Ncloud Agent - API Documentation</title>
  <meta charset="UTF-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #fafafa; color: #3b4151; line-height: 1.5; }
    .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #178bfc 0%, #1262b3 100%); color: white; padding: 40px 20px; margin-bottom: 30px; }
    .header h1 { font-size: 2rem; margin-bottom: 8px; }
    .header p { opacity: 0.9; }
    .info-box { background: white; border-radius: 8px; padding: 20px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .info-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; }
    .info-item { display: flex; flex-direction: column; gap: 4px; }
    .info-label { font-size: 0.75rem; color: #6b7280; text-transform: uppercase; }
    .info-value { font-family: monospace; color: #178bfc; }
    .category { background: white; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow: hidden; }
    .category-header { background: #f8f9fa; padding: 16px 20px; font-weight: 600; border-bottom: 1px solid #e9ecef; }
    .endpoint { border-bottom: 1px solid #e9ecef; }
    .endpoint:last-child { border-bottom: none; }
    .endpoint-header { display: flex; align-items: center; gap: 12px; padding: 12px 20px; cursor: pointer; }
    .endpoint-header:hover { background: #f8f9fa; }
    .method { padding: 4px 10px; border-radius: 4px; color: white; font-size: 0.75rem; font-weight: 600; min-width: 60px; text-align: center; }
    .path { font-family: monospace; font-weight: 500; }
    .description { color: #6b7280; margin-left: auto; }
    .auth-badge { font-size: 0.7rem; padding: 2px 6px; border-radius: 4px; background: #fef3c7; color: #92400e; }
    .auth-badge.public { background: #d1fae5; color: #065f46; }
  </style>
</head>
<body>
  <div class="header">
    <div class="container">
      <h1>☁️ Ncloud Agent API</h1>
      <p>Documentação completa dos endpoints REST disponíveis</p>
    </div>
  </div>
  <div class="container">
    <div class="info-box">
      <div class="info-grid">
        <div class="info-item">
          <span class="info-label">Base URL</span>
          <span class="info-value">http://localhost:${getConfig().server.port}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Autenticação</span>
          <span class="info-value">Authorization: Bearer &lt;token&gt;</span>
        </div>
        <div class="info-item">
          <span class="info-label">Versão</span>
          <span class="info-value">${VERSION}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Endpoints Públicos</span>
          <span class="info-value">/health, /docs</span>
        </div>
      </div>
    </div>`;
    for (const cat of categories) {
        const endpoints = docs.filter(d => d.category === cat);
        html += `
    <div class="category">
      <div class="category-header">${cat}</div>`;
        for (const ep of endpoints) {
            const color = methodColors[ep.method] || '#6b7280';
            html += `
      <div class="endpoint">
        <div class="endpoint-header">
          <span class="method" style="background:${color}">${ep.method}</span>
          <span class="path">${ep.path}</span>
          <span class="description">${ep.description}</span>
          <span class="auth-badge ${ep.auth ? '' : 'public'}">${ep.auth ? '🔒 Auth' : '🌐 Public'}</span>
        </div>
      </div>`;
        }
        html += `
    </div>`;
    }
    html += `
  </div>
</body>
</html>`;
    return html;
}
function createEnvironment(name, displayName, rootPath, iniPath, type) {
    const now = new Date().toISOString();
    return {
        id: crypto.randomUUID(),
        name,
        displayName,
        rootPath,
        iniPath,
        enabled: true,
        type,
        createdAt: now,
        updatedAt: now,
    };
}
function scanDirectory(dirPath, depth = 0, maxDepth = 5) {
    const result = { appservers: [], dbaccess: [], licenses: [] };
    if (depth > maxDepth)
        return result;
    try {
        if (!fs.existsSync(dirPath))
            return result;
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        const files = entries.filter(e => e.isFile()).map(e => e.name.toLowerCase());
        const dirs = entries.filter(e => e.isDirectory());
        // Detecta AppServer/License
        if (files.includes('appsrvlinux') && files.includes('appserver.ini')) {
            const iniPath = path.join(dirPath, 'appserver.ini');
            const isLicense = files.includes('licenseserver.ini') || dirPath.toLowerCase().includes('license');
            if (isLicense) {
                const baseName = path.basename(dirPath).toLowerCase().replace(/\s+/g, '-');
                const parentName = path.basename(path.dirname(dirPath)).toLowerCase().replace(/\s+/g, '-');
                result.licenses.push(createEnvironment(`license-${parentName}-${baseName}`, `License Server - ${path.basename(path.dirname(dirPath))}`, dirPath, files.includes('licenseserver.ini') ? path.join(dirPath, 'licenseserver.ini') : iniPath, 'license'));
            }
            else {
                result.appservers.push(createEnvironment(path.basename(dirPath).toLowerCase().replace(/\s+/g, '-'), `${path.basename(dirPath)} (${path.basename(path.dirname(dirPath))})`, dirPath, iniPath, 'appserver'));
            }
        }
        // Detecta DbAccess
        if ((files.includes('dbaccess64') || files.includes('dbaccess')) && files.includes('dbaccess.ini')) {
            result.dbaccess.push(createEnvironment(path.basename(dirPath).toLowerCase().replace(/\s+/g, '-'), `DbAccess - ${path.basename(path.dirname(dirPath))}`, dirPath, path.join(dirPath, 'dbaccess.ini'), 'dbaccess'));
        }
        // Busca recursiva
        for (const dir of dirs) {
            const skipDirs = ['node_modules', '.git', 'system', 'spool', 'log', 'data', 'profile', 'cache'];
            if (skipDirs.some(s => dir.name.toLowerCase().includes(s)))
                continue;
            const subResult = scanDirectory(path.join(dirPath, dir.name), depth + 1, maxDepth);
            result.appservers.push(...subResult.appservers);
            result.dbaccess.push(...subResult.dbaccess);
            result.licenses.push(...subResult.licenses);
        }
    }
    catch { }
    return result;
}
// ============================================================================
// SERVIDOR API
// ============================================================================
async function createServer() {
    const server = (0, fastify_1.default)({ logger: true });
    // Autenticação
    server.addHook('onRequest', async (request, reply) => {
        const publicRoutes = ['/health', '/health/', '/docs', '/docs/', '/docs/json'];
        if (publicRoutes.some(r => request.url.startsWith(r)))
            return;
        const auth = request.headers.authorization;
        if (!auth) {
            return reply.status(401).send({ error: 'Unauthorized', message: 'Token não fornecido' });
        }
        const [type, token] = auth.split(' ');
        if (type !== 'Bearer' || token !== getConfig().auth.token) {
            return reply.status(401).send({ error: 'Unauthorized', message: 'Token inválido' });
        }
    });
    // ==================== HEALTH & INFO ====================
    server.get('/health', async () => ({
        status: 'ok',
        version: VERSION,
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
    }));
    server.get('/info', async () => ({
        agentVersion: VERSION,
        hostname: os.hostname(),
        platform: process.platform,
        arch: os.arch(),
        osType: os.type(),
        osRelease: os.release(),
        cpus: os.cpus().length,
        totalMemory: os.totalmem(),
        freeMemory: os.freemem(),
        nodeVersion: process.version,
        uptime: os.uptime(),
    }));
    server.get('/metrics', async () => {
        const cpus = os.cpus();
        const loadavg = os.loadavg();
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        return {
            timestamp: new Date().toISOString(),
            cpu: {
                cores: cpus.length,
                model: cpus[0]?.model,
                loadAverage: { '1m': loadavg[0], '5m': loadavg[1], '15m': loadavg[2] },
            },
            memory: {
                total: totalMem,
                used: totalMem - freeMem,
                free: freeMem,
                usagePercent: Math.round(((totalMem - freeMem) / totalMem) * 100),
            },
            system: { uptime: os.uptime(), hostname: os.hostname(), platform: process.platform },
        };
    });
    // ==================== SERVICES ====================
    server.get('/services', async () => {
        const services = [];
        for (const env of getConfig().environments.filter(e => e.enabled)) {
            services.push(await getServiceStatus(env));
        }
        return {
            services,
            summary: {
                total: services.length,
                running: services.filter(s => s.status === 'running').length,
                stopped: services.filter(s => s.status === 'stopped').length,
            },
        };
    });
    // Helper para buscar environment por ID ou nome
    const findEnvironment = (idOrName, enabledOnly = true) => {
        return getConfig().environments.find(e => (e.id === idOrName || e.name === idOrName) && (!enabledOnly || e.enabled));
    };
    server.get('/services/:id', async (request, reply) => {
        const { id } = request.params;
        const env = findEnvironment(id);
        if (!env)
            return reply.status(404).send({ error: 'Serviço não encontrado' });
        return getServiceStatus(env);
    });
    server.post('/services/:id/start', async (request, reply) => {
        const { id } = request.params;
        const env = findEnvironment(id);
        if (!env)
            return reply.status(404).send({ error: 'Serviço não encontrado' });
        return startService(env);
    });
    server.post('/services/:id/stop', async (request, reply) => {
        const { id } = request.params;
        const env = findEnvironment(id);
        if (!env)
            return reply.status(404).send({ error: 'Serviço não encontrado' });
        return stopService(env);
    });
    server.post('/services/:id/restart', async (request, reply) => {
        const { id } = request.params;
        const env = findEnvironment(id);
        if (!env)
            return reply.status(404).send({ error: 'Serviço não encontrado' });
        await stopService(env);
        await new Promise(r => setTimeout(r, 2000));
        return startService(env);
    });
    server.get('/services/:id/directories', async (request, reply) => {
        const { id } = request.params;
        const env = findEnvironment(id);
        if (!env)
            return reply.status(404).send({ error: 'Serviço não encontrado' });
        return getServiceDirectories(env);
    });
    server.get('/services/:id/files', async (request, reply) => {
        const { id } = request.params;
        const { type, subpath } = request.query;
        const env = findEnvironment(id);
        if (!env)
            return reply.status(404).send({ error: 'Serviço não encontrado' });
        const dirs = getServiceDirectories(env);
        if (!type)
            return { service: env.name, directories: dirs };
        const pathMap = {
            binary: dirs.binary,
            sourcepath: dirs.sourcePath,
            rpocustom: dirs.rpoCustom,
            rootpath: dirs.rootPath,
            startpath: dirs.startPath,
            log: dirs.logPath,
        };
        const basePath = pathMap[type];
        if (!basePath)
            return reply.status(404).send({ error: `Diretório '${type}' não configurado` });
        const fullPath = subpath ? path.join(basePath, subpath) : basePath;
        if (!fs.existsSync(fullPath))
            return reply.status(404).send({ error: 'Diretório não encontrado' });
        return {
            service: env.name,
            serviceId: env.id,
            type,
            basePath,
            currentPath: fullPath,
            parent: path.dirname(fullPath),
            entries: listDirectory(fullPath),
        };
    });
    server.get('/services/:id/environments', async (request, reply) => {
        const { id } = request.params;
        const env = findEnvironment(id);
        if (!env)
            return reply.status(404).send({ error: 'Serviço não encontrado' });
        if (env.type !== 'appserver' && env.type !== 'rest') {
            return { service: env.name, environments: [], message: 'Este tipo de serviço não possui environments configuráveis' };
        }
        const environments = extractEnvironmentsFromIni(env.iniPath);
        return {
            service: id,
            serviceName: env.name,
            serviceDisplayName: env.displayName,
            iniPath: env.iniPath,
            environments,
            totalEnvironments: environments.length,
        };
    });
    // ==================== INSTANCES ====================
    server.get('/instances', async () => {
        const instancesWithStats = await Promise.all(getConfig().instances.map(async (inst) => {
            let runningCount = 0;
            for (const svcName of inst.services) {
                const env = findEnvironment(svcName);
                if (env) {
                    const status = await getServiceStatus(env);
                    if (status.status === 'running')
                        runningCount++;
                }
            }
            return {
                ...inst,
                serviceCount: inst.services.length,
                runningServices: runningCount,
            };
        }));
        return {
            instances: instancesWithStats,
            total: instancesWithStats.length,
        };
    });
    server.get('/instances/:id', async (request, reply) => {
        const { id } = request.params;
        const instance = getConfig().instances.find(i => i.id === id);
        if (!instance)
            return reply.status(404).send({ error: 'Instância não encontrada' });
        const servicesWithStatus = await Promise.all(instance.services.map(async (svcName) => {
            const env = findEnvironment(svcName);
            if (!env)
                return { name: svcName, status: 'not_found' };
            return getServiceStatus(env);
        }));
        return { ...instance, servicesWithStatus };
    });
    server.post('/instances', async (request, reply) => {
        const body = request.body;
        if (!body.name || !body.displayName || !body.type) {
            return reply.status(400).send({ error: 'name, displayName e type são obrigatórios' });
        }
        const newInstance = {
            id: crypto.randomUUID(),
            name: body.name,
            displayName: body.displayName,
            type: body.type,
            description: body.description || '',
            services: [],
            enabled: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        config_store_js_1.daemonConfigStore.addInstance(newInstance);
        return { success: true, instance: newInstance };
    });
    server.put('/instances/:id', async (request, reply) => {
        const { id } = request.params;
        const body = request.body;
        const instance = config_store_js_1.daemonConfigStore.getInstance(id);
        if (!instance)
            return reply.status(404).send({ error: 'Instância não encontrada' });
        const updated = config_store_js_1.daemonConfigStore.updateInstance(id, body);
        return { success: true, instance: updated };
    });
    server.delete('/instances/:id', async (request, reply) => {
        const { id } = request.params;
        const removed = config_store_js_1.daemonConfigStore.removeInstance(id);
        if (!removed)
            return reply.status(404).send({ error: 'Instância não encontrada' });
        return { success: true, message: 'Instância removida' };
    });
    server.post('/instances/:id/services/:serviceId', async (request, reply) => {
        const { id, serviceId } = request.params;
        const instance = config_store_js_1.daemonConfigStore.getInstance(id);
        if (!instance)
            return reply.status(404).send({ error: 'Instância não encontrada' });
        const env = config_store_js_1.daemonConfigStore.getEnvironment(serviceId);
        if (!env)
            return reply.status(404).send({ error: 'Serviço não encontrado' });
        config_store_js_1.daemonConfigStore.addServiceToInstance(id, serviceId);
        return { success: true, instance: config_store_js_1.daemonConfigStore.getInstance(id) };
    });
    server.delete('/instances/:id/services/:serviceId', async (request, reply) => {
        const { id, serviceId } = request.params;
        const instance = config_store_js_1.daemonConfigStore.getInstance(id);
        if (!instance)
            return reply.status(404).send({ error: 'Instância não encontrada' });
        config_store_js_1.daemonConfigStore.removeServiceFromInstance(id, serviceId);
        return { success: true, instance: config_store_js_1.daemonConfigStore.getInstance(id) };
    });
    server.post('/instances/:id/start-all', async (request, reply) => {
        const { id } = request.params;
        const instance = getConfig().instances.find(i => i.id === id);
        if (!instance)
            return reply.status(404).send({ error: 'Instância não encontrada' });
        const results = [];
        for (const svcName of instance.services) {
            const env = findEnvironment(svcName);
            if (env) {
                const result = await startService(env);
                results.push({ service: svcName, serviceId: env.id, ...result });
            }
        }
        return { success: results.every(r => r.success), results };
    });
    server.post('/instances/:id/stop-all', async (request, reply) => {
        const { id } = request.params;
        const instance = getConfig().instances.find(i => i.id === id);
        if (!instance)
            return reply.status(404).send({ error: 'Instância não encontrada' });
        const results = [];
        for (const svcName of instance.services) {
            const env = findEnvironment(svcName);
            if (env) {
                const result = await stopService(env);
                results.push({ service: svcName, serviceId: env.id, ...result });
            }
        }
        return { success: results.every(r => r.success), results };
    });
    // ==================== ENVIRONMENTS ====================
    server.get('/environments', async () => {
        const envs = getConfig().environments.filter(e => e.enabled);
        return {
            environments: envs.map(e => ({
                id: e.id,
                name: e.name,
                displayName: e.displayName,
                rootPath: e.rootPath,
                iniPath: e.iniPath,
                type: e.type,
                port: e.port,
                instanceId: e.instanceId,
                createdAt: e.createdAt,
                updatedAt: e.updatedAt,
            })),
            total: envs.length,
        };
    });
    server.get('/environments/all', async () => {
        const result = [];
        for (const env of getConfig().environments.filter(e => e.enabled && (e.type === 'appserver' || e.type === 'rest'))) {
            const envs = extractEnvironmentsFromIni(env.iniPath);
            result.push({
                serviceName: env.name,
                serviceDisplayName: env.displayName,
                iniPath: env.iniPath,
                environments: envs,
            });
        }
        return {
            services: result,
            totalServices: result.length,
            totalEnvironments: result.reduce((acc, s) => acc + s.environments.length, 0),
        };
    });
    // ==================== FILES ====================
    server.get('/files', async (request, reply) => {
        const { path: dirPath } = request.query;
        if (!dirPath)
            return reply.status(400).send({ error: 'path é obrigatório' });
        if (!fs.existsSync(dirPath))
            return reply.status(404).send({ error: 'Diretório não encontrado' });
        const entries = listDirectory(dirPath);
        return {
            path: dirPath,
            parent: path.dirname(dirPath),
            entries,
            totalFiles: entries.filter(e => e.type === 'file').length,
            totalDirectories: entries.filter(e => e.type === 'directory').length,
        };
    });
    // ==================== CONFIG ====================
    server.get('/config', async () => {
        const cfg = getConfig();
        return {
            server: cfg.server,
            environments: cfg.environments.length,
            instances: cfg.instances.length,
            scanPaths: cfg.scanPaths,
            autoStart: cfg.autoStart,
        };
    });
    server.put('/config', async (request, reply) => {
        const body = request.body;
        config_store_js_1.daemonConfigStore.set(body);
        return { success: true, message: 'Configuração atualizada' };
    });
    // ==================== WEBHOOKS ====================
    // Lista webhooks
    server.get('/webhooks', async () => {
        const webhooks = config_store_js_1.daemonConfigStore.listWebhooks();
        return {
            webhooks: webhooks.map(w => ({
                ...w,
                secret: w.secret ? '***' : undefined, // Oculta secret
            })),
            total: webhooks.length,
        };
    });
    // Obtém webhook por ID
    server.get('/webhooks/:id', async (request, reply) => {
        const { id } = request.params;
        const webhook = config_store_js_1.daemonConfigStore.getWebhook(id);
        if (!webhook)
            return reply.status(404).send({ error: 'Webhook não encontrado' });
        return {
            ...webhook,
            secret: webhook.secret ? '***' : undefined,
        };
    });
    // Cria webhook
    server.post('/webhooks', async (request, reply) => {
        const body = request.body;
        if (!body.name || !body.url) {
            return reply.status(400).send({ error: 'name e url são obrigatórios' });
        }
        const webhook = config_store_js_1.daemonConfigStore.addWebhook({
            name: body.name,
            url: body.url,
            secret: body.secret,
            events: body.events || ['*'],
            enabled: body.enabled ?? true,
            retryCount: body.retryCount ?? 3,
            retryDelayMs: body.retryDelayMs ?? 1000,
            timeoutMs: body.timeoutMs ?? 10000,
            headers: body.headers,
        });
        return reply.status(201).send(webhook);
    });
    // Atualiza webhook
    server.put('/webhooks/:id', async (request, reply) => {
        const { id } = request.params;
        const body = request.body;
        const webhook = config_store_js_1.daemonConfigStore.updateWebhook(id, body);
        if (!webhook)
            return reply.status(404).send({ error: 'Webhook não encontrado' });
        return webhook;
    });
    // Remove webhook
    server.delete('/webhooks/:id', async (request, reply) => {
        const { id } = request.params;
        const deleted = config_store_js_1.daemonConfigStore.removeWebhook(id);
        if (!deleted)
            return reply.status(404).send({ error: 'Webhook não encontrado' });
        return { success: true, message: 'Webhook removido' };
    });
    // Testa webhook
    server.post('/webhooks/:id/test', async (request, reply) => {
        const { id } = request.params;
        if (!webhookManager) {
            return reply.status(503).send({ error: 'Monitor não está ativo' });
        }
        const result = await webhookManager.test(id);
        return result;
    });
    // Histórico de entregas
    server.get('/webhooks/:id/deliveries', async (request, reply) => {
        const { id } = request.params;
        const { limit } = request.query;
        if (!webhookManager) {
            return reply.status(503).send({ error: 'Monitor não está ativo' });
        }
        const history = webhookManager.getDeliveryHistory(id, parseInt(limit || '50', 10));
        return { deliveries: history, total: history.length };
    });
    // ==================== MONITOR ====================
    // Status do monitor
    server.get('/monitor/status', async () => {
        const monitorConfig = getConfig().monitor;
        return {
            enabled: monitorConfig?.enabled ?? false,
            pollIntervalMs: monitorConfig?.pollIntervalMs ?? 5000,
            isRunning: serviceMonitor !== null,
            wsClients: realtimeServer?.getClientCount() ?? 0,
            snapshots: serviceMonitor?.getAllSnapshots().length ?? 0,
        };
    });
    // Snapshots de todos os serviços (dados em tempo real do cache)
    server.get('/monitor/snapshots', async () => {
        if (!serviceMonitor) {
            return { error: 'Monitor não está ativo', snapshots: [] };
        }
        const snapshots = serviceMonitor.getAllSnapshots();
        return {
            snapshots,
            total: snapshots.length,
            timestamp: new Date().toISOString(),
        };
    });
    // Snapshot de um serviço específico
    server.get('/monitor/snapshots/:id', async (request, reply) => {
        const { id } = request.params;
        if (!serviceMonitor) {
            return reply.status(503).send({ error: 'Monitor não está ativo' });
        }
        const snapshot = serviceMonitor.getSnapshot(id);
        if (!snapshot)
            return reply.status(404).send({ error: 'Serviço não encontrado' });
        return snapshot;
    });
    // Força refresh de um serviço
    server.post('/monitor/refresh/:id', async (request, reply) => {
        const { id } = request.params;
        if (!serviceMonitor) {
            return reply.status(503).send({ error: 'Monitor não está ativo' });
        }
        const snapshot = await serviceMonitor.refresh(id);
        if (!snapshot)
            return reply.status(404).send({ error: 'Serviço não encontrado' });
        return snapshot;
    });
    // Força refresh de todos os serviços
    server.post('/monitor/refresh', async (request, reply) => {
        if (!serviceMonitor) {
            return reply.status(503).send({ error: 'Monitor não está ativo' });
        }
        await serviceMonitor.poll();
        const snapshots = serviceMonitor.getAllSnapshots();
        return {
            snapshots,
            total: snapshots.length,
            timestamp: new Date().toISOString(),
        };
    });
    // Configuração do monitor
    server.get('/monitor/config', async () => {
        return config_store_js_1.daemonConfigStore.getMonitorConfig();
    });
    server.put('/monitor/config', async (request) => {
        const body = request.body;
        const updated = config_store_js_1.daemonConfigStore.setMonitorConfig(body);
        return { success: true, config: updated, message: 'Reinicie o daemon para aplicar mudanças' };
    });
    // ==================== DOCS ====================
    server.get('/docs', async (request, reply) => {
        reply.type('text/html').send(generateApiDocsHtml());
    });
    server.get('/docs/json', async () => ({
        version: VERSION,
        endpoints: generateApiDocs(),
    }));
    return server;
}
// ============================================================================
// MAIN
// ============================================================================
async function main() {
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║                    NCLOUD AGENT DAEMON                       ║
║              Protheus Service Manager v${VERSION}                ║
╚══════════════════════════════════════════════════════════════╝
`);
    // Configuração é carregada automaticamente pelo configStore singleton
    const cfg = getConfig();
    console.log(`📁 Config: ${config_store_js_1.daemonConfigStore.getConfigPath()}`);
    console.log(`🌐 Host: ${cfg.server.host}:${cfg.server.port}`);
    console.log(`📊 Ambientes: ${cfg.environments.length}`);
    console.log(`📦 Instâncias: ${cfg.instances.length}`);
    console.log(`🪝 Webhooks: ${cfg.webhooks.length}`);
    console.log();
    // Inicializa componentes de monitoramento
    const monitorConfig = cfg.monitor || { enabled: true, pollIntervalMs: 5000, enableProcessMetrics: true };
    if (monitorConfig.enabled) {
        // ServiceMonitor - monitora status dos serviços em background
        serviceMonitor = index_js_1.ServiceMonitor.getInstance({
            getEnvironments: () => getConfig().environments,
        }, {
            pollIntervalMs: monitorConfig.pollIntervalMs,
            enableProcessMetrics: monitorConfig.enableProcessMetrics,
        });
        // WebhookManager - dispara webhooks quando eventos ocorrem
        const agentId = crypto.createHash('md5').update(os.hostname()).digest('hex').substring(0, 8);
        webhookManager = index_js_1.WebhookManager.getInstance({
            getWebhooks: () => getConfig().webhooks,
            saveWebhooks: (webhooks) => config_store_js_1.daemonConfigStore.set({ webhooks }),
        }, {
            id: agentId,
            hostname: os.hostname(),
            version: VERSION,
        });
        // RealtimeServer - WebSocket para push em tempo real
        const wsPort = monitorConfig.wsPort || cfg.server.port + 1;
        realtimeServer = new index_js_1.RealtimeServer({
            validate: (token) => {
                const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
                const storedHash = cfg.auth.tokenHash || crypto.createHash('sha256').update(cfg.auth.token).digest('hex');
                return tokenHash === storedHash || token === cfg.auth.token;
            },
        }, {
            getSnapshot: (id) => serviceMonitor?.getSnapshot(id),
            getAllSnapshots: () => serviceMonitor?.getAllSnapshots() || [],
        });
        // Conecta eventos: ServiceMonitor -> WebhookManager + RealtimeServer
        serviceMonitor.onEvent((event) => {
            // Envia para WebSocket clients
            realtimeServer?.broadcast(event);
            // Dispara webhooks
            webhookManager?.dispatch(event);
        });
        // Inicia componentes
        serviceMonitor.start();
        realtimeServer.start(wsPort);
        console.log(`📡 Monitor: ativo (intervalo: ${monitorConfig.pollIntervalMs}ms)`);
        console.log(`🔌 WebSocket: ws://${cfg.server.host}:${wsPort}/ws`);
    }
    const server = await createServer();
    try {
        await server.listen({ port: cfg.server.port, host: cfg.server.host });
        console.log(`🚀 API rodando em http://${cfg.server.host}:${cfg.server.port}`);
        console.log(`📄 Documentação: http://${cfg.server.host}:${cfg.server.port}/docs`);
    }
    catch (error) {
        console.error('Erro ao iniciar servidor:', error);
        process.exit(1);
    }
    // Graceful shutdown
    const shutdown = async () => {
        console.log('\n🛑 Encerrando...');
        // Para componentes de monitoramento
        serviceMonitor?.stop();
        realtimeServer?.stop();
        // IMPORTANTE: Salva apenas se houve mudanças (isDirty)
        // NÃO força save para não sobrescrever mudanças feitas pela CLI
        config_store_js_1.daemonConfigStore.save();
        await server.close();
        process.exit(0);
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
}
main().catch(console.error);
//# sourceMappingURL=daemon.js.map