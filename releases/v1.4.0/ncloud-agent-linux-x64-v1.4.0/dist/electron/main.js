"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const crypto = __importStar(require("crypto"));
const child_process_1 = require("child_process");
const util_1 = require("util");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
const DEFAULT_CONFIG = {
    server: {
        port: 3100,
        host: '0.0.0.0',
    },
    auth: {
        token: 'NcloudAgent2026SecureToken32Ch',
    },
    services: [],
    components: [],
    instances: [],
    webhooks: [],
    scanPaths: ['C:\\TOTVS', 'D:\\TOTVS'],
    autoStart: true,
};
// ============================================================================
// VARIÁVEIS GLOBAIS
// ============================================================================
let mainWindow = null;
let tray = null;
let isQuitting = false;
let apiServer = null;
let config = { ...DEFAULT_CONFIG };
const runningProcesses = new Map();
const serviceStartTimes = new Map();
const CONFIG_FILE = path.join(electron_1.app.getPath('userData'), 'config.json');
// ============================================================================
// CONFIGURA�?�fO - CARREGAR/SALVAR
// ============================================================================
function loadConfig() {
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
            const loaded = JSON.parse(data);
            // Migração: environments (legado) -> services (v1.4.0)
            const services = loaded.services ?? loaded.environments ?? [];
            const hadLegacyField = !loaded.services && Array.isArray(loaded.environments);
            const result = {
                ...DEFAULT_CONFIG,
                ...loaded,
                services,
            };
            // Remove campo legado do objeto
            delete result.environments;
            // Auto-salva se migrou de legado
            if (hadLegacyField) {
                console.log('[Config] Migrando campo "environments" -> "services"');
                try {
                    fs.writeFileSync(CONFIG_FILE, JSON.stringify(result, null, 2), 'utf-8');
                }
                catch (e) {
                    console.error('[Config] Erro ao salvar migração:', e);
                }
            }
            return result;
        }
    }
    catch (error) {
        console.error('Erro ao carregar configuração:', error);
    }
    return { ...DEFAULT_CONFIG };
}
function saveConfig(newConfig) {
    try {
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(newConfig, null, 2), 'utf-8');
        config = newConfig;
        return true;
    }
    catch (error) {
        console.error('Erro ao salvar configuração:', error);
        return false;
    }
}
// ============================================================================
// PARSER DE INI
// ============================================================================
function parseIniFile(filePath) {
    try {
        if (!fs.existsSync(filePath))
            return null;
        const content = fs.readFileSync(filePath, 'utf-8');
        const result = {};
        let currentSection = 'general';
        const lines = content.split(/\r?\n/);
        for (const line of lines) {
            const trimmed = line.trim();
            // Ignora linhas vazias e comentários
            if (!trimmed || trimmed.startsWith(';') || trimmed.startsWith('#'))
                continue;
            // Seção [nome]
            const sectionMatch = trimmed.match(/^\[([^\]]+)\]$/);
            if (sectionMatch) {
                currentSection = sectionMatch[1].toLowerCase();
                if (!result[currentSection]) {
                    result[currentSection] = {};
                }
                continue;
            }
            // Chave=Valor
            const keyValueMatch = trimmed.match(/^([^=]+)=(.*)$/);
            if (keyValueMatch) {
                const key = keyValueMatch[1].trim().toLowerCase();
                const value = keyValueMatch[2].trim();
                if (!result[currentSection]) {
                    result[currentSection] = {};
                }
                result[currentSection][key] = value;
            }
        }
        return result;
    }
    catch (error) {
        console.error(`Erro ao parsear INI ${filePath}:`, error);
        return null;
    }
}
function getIniValue(ini, section, key) {
    if (!ini)
        return undefined;
    const sec = ini[section.toLowerCase()];
    if (!sec)
        return undefined;
    return sec[key.toLowerCase()];
}
// ============================================================================
// EXTRA�?�fO DE ENVIRONMENTS DO INI
// ============================================================================
/**
 * Extrai environments válidos de um arquivo INI
 * Um environment válido é uma seção que possui SourcePath E RootPath
 * Ignora seções comentadas (precedidas por ; ou #)
 */
function extractEnvironmentsFromIni(iniPath) {
    try {
        if (!fs.existsSync(iniPath))
            return [];
        const content = fs.readFileSync(iniPath, 'utf-8');
        const environments = [];
        const lines = content.split(/\r?\n/);
        let currentSection = '';
        let currentSectionOriginalName = '';
        let currentConfig = {};
        let isCommented = false;
        const processSection = () => {
            if (!currentSection || isCommented)
                return;
            // Verifica se tem SourcePath E RootPath (case insensitive)
            const sourcePath = currentConfig['sourcepath'];
            const rootPath = currentConfig['rootpath'];
            if (sourcePath && rootPath) {
                const env = {
                    name: currentSectionOriginalName,
                    sourcePath,
                    rootPath,
                    startPath: currentConfig['startpath'],
                    rpoCustom: currentConfig['rpocustom'],
                    rpoDb: currentConfig['rpodb'],
                    rpoLanguage: currentConfig['rpolanguage'],
                    rpoVersion: currentConfig['rpoversion'],
                    dbAlias: currentConfig['dbalias'],
                    dbServer: currentConfig['dbserver'],
                    dbDatabase: currentConfig['dbdatabase'],
                    dbPort: currentConfig['dbport'] ? parseInt(currentConfig['dbport'], 10) : undefined,
                    trace: currentConfig['trace'] === '1',
                    topMemoMega: currentConfig['topmemomega'] ? parseInt(currentConfig['topmemomega'], 10) : undefined,
                    startSysInDB: currentConfig['startsysindb'] === '1',
                    sqliteServer: currentConfig['sqliteserver'],
                    sqlitePort: currentConfig['sqliteport'] ? parseInt(currentConfig['sqliteport'], 10) : undefined,
                    fwLogMsgDebug: currentConfig['fwlogmsg_debug'] === '1',
                    rawConfig: { ...currentConfig },
                };
                environments.push(env);
            }
        };
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();
            // Ignora linhas vazias
            if (!trimmed)
                continue;
            // Verifica se é uma seção comentada
            // Formato: ;[NOME] ou ; [NOME] ou #[NOME]
            const commentedSectionMatch = trimmed.match(/^[;#]\s*\[([^\]]+)\]$/);
            if (commentedSectionMatch) {
                // Processa seção anterior antes de marcar como comentada
                processSection();
                currentSection = '';
                currentConfig = {};
                isCommented = true;
                continue;
            }
            // Verifica se é uma seção não comentada
            const sectionMatch = trimmed.match(/^\[([^\]]+)\]$/);
            if (sectionMatch) {
                // Processa seção anterior
                processSection();
                // Inicia nova seção
                currentSectionOriginalName = sectionMatch[1];
                currentSection = sectionMatch[1].toLowerCase();
                currentConfig = {};
                isCommented = false;
                continue;
            }
            // Se a linha começa com ; ou #, é um comentário - ignora
            if (trimmed.startsWith(';') || trimmed.startsWith('#')) {
                continue;
            }
            // Chave=Valor (dentro de uma seção não comentada)
            if (currentSection && !isCommented) {
                const keyValueMatch = trimmed.match(/^([^=]+)=(.*)$/);
                if (keyValueMatch) {
                    const key = keyValueMatch[1].trim().toLowerCase();
                    const value = keyValueMatch[2].trim();
                    currentConfig[key] = value;
                }
            }
        }
        // Processa última seção
        processSection();
        return environments;
    }
    catch (error) {
        console.error(`Erro ao extrair environments de ${iniPath}:`, error);
        return [];
    }
}
/**
 * Obtém os environments de um serviço específico
 */
function getServiceEnvironments(env) {
    return extractEnvironmentsFromIni(env.iniPath);
}
// ============================================================================
// GERENCIAMENTO DE PROCESSOS
// ============================================================================
async function checkPortInUse(port) {
    if (!port || port <= 0)
        return false;
    try {
        // Usa regex mais preciso para evitar falsos positivos (ex: :3100 não pegar :31000)
        const { stdout } = await execAsync(`netstat -ano | findstr ":${port} "`);
        const lines = stdout.trim().split('\n').filter(l => l.trim());
        // Verifica se alguma linha tem LISTENING ou ESTABLISHED na porta exata
        for (const line of lines) {
            // Padrão: TCP 0.0.0.0:3100 ou TCP [::]:3100
            const portPattern = new RegExp(`:${port}\\s+`, 'i');
            if (portPattern.test(line) && (line.includes('LISTENING') || line.includes('ESTABLISHED'))) {
                return true;
            }
        }
        return false;
    }
    catch {
        return false;
    }
}
async function getPidByPort(port) {
    if (!port || port <= 0)
        return undefined;
    try {
        const { stdout } = await execAsync(`netstat -ano | findstr ":${port} " | findstr LISTENING`);
        const lines = stdout.trim().split('\n').filter(l => l.trim());
        for (const line of lines) {
            // Verifica se a linha contém a porta exata
            const portPattern = new RegExp(`:${port}\\s+`, 'i');
            if (portPattern.test(line)) {
                const parts = line.trim().split(/\s+/);
                const pid = parseInt(parts[parts.length - 1], 10);
                if (!isNaN(pid) && pid > 0)
                    return pid;
            }
        }
    }
    catch {
        // Ignora
    }
    return undefined;
}
async function getProcessInfo(pid) {
    try {
        const { stdout } = await execAsync(`wmic process where ProcessId=${pid} get WorkingSetSize,PercentProcessorTime /format:csv`);
        const lines = stdout.trim().split('\n').filter(l => l.trim() && !l.startsWith('Node'));
        if (lines.length > 0) {
            const parts = lines[0].split(',');
            if (parts.length >= 3) {
                return {
                    cpu: parseFloat(parts[1]) || 0,
                    memory: Math.round((parseInt(parts[2], 10) || 0) / 1024 / 1024), // MB
                };
            }
        }
    }
    catch {
        // Ignora
    }
    return null;
}
async function getWindowsServiceName(iniPath) {
    try {
        const ini = parseIniFile(iniPath);
        if (ini) {
            // Procura o nome do serviço na seção [service]
            const serviceName = getIniValue(ini, 'service', 'name');
            if (serviceName)
                return serviceName;
        }
    }
    catch {
        // Ignora
    }
    return null;
}
// Verifica o status de um serviço Windows
async function getWindowsServiceStatus(serviceName) {
    try {
        const { stdout } = await execAsync(`sc query "${serviceName}"`, { timeout: 5000 });
        if (stdout.includes('RUNNING'))
            return 'running';
        if (stdout.includes('STOPPED'))
            return 'stopped';
        return 'unknown';
    }
    catch {
        return 'unknown';
    }
}
async function stopWindowsService(serviceName) {
    try {
        console.log(`Tentando parar serviço Windows: ${serviceName}`);
        const { stdout, stderr } = await execAsync(`net stop "${serviceName}"`, { timeout: 30000 });
        console.log(`net stop stdout: ${stdout}`);
        return { success: true };
    }
    catch (error) {
        console.error(`Erro ao parar serviço ${serviceName}:`, error.message);
        return { success: false, error: error.message || String(error) };
    }
}
async function startWindowsService(serviceName) {
    try {
        console.log(`Tentando iniciar serviço Windows: ${serviceName}`);
        const { stdout, stderr } = await execAsync(`net start "${serviceName}"`, { timeout: 30000 });
        console.log(`net start stdout: ${stdout}`);
        return { success: true };
    }
    catch (error) {
        console.error(`Erro ao iniciar serviço ${serviceName}:`, error.message);
        return { success: false, error: error.message || String(error) };
    }
}
async function killProcess(pid) {
    try {
        console.log(`Tentando matar processo PID ${pid}...`);
        const { stdout, stderr } = await execAsync(`taskkill /PID ${pid} /F`);
        console.log(`taskkill stdout: ${stdout}`);
        if (stderr)
            console.log(`taskkill stderr: ${stderr}`);
        return { success: true };
    }
    catch (error) {
        const errorMsg = error.message || String(error);
        console.error(`Erro ao matar processo ${pid}:`, errorMsg);
        // Verifica se é erro de acesso negado
        if (errorMsg.includes('Acesso negado') || errorMsg.includes('Access is denied')) {
            return { success: false, error: 'Acesso negado. Execute o Ncloud Agent como Administrador.' };
        }
        return { success: false, error: errorMsg };
    }
}
// ============================================================================
// CONTROLE DE SERVI�?OS
// ============================================================================
function detectServicePort(ini, serviceType) {
    if (!ini)
        return 0;
    // Tenta diferentes seções baseado no tipo de serviço
    const portSections = {
        'dbaccess': [
            ['general', 'port'],
            ['dbaccess', 'port'],
        ],
        'license': [
            ['licenseserver', 'port'],
            ['tcp', 'port'],
        ],
        'appserver': [
            ['tcp', 'port'],
            ['general', 'port'],
        ],
        'rest': [
            ['httprest', 'port'],
            ['tcp', 'port'],
        ],
    };
    const sections = portSections[serviceType] || portSections['appserver'];
    for (const [section, key] of sections) {
        const value = getIniValue(ini, section, key);
        if (value) {
            const port = parseInt(value, 10);
            if (port > 0)
                return port;
        }
    }
    return 0;
}
async function getServiceStatus(env) {
    let ini = parseIniFile(env.iniPath);
    const serviceType = env.type || 'appserver';
    // Para License Server, tenta também o appserver.ini se a porta não for encontrada
    let port = env.port || detectServicePort(ini, serviceType);
    if (port === 0 && serviceType === 'license') {
        const appserverIni = path.join(env.rootPath, 'appserver.ini');
        if (fs.existsSync(appserverIni)) {
            const altIni = parseIniFile(appserverIni);
            port = detectServicePort(altIni, serviceType);
            if (port > 0)
                ini = altIni; // Usa este INI para outras informações
        }
    }
    let status = {
        id: env.name,
        name: env.name,
        displayName: env.displayName,
        type: serviceType,
        status: 'stopped',
        port: port || undefined,
        path: env.rootPath,
        configFile: env.iniPath,
    };
    // Primeiro, verifica se é um serviço Windows
    const windowsServiceName = await getWindowsServiceName(env.iniPath);
    let isRunningViaWindowsService = false;
    if (windowsServiceName) {
        const winStatus = await getWindowsServiceStatus(windowsServiceName);
        if (winStatus === 'running') {
            isRunningViaWindowsService = true;
            status.status = 'running';
        }
        else if (winStatus === 'stopped') {
            // Serviço Windows está parado - define como stopped e retorna
            status.status = 'stopped';
            return status;
        }
    }
    // Verifica pela porta (seja serviço Windows ou não)
    if (port > 0) {
        const inUse = await checkPortInUse(port);
        if (inUse) {
            status.status = 'running';
            const pid = await getPidByPort(port);
            if (pid) {
                status.pid = pid;
                const procInfo = await getProcessInfo(pid);
                if (procInfo) {
                    status.memory = procInfo.memory;
                    status.cpu = procInfo.cpu;
                }
                // Uptime
                const startTime = serviceStartTimes.get(env.name);
                if (startTime) {
                    status.uptime = Math.floor((Date.now() - startTime) / 1000);
                }
            }
        }
        else if (!isRunningViaWindowsService) {
            // Porta não está em uso e não é serviço Windows rodando
            status.status = 'stopped';
        }
    }
    else if (!isRunningViaWindowsService) {
        // Sem porta configurada e não é serviço Windows
        // Tenta verificar se existe processo rodando via nome do executável
        status.status = 'stopped';
    }
    return status;
}
async function startService(env) {
    try {
        // Verifica se já está rodando
        const status = await getServiceStatus(env);
        if (status.status === 'running') {
            return { success: true, message: 'Serviço já está em execução', pid: status.pid };
        }
        // Primeiro, tenta iniciar como Serviço do Windows
        const serviceName = await getWindowsServiceName(env.iniPath);
        if (serviceName) {
            console.log(`Tentando iniciar via Windows Service: ${serviceName}`);
            const serviceResult = await startWindowsService(serviceName);
            if (serviceResult.success) {
                await new Promise(resolve => setTimeout(resolve, 5000));
                const newStatus = await getServiceStatus(env);
                if (newStatus.status === 'running') {
                    return { success: true, message: `Serviço Windows "${serviceName}" iniciado com sucesso`, pid: newStatus.pid };
                }
            }
            // Se falhou, tenta da forma tradicional
            console.log('Falha ao iniciar via Windows Service, tentando execução direta...');
        }
        // Determina o executável
        let executable = '';
        if (env.type === 'dbaccess') {
            executable = path.join(env.rootPath, 'dbaccess64.exe');
            if (!fs.existsSync(executable)) {
                executable = path.join(env.rootPath, 'dbaccess.exe');
            }
        }
        else {
            executable = path.join(env.rootPath, 'appserver.exe');
        }
        if (!fs.existsSync(executable)) {
            return { success: false, message: `Executável não encontrado: ${executable}` };
        }
        // Inicia o processo
        const child = (0, child_process_1.spawn)(executable, [], {
            cwd: env.rootPath,
            detached: true,
            stdio: 'ignore',
            windowsHide: true,
        });
        child.unref();
        // Registra o processo
        runningProcesses.set(env.name, child);
        serviceStartTimes.set(env.name, Date.now());
        // Aguarda um pouco e verifica se iniciou
        await new Promise(resolve => setTimeout(resolve, 5000));
        const newStatus = await getServiceStatus(env);
        if (newStatus.status === 'running') {
            return { success: true, message: 'Serviço iniciado com sucesso', pid: newStatus.pid };
        }
        return { success: false, message: 'Serviço iniciou mas não está respondendo na porta configurada. Verifique os logs.' };
    }
    catch (error) {
        return { success: false, message: `Erro ao iniciar serviço: ${error}` };
    }
}
async function stopService(env) {
    try {
        const status = await getServiceStatus(env);
        console.log(`stopService: status de ${env.name}:`, status);
        if (status.status === 'stopped') {
            return { success: true, message: 'Serviço já está parado' };
        }
        // Primeiro, tenta parar como Serviço do Windows
        const serviceName = await getWindowsServiceName(env.iniPath);
        if (serviceName) {
            console.log(`Tentando parar via Windows Service: ${serviceName}`);
            const serviceResult = await stopWindowsService(serviceName);
            if (serviceResult.success) {
                await new Promise(resolve => setTimeout(resolve, 3000));
                const newStatus = await getServiceStatus(env);
                if (newStatus.status === 'stopped') {
                    return { success: true, message: `Serviço Windows "${serviceName}" parado com sucesso` };
                }
            }
        }
        // Se não conseguiu via serviço, tenta via PID
        if (!status.pid) {
            return { success: false, message: `PID não encontrado. Tente parar o serviço manualmente pelo Gerenciador de Serviços do Windows.` };
        }
        const killResult = await killProcess(status.pid);
        if (killResult.success) {
            runningProcesses.delete(env.name);
            serviceStartTimes.delete(env.name);
            await new Promise(resolve => setTimeout(resolve, 2000));
            const newStatus = await getServiceStatus(env);
            if (newStatus.status === 'stopped') {
                return { success: true, message: 'Serviço parado com sucesso' };
            }
            else {
                return { success: false, message: 'Comando enviado mas serviço ainda está rodando.' };
            }
        }
        return { success: false, message: killResult.error || 'Não foi possível parar o serviço' };
    }
    catch (error) {
        console.error('Erro em stopService:', error);
        return { success: false, message: `Erro ao parar serviço: ${error}` };
    }
}
async function restartService(env) {
    const stopResult = await stopService(env);
    if (!stopResult.success && !stopResult.message.includes('já está parado')) {
        return stopResult;
    }
    // Aguarda um pouco antes de reiniciar
    await new Promise(resolve => setTimeout(resolve, 2000));
    return startService(env);
}
// ============================================================================
// NAVEGA�?�fO DE ARQUIVOS
// ============================================================================
function listDirectory(dirPath, showHidden = false) {
    try {
        if (!fs.existsSync(dirPath))
            return [];
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        const result = [];
        for (const entry of entries) {
            // Ignora arquivos ocultos se não solicitado
            if (!showHidden && entry.name.startsWith('.'))
                continue;
            const fullPath = path.join(dirPath, entry.name);
            try {
                const stats = fs.statSync(fullPath);
                result.push({
                    name: entry.name,
                    path: fullPath,
                    type: entry.isDirectory() ? 'directory' : 'file',
                    size: entry.isFile() ? stats.size : undefined,
                    modified: stats.mtime.toISOString(),
                    extension: entry.isFile() ? path.extname(entry.name).toLowerCase() : undefined,
                });
            }
            catch {
                // Ignora arquivos sem permissão
            }
        }
        // Ordena: diretórios primeiro, depois arquivos
        result.sort((a, b) => {
            if (a.type !== b.type) {
                return a.type === 'directory' ? -1 : 1;
            }
            return a.name.localeCompare(b.name);
        });
        return result;
    }
    catch (error) {
        console.error(`Erro ao listar diretório ${dirPath}:`, error);
        return [];
    }
}
function readFileContent(filePath, maxSize = 1024 * 1024) {
    try {
        if (!fs.existsSync(filePath))
            return null;
        const stats = fs.statSync(filePath);
        const truncated = stats.size > maxSize;
        if (truncated) {
            const fd = fs.openSync(filePath, 'r');
            const buffer = Buffer.alloc(maxSize);
            fs.readSync(fd, buffer, 0, maxSize, 0);
            fs.closeSync(fd);
            return { content: buffer.toString('utf-8'), truncated: true };
        }
        return { content: fs.readFileSync(filePath, 'utf-8'), truncated: false };
    }
    catch {
        return null;
    }
}
function getServiceDirectories(env) {
    const ini = parseIniFile(env.iniPath);
    const result = {
        binary: env.rootPath,
    };
    if (ini) {
        // Primeiro, tenta descobrir o nome do ambiente a partir do [General]
        const appEnvironment = getIniValue(ini, 'general', 'app_environment');
        // Lista de seções para procurar (em ordem de prioridade)
        const sectionsToCheck = [
            appEnvironment, // Nome do ambiente (ex: NEEWE)
            'environment', // Seção padrão
            'protheus',
            'server',
            Object.keys(ini).find(s => ini[s].sourcepath || ini[s].rootpath || ini[s].startpath), // Qualquer seção que tenha essas chaves
        ].filter(Boolean);
        // Procura em cada seção até encontrar os valores
        for (const section of sectionsToCheck) {
            if (!result.sourcePath) {
                const val = getIniValue(ini, section, 'sourcepath');
                if (val)
                    result.sourcePath = val;
            }
            if (!result.rpoCustom) {
                const val = getIniValue(ini, section, 'rpocustom');
                if (val)
                    result.rpoCustom = val;
            }
            if (!result.rootPath) {
                const val = getIniValue(ini, section, 'rootpath');
                if (val)
                    result.rootPath = val;
            }
            if (!result.startPath) {
                const val = getIniValue(ini, section, 'startpath');
                if (val)
                    result.startPath = val;
            }
        }
        // LogPath - geralmente em [General]
        const logPath = getIniValue(ini, 'general', 'logpath');
        if (logPath)
            result.logPath = logPath;
        // Guarda o nome do ambiente
        if (appEnvironment)
            result.environment = appEnvironment;
    }
    return result;
}
function detectAppServerType(iniPath) {
    try {
        const content = fs.readFileSync(iniPath, 'utf-8').toLowerCase();
        if (content.includes('httprest=1') || content.includes('[httprest]')) {
            return 'rest';
        }
        if (content.includes('job=') || content.includes('[onstart]')) {
            return 'job';
        }
        if (content.includes('soap=1') || content.includes('[webservices]')) {
            return 'soap';
        }
        return 'appserver';
    }
    catch {
        return 'other';
    }
}
function extractPortFromIni(iniPath) {
    try {
        const content = fs.readFileSync(iniPath, 'utf-8');
        const portMatch = content.match(/(?:TCP)?Port\s*=\s*(\d+)/i);
        if (portMatch) {
            return parseInt(portMatch[1], 10);
        }
    }
    catch {
        // Ignora
    }
    return undefined;
}
function scanDirectory(dirPath, depth = 0, maxDepth = 5) {
    const result = {
        appservers: [],
        dbaccess: [],
        licenses: [],
    };
    if (depth > maxDepth)
        return result;
    try {
        if (!fs.existsSync(dirPath))
            return result;
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        const files = entries.filter(e => e.isFile()).map(e => e.name.toLowerCase());
        const dirs = entries.filter(e => e.isDirectory());
        // Detecta AppServer
        if (files.includes('appserver.exe') && files.includes('appserver.ini')) {
            const iniPath = path.join(dirPath, 'appserver.ini');
            const isLicense = files.includes('licenseserver.ini') ||
                dirPath.toLowerCase().includes('license');
            if (isLicense) {
                const baseName = path.basename(dirPath).toLowerCase().replace(/\s+/g, '-');
                const parentName = path.basename(path.dirname(dirPath)).toLowerCase().replace(/\s+/g, '-');
                result.licenses.push({
                    type: 'license',
                    name: `license-${parentName}-${baseName}`,
                    displayName: `License Server - ${path.basename(path.dirname(dirPath))}`,
                    path: dirPath,
                    configFile: files.includes('licenseserver.ini')
                        ? path.join(dirPath, 'licenseserver.ini')
                        : iniPath,
                    executable: path.join(dirPath, 'appserver.exe'),
                    port: extractPortFromIni(iniPath),
                });
            }
            else {
                const folderName = path.basename(dirPath);
                const parentName = path.basename(path.dirname(dirPath));
                result.appservers.push({
                    type: 'appserver',
                    name: folderName.toLowerCase().replace(/\s+/g, '-'),
                    displayName: `${folderName} (${parentName})`,
                    path: dirPath,
                    configFile: iniPath,
                    executable: path.join(dirPath, 'appserver.exe'),
                    port: extractPortFromIni(iniPath),
                });
            }
        }
        // Detecta DbAccess
        if ((files.includes('dbaccess64.exe') || files.includes('dbaccess.exe')) &&
            files.includes('dbaccess.ini')) {
            const iniPath = path.join(dirPath, 'dbaccess.ini');
            result.dbaccess.push({
                type: 'dbaccess',
                name: path.basename(dirPath).toLowerCase().replace(/\s+/g, '-'),
                displayName: `DbAccess - ${path.basename(path.dirname(dirPath))}`,
                path: dirPath,
                configFile: iniPath,
                executable: path.join(dirPath, files.includes('dbaccess64.exe') ? 'dbaccess64.exe' : 'dbaccess.exe'),
                port: extractPortFromIni(iniPath),
            });
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
    catch (error) {
        console.error(`Erro ao escanear ${dirPath}:`, error);
    }
    return result;
}
function scanMultipleDirectories(directories) {
    const result = {
        appservers: [],
        dbaccess: [],
        licenses: [],
    };
    for (const dir of directories) {
        const subResult = scanDirectory(dir);
        result.appservers.push(...subResult.appservers);
        result.dbaccess.push(...subResult.dbaccess);
        result.licenses.push(...subResult.licenses);
    }
    // Remove duplicatas
    result.appservers = result.appservers.filter((v, i, a) => a.findIndex(t => t.path === v.path) === i);
    result.dbaccess = result.dbaccess.filter((v, i, a) => a.findIndex(t => t.path === v.path) === i);
    result.licenses = result.licenses.filter((v, i, a) => a.findIndex(t => t.path === v.path) === i);
    return result;
}
function getApiDocumentation() {
    const endpoints = [
        // Básicos
        {
            method: 'GET',
            path: '/health',
            description: 'Verifica se a API está funcionando',
            category: 'Básicos',
            response: { status: 'ok', version: '1.0.0', uptime: 0, timestamp: '' },
            statusCodes: [{ code: 200, description: 'API funcionando' }],
        },
        {
            method: 'GET',
            path: '/info',
            description: 'Informações do sistema',
            category: 'Básicos',
            response: { agentVersion: '', hostname: '', platform: '', arch: '', cpus: 0 },
            statusCodes: [{ code: 200, description: 'Sucesso' }],
        },
        {
            method: 'GET',
            path: '/metrics',
            description: 'Métricas de CPU, memória e sistema',
            category: 'Básicos',
            statusCodes: [{ code: 200, description: 'Sucesso' }],
        },
        // Instâncias
        {
            method: 'GET',
            path: '/instances',
            description: 'Lista todas as instâncias (grupos de serviços)',
            category: 'Instâncias',
            statusCodes: [{ code: 200, description: 'Lista de instâncias' }],
        },
        {
            method: 'GET',
            path: '/instances/:id',
            description: 'Detalhes de uma instância específica',
            category: 'Instâncias',
            params: [{ name: 'id', type: 'string', description: 'ID da instância', required: true }],
            statusCodes: [
                { code: 200, description: 'Detalhes da instância' },
                { code: 404, description: 'Instância não encontrada' },
            ],
        },
        {
            method: 'POST',
            path: '/instances',
            description: 'Cria uma nova instância',
            category: 'Instâncias',
            body: [
                { name: 'name', type: 'string', description: 'Nome identificador', required: true },
                { name: 'displayName', type: 'string', description: 'Nome de exibição', required: true },
                { name: 'type', type: 'InstanceType', description: 'DESENVOLVIMENTO | QA | PRODUCAO', required: true },
                { name: 'description', type: 'string', description: 'Descrição opcional' },
                { name: 'services', type: 'string[]', description: 'IDs dos serviços' },
            ],
            statusCodes: [
                { code: 200, description: 'Instância criada' },
                { code: 400, description: 'Dados inválidos' },
            ],
        },
        {
            method: 'PUT',
            path: '/instances/:id',
            description: 'Atualiza uma instância',
            category: 'Instâncias',
            params: [{ name: 'id', type: 'string', description: 'ID da instância', required: true }],
            statusCodes: [
                { code: 200, description: 'Instância atualizada' },
                { code: 404, description: 'Instância não encontrada' },
            ],
        },
        {
            method: 'DELETE',
            path: '/instances/:id',
            description: 'Remove uma instância',
            category: 'Instâncias',
            params: [{ name: 'id', type: 'string', description: 'ID da instância', required: true }],
            statusCodes: [
                { code: 200, description: 'Instância removida' },
                { code: 404, description: 'Instância não encontrada' },
            ],
        },
        {
            method: 'GET',
            path: '/instances/:id/services',
            description: 'Lista serviços de uma instância',
            category: 'Instâncias',
            params: [{ name: 'id', type: 'string', description: 'ID da instância', required: true }],
            statusCodes: [{ code: 200, description: 'Lista de serviços' }],
        },
        {
            method: 'POST',
            path: '/instances/:id/services/:serviceId',
            description: 'Adiciona serviço a uma instância',
            category: 'Instâncias',
            params: [
                { name: 'id', type: 'string', description: 'ID da instância', required: true },
                { name: 'serviceId', type: 'string', description: 'ID do serviço', required: true },
            ],
            statusCodes: [{ code: 200, description: 'Serviço adicionado' }],
        },
        {
            method: 'DELETE',
            path: '/instances/:id/services/:serviceId',
            description: 'Remove serviço de uma instância',
            category: 'Instâncias',
            params: [
                { name: 'id', type: 'string', description: 'ID da instância', required: true },
                { name: 'serviceId', type: 'string', description: 'ID do serviço', required: true },
            ],
            statusCodes: [{ code: 200, description: 'Serviço removido' }],
        },
        {
            method: 'POST',
            path: '/instances/:id/start-all',
            description: 'Inicia todos os serviços de uma instância',
            category: 'Instâncias',
            params: [{ name: 'id', type: 'string', description: 'ID da instância', required: true }],
            statusCodes: [{ code: 200, description: 'Resultado das operações' }],
        },
        {
            method: 'POST',
            path: '/instances/:id/stop-all',
            description: 'Para todos os serviços de uma instância',
            category: 'Instâncias',
            params: [{ name: 'id', type: 'string', description: 'ID da instância', required: true }],
            statusCodes: [{ code: 200, description: 'Resultado das operações' }],
        },
        // Serviços
        {
            method: 'GET',
            path: '/services',
            description: 'Lista todos os serviços com status',
            category: 'Serviços',
            statusCodes: [{ code: 200, description: 'Lista de serviços' }],
        },
        {
            method: 'GET',
            path: '/services/:id',
            description: 'Status de um serviço específico',
            category: 'Serviços',
            params: [{ name: 'id', type: 'string', description: 'ID do serviço', required: true }],
            statusCodes: [{ code: 200, description: 'Status do serviço' }],
        },
        {
            method: 'POST',
            path: '/services/:id/start',
            description: 'Inicia um serviço',
            category: 'Serviços',
            params: [{ name: 'id', type: 'string', description: 'ID do serviço', required: true }],
            statusCodes: [{ code: 200, description: 'Resultado da operação' }],
        },
        {
            method: 'POST',
            path: '/services/:id/stop',
            description: 'Para um serviço',
            category: 'Serviços',
            params: [{ name: 'id', type: 'string', description: 'ID do serviço', required: true }],
            statusCodes: [{ code: 200, description: 'Resultado da operação' }],
        },
        {
            method: 'POST',
            path: '/services/:id/restart',
            description: 'Reinicia um serviço',
            category: 'Serviços',
            params: [{ name: 'id', type: 'string', description: 'ID do serviço', required: true }],
            statusCodes: [{ code: 200, description: 'Resultado da operação' }],
        },
        {
            method: 'GET',
            path: '/services/:id/directories',
            description: 'Diretórios configurados de um serviço',
            category: 'Serviços',
            params: [{ name: 'id', type: 'string', description: 'ID do serviço', required: true }],
            statusCodes: [{ code: 200, description: 'Diretórios do serviço' }],
        },
        {
            method: 'GET',
            path: '/services/:id/config',
            description: 'Configuração INI de um serviço',
            category: 'Serviços',
            params: [{ name: 'id', type: 'string', description: 'ID do serviço', required: true }],
            statusCodes: [{ code: 200, description: 'Configuração INI' }],
        },
        // Environments do INI
        {
            method: 'GET',
            path: '/services/:id/environments',
            description: 'Lista environments detectados no INI de um serviço',
            category: 'Environments',
            params: [{ name: 'id', type: 'string', description: 'ID do serviço', required: true }],
            statusCodes: [{ code: 200, description: 'Lista de environments' }],
        },
        {
            method: 'GET',
            path: '/services/:id/environments/:envName',
            description: 'Detalhes de um environment específico',
            category: 'Environments',
            params: [
                { name: 'id', type: 'string', description: 'ID do serviço', required: true },
                { name: 'envName', type: 'string', description: 'Nome do environment', required: true },
            ],
            statusCodes: [{ code: 200, description: 'Detalhes do environment' }],
        },
        {
            method: 'GET',
            path: '/environments/scan/:serviceId',
            description: 'Re-escaneia environments de um serviço',
            category: 'Environments',
            params: [{ name: 'serviceId', type: 'string', description: 'ID do serviço', required: true }],
            statusCodes: [{ code: 200, description: 'Environments encontrados' }],
        },
        {
            method: 'GET',
            path: '/environments/all',
            description: 'Lista todos os environments de todos os serviços',
            category: 'Environments',
            statusCodes: [{ code: 200, description: 'Todos os environments' }],
        },
        // Navegação de Arquivos
        {
            method: 'GET',
            path: '/files',
            description: 'Lista conteúdo de um diretório',
            category: 'Arquivos',
            queryParams: [
                { name: 'path', type: 'string', description: 'Caminho do diretório' },
                { name: 'showHidden', type: 'boolean', description: 'Mostrar arquivos ocultos' },
            ],
            statusCodes: [{ code: 200, description: 'Lista de arquivos' }],
        },
        {
            method: 'GET',
            path: '/files/content',
            description: 'Lê conteúdo de um arquivo',
            category: 'Arquivos',
            queryParams: [
                { name: 'path', type: 'string', description: 'Caminho do arquivo' },
                { name: 'maxSize', type: 'number', description: 'Tamanho máximo (bytes)' },
            ],
            statusCodes: [{ code: 200, description: 'Conteúdo do arquivo' }],
        },
        {
            method: 'GET',
            path: '/services/:id/files',
            description: 'Navega diretórios de um serviço',
            category: 'Arquivos',
            params: [{ name: 'id', type: 'string', description: 'ID do serviço', required: true }],
            queryParams: [
                { name: 'type', type: 'string', description: 'Tipo: binary, sourcepath, rpocustom, rootpath, log' },
                { name: 'subpath', type: 'string', description: 'Subdiretório' },
            ],
            statusCodes: [{ code: 200, description: 'Arquivos do serviço' }],
        },
    ];
    return {
        version: '1.0.0',
        baseUrl: `http://localhost:${config.server.port}`,
        endpoints,
    };
}
function generateApiDocsHtml() {
    const docs = getApiDocumentation();
    const methodColors = {
        GET: '#107c10',
        POST: '#045b8f',
        PUT: '#f7630c',
        DELETE: '#c42b1c',
    };
    const categories = [...new Set(docs.endpoints.map(e => e.category))];
    const endpointsByCategory = categories.map(cat => ({
        category: cat,
        endpoints: docs.endpoints.filter(e => e.category === cat),
    }));
    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ncloud Agent API - Documentação</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', system-ui, sans-serif;
      background: #f5f5f5;
      color: #1a1a1a;
      line-height: 1.6;
    }
    .header {
      background: linear-gradient(135deg, #045b8f, #0a7ab8);
      color: white;
      padding: 32px;
      text-align: center;
    }
    .header h1 { font-size: 28px; margin-bottom: 8px; }
    .header p { opacity: 0.9; }
    .container { max-width: 1200px; margin: 0 auto; padding: 24px; }
    .info-box {
      background: white;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 24px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .info-box h3 { color: #045b8f; margin-bottom: 12px; }
    .info-box code {
      background: #f0f0f0;
      padding: 4px 8px;
      border-radius: 4px;
      font-family: 'Consolas', monospace;
    }
    .category {
      background: white;
      border-radius: 8px;
      margin-bottom: 24px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      overflow: hidden;
    }
    .category-header {
      background: #f5f5f5;
      padding: 16px 20px;
      font-weight: 600;
      font-size: 18px;
      border-bottom: 1px solid #e5e5e5;
    }
    .endpoint {
      border-bottom: 1px solid #e5e5e5;
      padding: 16px 20px;
    }
    .endpoint:last-child { border-bottom: none; }
    .endpoint-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 8px;
    }
    .method {
      padding: 4px 12px;
      border-radius: 4px;
      font-weight: 600;
      font-size: 12px;
      color: white;
      min-width: 70px;
      text-align: center;
    }
    .path {
      font-family: 'Consolas', monospace;
      font-size: 14px;
      color: #333;
    }
    .description {
      color: #666;
      font-size: 14px;
      margin-bottom: 12px;
    }
    .params {
      background: #f9f9f9;
      border-radius: 6px;
      padding: 12px;
      margin-top: 12px;
    }
    .params-title {
      font-size: 12px;
      font-weight: 600;
      color: #666;
      margin-bottom: 8px;
      text-transform: uppercase;
    }
    .param {
      display: flex;
      gap: 8px;
      font-size: 13px;
      margin-bottom: 4px;
    }
    .param-name {
      font-family: 'Consolas', monospace;
      color: #045b8f;
    }
    .param-type {
      color: #f7630c;
      font-size: 12px;
    }
    .param-required {
      color: #c42b1c;
      font-size: 11px;
    }
    .status-codes {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-top: 8px;
    }
    .status-code {
      font-size: 12px;
      padding: 2px 8px;
      border-radius: 4px;
      background: #e5e5e5;
    }
    .status-code.success { background: #dff6dd; color: #107c10; }
    .status-code.error { background: #fde7e9; color: #c42b1c; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Ncloud Agent API</h1>
    <p>Documentação da API REST - v${docs.version}</p>
  </div>
  
  <div class="container">
    <div class="info-box">
      <h3>Informações</h3>
      <p><strong>Base URL:</strong> <code>${docs.baseUrl}</code></p>
      <p style="margin-top:8px"><strong>Autenticação:</strong> Bearer Token no header <code>Authorization: Bearer &lt;token&gt;</code></p>
      <p style="margin-top:8px"><strong>Endpoints públicos:</strong> <code>/health</code>, <code>/docs</code></p>
    </div>
    
    ${endpointsByCategory.map(cat => `
    <div class="category">
      <div class="category-header">${cat.category}</div>
      ${cat.endpoints.map(ep => `
      <div class="endpoint">
        <div class="endpoint-header">
          <span class="method" style="background:${methodColors[ep.method]}">${ep.method}</span>
          <span class="path">${ep.path}</span>
        </div>
        <div class="description">${ep.description}</div>
        ${ep.params && ep.params.length > 0 ? `
        <div class="params">
          <div class="params-title">Parâmetros de URL</div>
          ${ep.params.map(p => `
          <div class="param">
            <span class="param-name">${p.name}</span>
            <span class="param-type">${p.type}</span>
            ${p.required ? '<span class="param-required">obrigatório</span>' : ''}
            <span>- ${p.description}</span>
          </div>
          `).join('')}
        </div>
        ` : ''}
        ${ep.queryParams && ep.queryParams.length > 0 ? `
        <div class="params">
          <div class="params-title">Query Parameters</div>
          ${ep.queryParams.map(p => `
          <div class="param">
            <span class="param-name">${p.name}</span>
            <span class="param-type">${p.type}</span>
            <span>- ${p.description}</span>
          </div>
          `).join('')}
        </div>
        ` : ''}
        ${ep.body && ep.body.length > 0 ? `
        <div class="params">
          <div class="params-title">Body (JSON)</div>
          ${ep.body.map(p => `
          <div class="param">
            <span class="param-name">${p.name}</span>
            <span class="param-type">${p.type}</span>
            ${p.required ? '<span class="param-required">obrigatório</span>' : ''}
            <span>- ${p.description}</span>
          </div>
          `).join('')}
        </div>
        ` : ''}
        ${ep.statusCodes && ep.statusCodes.length > 0 ? `
        <div class="status-codes">
          ${ep.statusCodes.map(s => `
          <span class="status-code ${s.code < 400 ? 'success' : 'error'}">${s.code} ${s.description}</span>
          `).join('')}
        </div>
        ` : ''}
      </div>
      `).join('')}
    </div>
    `).join('')}
  </div>
</body>
</html>`;
}
// ============================================================================
// HELPERS DE MÉTRICAS DO SISTEMA
// ============================================================================
async function getDiskInfo() {
    const disks = [];
    try {
        if (process.platform === 'win32') {
            const { stdout } = await execAsync('wmic logicaldisk get DeviceID,Size,FreeSpace,VolumeName,FileSystem /format:csv', { timeout: 8000 });
            const lines = stdout.trim().split(/\r?\n/).filter(l => l.trim() && !l.startsWith('Node'));
            for (const line of lines) {
                const parts = line.split(',');
                // CSV: Node,DeviceID,FileSystem,FreeSpace,Size,VolumeName
                if (parts.length < 6)
                    continue;
                const deviceId = parts[1]?.trim();
                const fileSystem = parts[2]?.trim() || undefined;
                const free = parseInt(parts[3]?.trim() || '0', 10) || 0;
                const total = parseInt(parts[4]?.trim() || '0', 10) || 0;
                const label = parts[5]?.trim() || undefined;
                if (!deviceId || total === 0)
                    continue;
                const used = total - free;
                disks.push({
                    mountPoint: deviceId + '\\',
                    label: label || undefined,
                    fileSystem: fileSystem || undefined,
                    total,
                    used,
                    free,
                    usagePercent: Math.round((used / total) * 100),
                });
            }
        }
        else {
            // Linux/macOS: df -B1 (bytes)
            const { stdout } = await execAsync("df -B1 --output=source,fstype,size,used,avail,target | tail -n +2", { timeout: 8000 });
            const lines = stdout.trim().split(/\r?\n/).filter(l => l.trim());
            for (const line of lines) {
                const parts = line.trim().split(/\s+/);
                if (parts.length < 6)
                    continue;
                const source = parts[0];
                const fstype = parts[1];
                const total = parseInt(parts[2], 10) || 0;
                const used = parseInt(parts[3], 10) || 0;
                const free = parseInt(parts[4], 10) || 0;
                const mountPoint = parts[5];
                // Filtra sistemas de arquivo virtuais
                if (!source || source.startsWith('tmpfs') || source.startsWith('devtmpfs') ||
                    source.startsWith('udev') || source === 'none' || total === 0)
                    continue;
                disks.push({
                    mountPoint,
                    fileSystem: fstype || undefined,
                    total,
                    used,
                    free,
                    usagePercent: Math.round((used / total) * 100),
                });
            }
        }
    }
    catch (e) {
        console.error('[getDiskInfo] Erro:', e);
    }
    return disks;
}
async function getCpuUsage() {
    const os = await Promise.resolve().then(() => __importStar(require('os')));
    function snapshot() {
        return os.cpus().map(cpu => {
            const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
            return { idle: cpu.times.idle, total };
        });
    }
    const snap1 = snapshot();
    await new Promise(resolve => setTimeout(resolve, 500));
    const snap2 = snapshot();
    const perCoreUsage = snap1.map((s1, i) => {
        const s2 = snap2[i];
        const totalDiff = s2.total - s1.total;
        const idleDiff = s2.idle - s1.idle;
        if (totalDiff === 0)
            return 0;
        return Math.round(((totalDiff - idleDiff) / totalDiff) * 100);
    });
    const usagePercent = Math.round(perCoreUsage.reduce((a, b) => a + b, 0) / perCoreUsage.length);
    return { usagePercent, perCoreUsage };
}
function getNetworkInfo() {
    const os = require('os');
    const interfaces = os.networkInterfaces();
    const result = [];
    for (const [name, addrs] of Object.entries(interfaces)) {
        if (!addrs || addrs.length === 0)
            continue;
        const ipv4 = addrs.find(a => a.family === 'IPv4' && !a.internal)?.address;
        const ipv6 = addrs.find(a => a.family === 'IPv6' && !a.internal)?.address;
        const ipv4Internal = addrs.find(a => a.family === 'IPv4' && a.internal)?.address;
        const mac = addrs[0]?.mac;
        const isInternal = addrs.every(a => a.internal);
        // Só inclui interfaces com ao menos um IP
        if (!ipv4 && !ipv6 && !ipv4Internal)
            continue;
        result.push({
            name,
            ipv4: ipv4 || ipv4Internal,
            ipv6: ipv6 || undefined,
            mac: mac && mac !== '00:00:00:00:00:00' ? mac : undefined,
            internal: isInternal,
        });
    }
    return result;
}
async function getOsVersionDetails() {
    try {
        if (process.platform === 'win32') {
            const { stdout } = await execAsync('wmic os get Caption /format:csv', { timeout: 5000 });
            const lines = stdout.trim().split(/\r?\n/).filter(l => l.trim() && !l.startsWith('Node'));
            if (lines.length > 0) {
                const caption = lines[0].split(',')[1]?.trim();
                if (caption)
                    return caption;
            }
        }
        else {
            // Linux: lê /etc/os-release
            if (fs.existsSync('/etc/os-release')) {
                const content = fs.readFileSync('/etc/os-release', 'utf-8');
                const prettyMatch = content.match(/^PRETTY_NAME="?([^"\n]+)"?/m);
                if (prettyMatch)
                    return prettyMatch[1];
            }
        }
    }
    catch (e) {
        // Fallback silencioso
    }
    const os = require('os');
    return `${os.type()} ${os.release()}`;
}
function formatUptime(seconds) {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const parts = [];
    if (d > 0)
        parts.push(`${d}d`);
    if (h > 0)
        parts.push(`${h}h`);
    parts.push(`${m}m`);
    return parts.join(' ');
}
// ============================================================================
// API SERVER (EMBARCADO)
// ============================================================================
async function startApiServer() {
    if (apiServer) {
        console.log('API já está rodando');
        return true;
    }
    try {
        const Fastify = (await Promise.resolve().then(() => __importStar(require('fastify')))).default;
        const os = await Promise.resolve().then(() => __importStar(require('os')));
        apiServer = Fastify({ logger: false });
        // Middleware de autenticação
        apiServer.addHook('onRequest', async (request, reply) => {
            const publicRoutes = ['/health', '/health/', '/docs', '/docs/', '/docs/json'];
            if (publicRoutes.includes(request.url.split('?')[0])) {
                return;
            }
            const authHeader = request.headers.authorization;
            if (!authHeader) {
                return reply.status(401).send({ error: 'Unauthorized', message: 'Token não fornecido' });
            }
            const [type, token] = authHeader.split(' ');
            if (type !== 'Bearer' || token !== config.auth.token) {
                return reply.status(401).send({ error: 'Unauthorized', message: 'Token inválido' });
            }
        });
        // ==================== ENDPOINTS BÁSICOS ====================
        apiServer.get('/health', async () => ({
            status: 'ok',
            version: '1.0.0',
            uptime: process.uptime(),
            timestamp: new Date().toISOString(),
        }));
        // ==================== DOCUMENTA�?�fO DA API ====================
        // Schema JSON da API
        apiServer.get('/docs/json', async () => {
            return getApiDocumentation();
        });
        // Página HTML de documentação estilo Swagger
        apiServer.get('/docs', async (request, reply) => {
            const html = generateApiDocsHtml();
            reply.header('Content-Type', 'text/html');
            return html;
        });
        apiServer.get('/info', async () => {
            const [osVersion, disks] = await Promise.all([
                getOsVersionDetails(),
                getDiskInfo(),
            ]);
            const network = getNetworkInfo();
            const cpuList = os.cpus();
            const totalMemory = os.totalmem();
            const freeMemory = os.freemem();
            const usedMemory = totalMemory - freeMemory;
            const uptimeSec = os.uptime();
            let processUser = 'unknown';
            try {
                processUser = os.userInfo().username;
            }
            catch { }
            return {
                agentVersion: '1.4.0',
                hostname: os.hostname(),
                platform: process.platform,
                arch: os.arch(),
                osType: os.type(),
                osRelease: os.release(),
                osVersion,
                cpuModel: cpuList[0]?.model || 'Unknown',
                cpuCores: cpuList.length,
                cpuLogicalCores: cpuList.length,
                totalMemory,
                freeMemory,
                usedMemory,
                memoryUsagePercent: Math.round((usedMemory / totalMemory) * 100),
                nodeVersion: process.version,
                uptime: uptimeSec,
                uptimeFormatted: formatUptime(uptimeSec),
                processUser,
                network,
                disks,
            };
        });
        apiServer.get('/metrics', async () => {
            const [cpuUsage, disks] = await Promise.all([
                getCpuUsage(),
                getDiskInfo(),
            ]);
            const cpus = os.cpus();
            const totalMem = os.totalmem();
            const freeMem = os.freemem();
            const usedMem = totalMem - freeMem;
            const network = getNetworkInfo();
            return {
                timestamp: new Date().toISOString(),
                cpu: {
                    cores: cpus.length,
                    logicalCores: cpus.length,
                    model: cpus[0]?.model || 'Unknown',
                    usagePercent: cpuUsage.usagePercent,
                    perCoreUsage: cpuUsage.perCoreUsage,
                },
                memory: {
                    total: totalMem,
                    used: usedMem,
                    free: freeMem,
                    usagePercent: Math.round((usedMem / totalMem) * 100),
                },
                disks,
                network: {
                    interfaces: network,
                },
                system: {
                    uptime: os.uptime(),
                    uptimeFormatted: formatUptime(os.uptime()),
                    hostname: os.hostname(),
                    platform: process.platform,
                },
            };
        });
        // ==================== INST�,NCIAS ====================
        // Lista todas as instâncias
        apiServer.get('/instances', async () => {
            const instancesWithStats = await Promise.all(config.instances.map(async (inst) => {
                const services = config.services.filter(e => inst.services.includes(e.name));
                let runningCount = 0;
                for (const svc of services) {
                    const status = await getServiceStatus(svc);
                    if (status.status === 'running')
                        runningCount++;
                }
                return {
                    ...inst,
                    serviceCount: services.length,
                    runningServices: runningCount,
                };
            }));
            return {
                instances: instancesWithStats,
                total: config.instances.length,
            };
        });
        // Detalhes de uma instância
        apiServer.get('/instances/:id', async (request, reply) => {
            const { id } = request.params;
            const instance = config.instances.find(i => i.id === id);
            if (!instance) {
                return reply.status(404).send({ error: 'Instância não encontrada' });
            }
            const services = config.services.filter(e => instance.services.includes(e.name));
            const servicesStatus = await Promise.all(services.map(svc => getServiceStatus(svc)));
            return {
                ...instance,
                servicesDetails: servicesStatus,
            };
        });
        // Cria nova instância
        apiServer.post('/instances', async (request, reply) => {
            const { name, displayName, type, description, services = [] } = request.body;
            if (!name || !displayName || !type) {
                return reply.status(400).send({ error: 'Campos obrigatórios: name, displayName, type' });
            }
            if (!['DESENVOLVIMENTO', 'QA', 'PRODUCAO'].includes(type)) {
                return reply.status(400).send({ error: 'Tipo inválido. Use: DESENVOLVIMENTO, QA ou PRODUCAO' });
            }
            const id = `inst-${name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;
            const newInstance = {
                id,
                name,
                displayName,
                type,
                description,
                services,
                createdAt: new Date().toISOString(),
                enabled: true,
            };
            config.instances.push(newInstance);
            saveConfig(config);
            return { success: true, instance: newInstance };
        });
        // Atualiza instância
        apiServer.put('/instances/:id', async (request, reply) => {
            const { id } = request.params;
            const updates = request.body;
            const index = config.instances.findIndex(i => i.id === id);
            if (index < 0) {
                return reply.status(404).send({ error: 'Instância não encontrada' });
            }
            // Não permite alterar id e createdAt
            delete updates.id;
            delete updates.createdAt;
            config.instances[index] = { ...config.instances[index], ...updates };
            saveConfig(config);
            return { success: true, instance: config.instances[index] };
        });
        // Remove instância
        apiServer.delete('/instances/:id', async (request, reply) => {
            const { id } = request.params;
            const index = config.instances.findIndex(i => i.id === id);
            if (index < 0) {
                return reply.status(404).send({ error: 'Instância não encontrada' });
            }
            // Remove a referência de instanceId dos environments
            config.services.forEach(env => {
                if (env.instanceId === id) {
                    env.instanceId = undefined;
                }
            });
            config.instances.splice(index, 1);
            saveConfig(config);
            return { success: true, message: 'Instância removida' };
        });
        // Lista serviços de uma instância
        apiServer.get('/instances/:id/services', async (request, reply) => {
            const { id } = request.params;
            const instance = config.instances.find(i => i.id === id);
            if (!instance) {
                return reply.status(404).send({ error: 'Instância não encontrada' });
            }
            const services = config.services.filter(e => instance.services.includes(e.name));
            const servicesStatus = await Promise.all(services.map(svc => getServiceStatus(svc)));
            return {
                instanceId: id,
                services: servicesStatus,
            };
        });
        // Adiciona serviço a uma instância
        apiServer.post('/instances/:id/services/:serviceId', async (request, reply) => {
            const { id, serviceId } = request.params;
            const instance = config.instances.find(i => i.id === id);
            if (!instance) {
                return reply.status(404).send({ error: 'Instância não encontrada' });
            }
            const service = config.services.find(e => e.name === serviceId);
            if (!service) {
                return reply.status(404).send({ error: 'Serviço não encontrado' });
            }
            if (!instance.services.includes(serviceId)) {
                instance.services.push(serviceId);
                service.instanceId = id;
                saveConfig(config);
            }
            return { success: true, message: 'Serviço adicionado à instância' };
        });
        // Remove serviço de uma instância
        apiServer.delete('/instances/:id/services/:serviceId', async (request, reply) => {
            const { id, serviceId } = request.params;
            const instance = config.instances.find(i => i.id === id);
            if (!instance) {
                return reply.status(404).send({ error: 'Instância não encontrada' });
            }
            const serviceIndex = instance.services.indexOf(serviceId);
            if (serviceIndex >= 0) {
                instance.services.splice(serviceIndex, 1);
                const service = config.services.find(e => e.name === serviceId);
                if (service) {
                    service.instanceId = undefined;
                }
                saveConfig(config);
            }
            return { success: true, message: 'Serviço removido da instância' };
        });
        // Inicia todos os serviços de uma instância
        apiServer.post('/instances/:id/start-all', async (request, reply) => {
            const { id } = request.params;
            const instance = config.instances.find(i => i.id === id);
            if (!instance) {
                return reply.status(404).send({ error: 'Instância não encontrada' });
            }
            const results = [];
            for (const serviceName of instance.services) {
                const service = config.services.find(e => e.name === serviceName);
                if (service) {
                    const result = await startService(service);
                    results.push({ service: serviceName, success: result.success, message: result.message });
                }
            }
            return {
                instanceId: id,
                results,
                summary: {
                    total: results.length,
                    success: results.filter(r => r.success).length,
                    failed: results.filter(r => !r.success).length,
                },
            };
        });
        // Para todos os serviços de uma instância
        apiServer.post('/instances/:id/stop-all', async (request, reply) => {
            const { id } = request.params;
            const instance = config.instances.find(i => i.id === id);
            if (!instance) {
                return reply.status(404).send({ error: 'Instância não encontrada' });
            }
            const results = [];
            for (const serviceName of instance.services) {
                const service = config.services.find(e => e.name === serviceName);
                if (service) {
                    const result = await stopService(service);
                    results.push({ service: serviceName, success: result.success, message: result.message });
                }
            }
            return {
                instanceId: id,
                results,
                summary: {
                    total: results.length,
                    success: results.filter(r => r.success).length,
                    failed: results.filter(r => !r.success).length,
                },
            };
        });
        // ==================== SERVI�?OS ====================
        // Lista todos os serviços com status
        apiServer.get('/services', async () => {
            const services = [];
            for (const env of config.services.filter(e => e.enabled)) {
                const status = await getServiceStatus(env);
                services.push(status);
            }
            const running = services.filter(s => s.status === 'running').length;
            return {
                services,
                summary: {
                    total: services.length,
                    running,
                    stopped: services.length - running,
                },
            };
        });
        // Status de um serviço específico
        apiServer.get('/services/:id', async (request, reply) => {
            const { id } = request.params;
            const env = config.services.find(e => e.name === id && e.enabled);
            if (!env) {
                return reply.status(404).send({ error: 'Serviço não encontrado' });
            }
            return getServiceStatus(env);
        });
        // Iniciar serviço
        apiServer.post('/services/:id/start', async (request, reply) => {
            const { id } = request.params;
            const env = config.services.find(e => e.name === id && e.enabled);
            if (!env) {
                return reply.status(404).send({ error: 'Serviço não encontrado' });
            }
            return startService(env);
        });
        // Parar serviço
        apiServer.post('/services/:id/stop', async (request, reply) => {
            const { id } = request.params;
            const env = config.services.find(e => e.name === id && e.enabled);
            if (!env) {
                return reply.status(404).send({ error: 'Serviço não encontrado' });
            }
            return stopService(env);
        });
        // Reiniciar serviço
        apiServer.post('/services/:id/restart', async (request, reply) => {
            const { id } = request.params;
            const env = config.services.find(e => e.name === id && e.enabled);
            if (!env) {
                return reply.status(404).send({ error: 'Serviço não encontrado' });
            }
            return restartService(env);
        });
        // Diretórios do serviço
        apiServer.get('/services/:id/directories', async (request, reply) => {
            const { id } = request.params;
            const env = config.services.find(e => e.name === id && e.enabled);
            if (!env) {
                return reply.status(404).send({ error: 'Serviço não encontrado' });
            }
            return getServiceDirectories(env);
        });
        // Configuração INI do serviço
        apiServer.get('/services/:id/config', async (request, reply) => {
            const { id } = request.params;
            const env = config.services.find(e => e.name === id && e.enabled);
            if (!env) {
                return reply.status(404).send({ error: 'Serviço não encontrado' });
            }
            const ini = parseIniFile(env.iniPath);
            if (!ini) {
                return reply.status(404).send({ error: 'Arquivo de configuração não encontrado' });
            }
            return {
                path: env.iniPath,
                config: ini,
            };
        });
        // ==================== ENVIRONMENTS DO INI ====================
        // Lista environments detectados no INI de um serviço
        apiServer.get('/services/:id/environments', async (request, reply) => {
            const { id } = request.params;
            const env = config.services.find(e => e.name === id);
            if (!env) {
                return reply.status(404).send({ error: 'Serviço não encontrado' });
            }
            const environments = extractEnvironmentsFromIni(env.iniPath);
            return {
                serviceId: id,
                serviceName: env.displayName,
                iniPath: env.iniPath,
                environments,
                total: environments.length,
            };
        });
        // Detalhes de um environment específico do INI
        apiServer.get('/services/:id/environments/:envName', async (request, reply) => {
            const { id, envName } = request.params;
            const env = config.services.find(e => e.name === id);
            if (!env) {
                return reply.status(404).send({ error: 'Serviço não encontrado' });
            }
            const environments = extractEnvironmentsFromIni(env.iniPath);
            const targetEnv = environments.find(e => e.name.toLowerCase() === envName.toLowerCase());
            if (!targetEnv) {
                return reply.status(404).send({
                    error: 'Environment não encontrado',
                    availableEnvironments: environments.map(e => e.name),
                });
            }
            return {
                serviceId: id,
                environment: targetEnv,
            };
        });
        // Re-escaneia environments de um serviço
        apiServer.get('/environments/scan/:serviceId', async (request, reply) => {
            const { serviceId } = request.params;
            const env = config.services.find(e => e.name === serviceId);
            if (!env) {
                return reply.status(404).send({ error: 'Serviço não encontrado' });
            }
            const environments = extractEnvironmentsFromIni(env.iniPath);
            return {
                serviceId,
                scannedAt: new Date().toISOString(),
                environments,
                total: environments.length,
            };
        });
        // Lista todos os environments de todos os serviços
        apiServer.get('/environments/all', async () => {
            const allEnvironments = [];
            for (const env of config.services) {
                const environments = extractEnvironmentsFromIni(env.iniPath);
                if (environments.length > 0) {
                    allEnvironments.push({
                        serviceId: env.name,
                        serviceName: env.displayName,
                        environments,
                    });
                }
            }
            return {
                services: allEnvironments,
                totalServices: allEnvironments.length,
                totalEnvironments: allEnvironments.reduce((acc, s) => acc + s.environments.length, 0),
            };
        });
        // ==================== NAVEGA�?�fO DE ARQUIVOS ====================
        // Listar diretório
        apiServer.get('/files', async (request, reply) => {
            const { path: dirPath, showHidden } = request.query;
            if (!dirPath) {
                return reply.status(400).send({ error: 'Parâmetro path é obrigatório' });
            }
            // Valida que o path é seguro (não permite escapar)
            const normalizedPath = path.normalize(dirPath);
            if (!fs.existsSync(normalizedPath)) {
                return reply.status(404).send({ error: 'Diretório não encontrado' });
            }
            const stats = fs.statSync(normalizedPath);
            if (!stats.isDirectory()) {
                return reply.status(400).send({ error: 'O caminho não é um diretório' });
            }
            const entries = listDirectory(normalizedPath, showHidden === 'true');
            return {
                path: normalizedPath,
                parent: path.dirname(normalizedPath),
                entries,
                totalFiles: entries.filter(e => e.type === 'file').length,
                totalDirectories: entries.filter(e => e.type === 'directory').length,
            };
        });
        // Ler conteúdo de arquivo
        apiServer.get('/files/content', async (request, reply) => {
            const { path: filePath, maxSize } = request.query;
            if (!filePath) {
                return reply.status(400).send({ error: 'Parâmetro path é obrigatório' });
            }
            const normalizedPath = path.normalize(filePath);
            if (!fs.existsSync(normalizedPath)) {
                return reply.status(404).send({ error: 'Arquivo não encontrado' });
            }
            const stats = fs.statSync(normalizedPath);
            if (!stats.isFile()) {
                return reply.status(400).send({ error: 'O caminho não é um arquivo' });
            }
            const max = parseInt(maxSize || '1048576', 10); // Default 1MB
            const result = readFileContent(normalizedPath, max);
            if (!result) {
                return reply.status(500).send({ error: 'Erro ao ler arquivo' });
            }
            return {
                path: normalizedPath,
                size: stats.size,
                modified: stats.mtime.toISOString(),
                ...result,
            };
        });
        // Navegar diretórios de um serviço específico
        apiServer.get('/services/:id/files', async (request, reply) => {
            const { id } = request.params;
            const { type, subpath } = request.query;
            const env = config.services.find(e => e.name === id && e.enabled);
            if (!env) {
                return reply.status(404).send({ error: 'Serviço não encontrado' });
            }
            const dirs = getServiceDirectories(env);
            let basePath = '';
            switch (type) {
                case 'binary':
                    basePath = dirs.binary;
                    break;
                case 'sourcepath':
                case 'rpo':
                    basePath = dirs.sourcePath || '';
                    break;
                case 'rpocustom':
                case 'custom':
                    basePath = dirs.rpoCustom || '';
                    break;
                case 'rootpath':
                case 'data':
                    basePath = dirs.rootPath || '';
                    break;
                case 'startpath':
                    basePath = dirs.startPath || '';
                    break;
                case 'log':
                    basePath = dirs.logPath || '';
                    break;
                default:
                    // Se não especificou tipo, retorna os diretórios disponíveis
                    return {
                        service: id,
                        directories: dirs,
                    };
            }
            if (!basePath) {
                return reply.status(404).send({
                    error: `Diretório '${type}' não configurado para este serviço`,
                    availableDirectories: Object.keys(dirs).filter(k => dirs[k]),
                });
            }
            const fullPath = subpath ? path.join(basePath, subpath) : basePath;
            if (!fs.existsSync(fullPath)) {
                return reply.status(404).send({ error: 'Diretório não encontrado', path: fullPath });
            }
            const entries = listDirectory(fullPath);
            return {
                service: id,
                type,
                basePath,
                currentPath: fullPath,
                parent: path.dirname(fullPath),
                entries,
            };
        });
        // ==================== ENVIRONMENTS (LEGACY) ====================
        apiServer.get('/environments', async () => ({
            environments: config.services.filter(e => e.enabled).map(env => ({
                name: env.name,
                displayName: env.displayName,
                rootPath: env.rootPath,
                iniPath: env.iniPath,
                type: env.type || 'appserver',
                status: 'configured',
            })),
            total: config.services.filter(e => e.enabled).length,
        }));
        apiServer.get('/environments/:name', async (request, reply) => {
            const { name } = request.params;
            const env = config.services.find(e => e.name === name && e.enabled);
            if (!env) {
                return reply.status(404).send({ error: 'Ambiente não encontrado' });
            }
            return {
                name: env.name,
                displayName: env.displayName,
                rootPath: env.rootPath,
                iniPath: env.iniPath,
                type: env.type || 'appserver',
                status: 'configured',
            };
        });
        apiServer.get('/environments/:name/ini', async (request, reply) => {
            const { name } = request.params;
            const env = config.services.find(e => e.name === name && e.enabled);
            if (!env) {
                return reply.status(404).send({ error: 'Ambiente não encontrado' });
            }
            try {
                if (fs.existsSync(env.iniPath)) {
                    const content = fs.readFileSync(env.iniPath, 'utf-8');
                    return { path: env.iniPath, content };
                }
                return reply.status(404).send({ error: 'Arquivo INI não encontrado' });
            }
            catch (error) {
                return reply.status(500).send({ error: 'Erro ao ler arquivo INI' });
            }
        });
        // Inicia o servidor
        await apiServer.listen({ port: config.server.port, host: config.server.host });
        console.log(`�Ys? API rodando em http://${config.server.host}:${config.server.port}`);
        updateTrayMenu();
        return true;
    }
    catch (error) {
        console.error('Erro ao iniciar API:', error);
        apiServer = null;
        return false;
    }
}
async function stopApiServer() {
    if (!apiServer) {
        return true;
    }
    try {
        await apiServer.close();
        apiServer = null;
        console.log('API parada');
        updateTrayMenu();
        return true;
    }
    catch (error) {
        console.error('Erro ao parar API:', error);
        return false;
    }
}
async function restartApiServer() {
    await stopApiServer();
    return startApiServer();
}
// ============================================================================
// JANELA PRINCIPAL
// ============================================================================
function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
        width: 1100,
        height: 800,
        minWidth: 900,
        minHeight: 650,
        title: 'Ncloud Agent',
        icon: createAppIcon(),
        backgroundColor: '#f5f5f5',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
        },
        show: false,
        autoHideMenuBar: true,
        frame: true,
    });
    // Caminho do index.html:
    // - Em dev: __dirname = dist/electron, index.html em electron/renderer/
    // - Em prod: app.asar contém dist/electron/ e electron/renderer/ separados
    const indexPath = electron_1.app.isPackaged
        ? path.join(electron_1.app.getAppPath(), 'electron', 'renderer', 'index.html')
        : path.join(__dirname, '..', '..', 'electron', 'renderer', 'index.html');
    console.log(`�Y"" Carregando UI de: ${indexPath}`);
    mainWindow.loadFile(indexPath);
    mainWindow.once('ready-to-show', () => {
        mainWindow?.show();
    });
    mainWindow.on('close', (event) => {
        if (!isQuitting) {
            event.preventDefault();
            mainWindow?.hide();
        }
    });
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}
// ============================================================================
// TRAY E ÍCONES
// ============================================================================
// Função para obter o caminho correto dos assets
function getAssetPath(...paths) {
    if (electron_1.app.isPackaged) {
        // Em produção, os assets estão em resources/assets
        return path.join(process.resourcesPath, 'assets', ...paths);
    }
    else {
        // Em desenvolvimento, os assets estão na pasta assets
        return path.join(__dirname, '..', 'assets', ...paths);
    }
}
// Função para criar o ícone do app (NEEWE Logo)
function createAppIcon() {
    // Lista de caminhos para tentar (em ordem de prioridade)
    const iconPaths = [
        getAssetPath('icon.ico'),
        getAssetPath('icons', 'win', 'icon.ico'),
        getAssetPath('icon.png'),
        getAssetPath('icons', 'png', '256x256.png'),
    ];
    // Tenta cada caminho
    for (const iconPath of iconPaths) {
        if (fs.existsSync(iconPath)) {
            console.log(`�Y"Z Carregando ícone de: ${iconPath}`);
            const icon = electron_1.nativeImage.createFromPath(iconPath);
            if (!icon.isEmpty()) {
                return icon;
            }
        }
    }
    console.log('�s�️ Ícone não encontrado, usando fallback');
    // Fallback: PNG base64 embutido (32x32 Ncloud logo)
    const fallbackBase64 = 'iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAAXNSR0IArs4c6QAAAERlWElmTU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAA6ABAAMAAAABAAEAAKACAAQAAAABAAAAIKADAAQAAAABAAAAIAAAAACshmLzAAAC2klEQVRYCe1WS0hUYRT+7p2ZO86MzuOMj1EzNRPNHj7IHkQRLYKgBxRB0SJo0SYiqFVBi9pFUUSLoE0F0S4qiIgiIoqoh0RJRNZC08rUfMzojI7jzNy5/0mXGUfnTuNA0IL/53/nO+c//3fOdw+gv/4BAf0W/FcICAJBKUTIBmgCMjWk5gA8gYBXDamZgAaCAugDLgANgTCQ1AUeO+5AY/pO4E0gDIQWYDXfXQCK0tLSPvp8vrt2u/1zdnY2Kysr42dnZ0f7fL5OQRAMkiTltLa2vurt7b0ciI4AhqcPwEHgLAYeBL5yOBxvu7u7a4qKitYWFhaurKioMBUXF6cIgnD3/v37J/bt2/c0IAsCDAJ+YB9wEfgwsLGrq+ul0+l8LoriTIPBsFSj0SwuKCjAsmXLkJubi8rKyq7m5mbpYG3ty4AGgNfABcAbwKdAdWVl5Tlmy4tEIlckSapJJBKZGo1GY7PZsHTpUixfvhx5eXlwOBxobGxsO1hb++BifEALXAb2A7WANzY3N6OhoQHV1dU/Q6HQCqPRqC0oKMCS4mIsXrwYOTk5sFqt6Onp+XywtvbeJWAAeAvYBlQAPkRra6tQX19vqq6uPi6K4pJYLJZlNBoxb948LFq0CPn5+UhLS4PT6UwcrK29E1CP7ACeApsAjyRJhjNnzhxNJBIlMzMzOWazGfPnz0dRURFsNhvS09Ph8XhwqLb27qX4gNbXB+wGgpIkGc6ePXsoHo+XTE9P55jNZhQWFqKwsBAZGRkwmUzweDyoq6u7e7m+NQhsBg4DHwGfTp06dSgajZZMTU2lmkwmFBQUYOHChUhPT4fRaITX68WhQ4fuBaJjIeAa0ASMAJ7W1dUd9Pv9pb+zXm82m1FYWIi8vDykpaXB5/N5LgWimYALeCfJ5XJ9qq+vL4/H42XRaDQr1WA2mUzIycmB1WqF2+1+F5AYAvcBb4BNwIi0uro6MTAwELulJsAFOH8AqVLLDu4hKWgAAAAASUVORK5CYII=';
    return electron_1.nativeImage.createFromDataURL(`data:image/png;base64,${fallbackBase64}`);
}
// Função para criar ícone do tray (16x16 ou 32x32)
function createTrayIcon() {
    const iconPaths = [
        getAssetPath('icon-32.png'),
        getAssetPath('icons', 'png', '32x32.png'),
        getAssetPath('icon.ico'),
    ];
    for (const iconPath of iconPaths) {
        if (fs.existsSync(iconPath)) {
            const icon = electron_1.nativeImage.createFromPath(iconPath);
            if (!icon.isEmpty()) {
                // Redimensiona para 16x16 no Windows
                return icon.resize({ width: 16, height: 16 });
            }
        }
    }
    return createAppIcon().resize({ width: 16, height: 16 });
}
function createTray() {
    const icon = createTrayIcon();
    tray = new electron_1.Tray(icon);
    tray.setToolTip('Ncloud Agent - Gerenciador de Serviços Protheus');
    updateTrayMenu();
    tray.on('double-click', () => {
        showWindow();
    });
    console.log('�Y"O Tray criado com sucesso');
}
function updateTrayMenu() {
    if (!tray)
        return;
    const isRunning = apiServer !== null;
    const contextMenu = electron_1.Menu.buildFromTemplate([
        {
            label: '�~�️ Ncloud Agent v1.0.0',
            enabled: false,
        },
        { type: 'separator' },
        {
            label: isRunning ? `�YY� API Ativa (porta ${config.server.port})` : '�Y"� API Inativa',
            enabled: false,
        },
        { type: 'separator' },
        {
            label: '�sT️ Configuração',
            click: showWindow,
        },
        {
            label: isRunning ? '⏹️ Parar API' : '�-�️ Iniciar API',
            click: () => {
                if (isRunning) {
                    stopApiServer();
                }
                else {
                    startApiServer();
                }
            },
        },
        {
            label: '�Y"" Reiniciar API',
            enabled: isRunning,
            click: restartApiServer,
        },
        { type: 'separator' },
        {
            label: '�YO� Abrir no Navegador',
            enabled: isRunning,
            click: () => electron_1.shell.openExternal(`http://localhost:${config.server.port}/health`),
        },
        { type: 'separator' },
        {
            label: '�O Sair',
            click: () => {
                isQuitting = true;
                stopApiServer().then(() => electron_1.app.quit());
            },
        },
    ]);
    tray.setContextMenu(contextMenu);
}
function showWindow() {
    if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
    }
    else {
        createWindow();
    }
}
// ============================================================================
// IPC HANDLERS
// ============================================================================
function registerIpcHandlers() {
    // Status da API
    electron_1.ipcMain.handle('get-api-status', () => ({
        running: apiServer !== null,
        port: config.server.port,
        host: config.server.host,
    }));
    // Controle da API
    electron_1.ipcMain.handle('start-api', startApiServer);
    electron_1.ipcMain.handle('stop-api', stopApiServer);
    electron_1.ipcMain.handle('restart-api', restartApiServer);
    // Configuração
    electron_1.ipcMain.handle('get-config', () => config);
    electron_1.ipcMain.handle('save-config', async (_event, newConfig) => {
        const needsRestart = config.server.port !== newConfig.server.port ||
            config.server.host !== newConfig.server.host ||
            config.auth.token !== newConfig.auth.token;
        const saved = saveConfig(newConfig);
        if (saved && needsRestart && apiServer) {
            await restartApiServer();
        }
        return { success: saved, restarted: needsRestart };
    });
    // Servi�os (CRUD) - v1.4.0
    const getServicesHandler = () => config.services;
    const addServiceHandler = async (_event, svc) => {
        config.services.push(svc);
        return saveConfig(config);
    };
    const updateServiceHandler = async (_event, name, updates) => {
        const index = config.services.findIndex(e => e.name === name);
        if (index >= 0) {
            config.services[index] = { ...config.services[index], ...updates };
            return saveConfig(config);
        }
        return false;
    };
    const removeServiceHandler = async (_event, name) => {
        config.services = config.services.filter(e => e.name !== name);
        return saveConfig(config);
    };
    // New channel names (v1.4.0)
    electron_1.ipcMain.handle('get-services', getServicesHandler);
    electron_1.ipcMain.handle('add-service', addServiceHandler);
    electron_1.ipcMain.handle('update-service', updateServiceHandler);
    electron_1.ipcMain.handle('remove-service', removeServiceHandler);
    // Legacy channel names (deprecated aliases)
    electron_1.ipcMain.handle('get-environments', getServicesHandler);
    electron_1.ipcMain.handle('add-environment', addServiceHandler);
    electron_1.ipcMain.handle('update-environment', updateServiceHandler);
    electron_1.ipcMain.handle('remove-environment', removeServiceHandler);
    // Componentes
    electron_1.ipcMain.handle('get-components', () => config.components);
    electron_1.ipcMain.handle('add-components', async (_event, components) => {
        for (const comp of components) {
            if (!config.components.some(c => c.path === comp.path)) {
                config.components.push(comp);
            }
        }
        return saveConfig(config);
    });
    electron_1.ipcMain.handle('remove-component', async (_event, componentPath) => {
        config.components = config.components.filter(c => c.path !== componentPath);
        return saveConfig(config);
    });
    // Controle de serviços
    electron_1.ipcMain.handle('start-service', async (_event, name) => {
        const env = config.services.find(e => e.name === name);
        if (!env)
            return { success: false, message: 'Serviço não encontrado' };
        return startService(env);
    });
    electron_1.ipcMain.handle('stop-service', async (_event, name) => {
        const env = config.services.find(e => e.name === name);
        if (!env)
            return { success: false, message: 'Serviço não encontrado' };
        return stopService(env);
    });
    electron_1.ipcMain.handle('restart-service', async (_event, name) => {
        const env = config.services.find(e => e.name === name);
        if (!env)
            return { success: false, message: 'Serviço não encontrado' };
        return restartService(env);
    });
    electron_1.ipcMain.handle('get-service-status', async (_event, name) => {
        const env = config.services.find(e => e.name === name);
        if (!env)
            return null;
        return getServiceStatus(env);
    });
    electron_1.ipcMain.handle('get-all-services-status', async () => {
        const statuses = [];
        for (const env of config.services) {
            statuses.push(await getServiceStatus(env));
        }
        return statuses;
    });
    // Diálogos
    electron_1.ipcMain.handle('select-directory', async () => {
        const result = await electron_1.dialog.showOpenDialog({
            properties: ['openDirectory'],
            title: 'Selecionar diretório',
        });
        return result.canceled ? null : result.filePaths[0];
    });
    electron_1.ipcMain.handle('select-ini-file', async () => {
        const result = await electron_1.dialog.showOpenDialog({
            properties: ['openFile'],
            title: 'Selecionar arquivo appserver.ini',
            filters: [{ name: 'INI Files', extensions: ['ini'] }],
        });
        return result.canceled ? null : result.filePaths[0];
    });
    // Scan
    electron_1.ipcMain.handle('scan-directories', async (_event, directories) => {
        return scanMultipleDirectories(directories);
    });
    electron_1.ipcMain.handle('check-directory', async (_event, dirPath) => {
        return fs.existsSync(dirPath);
    });
    electron_1.ipcMain.handle('list-subdirectories', async (_event, dirPath) => {
        try {
            if (!fs.existsSync(dirPath))
                return [];
            const entries = fs.readdirSync(dirPath, { withFileTypes: true });
            return entries
                .filter(e => e.isDirectory())
                .map(e => ({
                name: e.name,
                path: path.join(dirPath, e.name),
            }));
        }
        catch {
            return [];
        }
    });
    // Navegação de arquivos
    electron_1.ipcMain.handle('list-directory', async (_event, dirPath) => {
        return listDirectory(dirPath);
    });
    electron_1.ipcMain.handle('get-service-directories', async (_event, name) => {
        const env = config.services.find(e => e.name === name);
        if (!env)
            return null;
        return getServiceDirectories(env);
    });
    // ==================== INST�,NCIAS ====================
    // Lista todas as instâncias
    electron_1.ipcMain.handle('get-instances', () => config.instances);
    // Obtém uma instância específica
    electron_1.ipcMain.handle('get-instance', async (_event, id) => {
        return config.instances.find(i => i.id === id) || null;
    });
    // Cria uma nova instância
    electron_1.ipcMain.handle('create-instance', async (_event, data) => {
        const id = `inst-${data.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;
        const newInstance = {
            id,
            name: data.name,
            displayName: data.displayName,
            type: data.type,
            description: data.description,
            services: data.services || [],
            createdAt: new Date().toISOString(),
            enabled: true,
        };
        config.instances.push(newInstance);
        saveConfig(config);
        return newInstance;
    });
    // Atualiza uma instância
    electron_1.ipcMain.handle('update-instance', async (_event, id, updates) => {
        const index = config.instances.findIndex(i => i.id === id);
        if (index < 0)
            return false;
        delete updates.id;
        delete updates.createdAt;
        config.instances[index] = { ...config.instances[index], ...updates };
        saveConfig(config);
        return true;
    });
    // Remove uma instância
    electron_1.ipcMain.handle('delete-instance', async (_event, id) => {
        const index = config.instances.findIndex(i => i.id === id);
        if (index < 0)
            return false;
        // Remove a referência de instanceId dos environments
        config.services.forEach(env => {
            if (env.instanceId === id) {
                env.instanceId = undefined;
            }
        });
        config.instances.splice(index, 1);
        saveConfig(config);
        return true;
    });
    // Adiciona serviço a uma instância
    electron_1.ipcMain.handle('add-service-to-instance', async (_event, instanceId, serviceName) => {
        const instance = config.instances.find(i => i.id === instanceId);
        if (!instance)
            return false;
        if (!instance.services.includes(serviceName)) {
            instance.services.push(serviceName);
            const service = config.services.find(e => e.name === serviceName);
            if (service) {
                service.instanceId = instanceId;
            }
            saveConfig(config);
        }
        return true;
    });
    // Remove serviço de uma instância
    electron_1.ipcMain.handle('remove-service-from-instance', async (_event, instanceId, serviceName) => {
        const instance = config.instances.find(i => i.id === instanceId);
        if (!instance)
            return false;
        const serviceIndex = instance.services.indexOf(serviceName);
        if (serviceIndex >= 0) {
            instance.services.splice(serviceIndex, 1);
            const service = config.services.find(e => e.name === serviceName);
            if (service) {
                service.instanceId = undefined;
            }
            saveConfig(config);
        }
        return true;
    });
    // Inicia todos os serviços de uma instância
    electron_1.ipcMain.handle('start-instance-services', async (_event, instanceId) => {
        const instance = config.instances.find(i => i.id === instanceId);
        if (!instance)
            return { success: false, message: 'Instância não encontrada' };
        const results = [];
        for (const serviceName of instance.services) {
            const service = config.services.find(e => e.name === serviceName);
            if (service) {
                const result = await startService(service);
                results.push({ service: serviceName, success: result.success, message: result.message });
            }
        }
        return {
            success: results.every(r => r.success),
            results,
        };
    });
    // Para todos os serviços de uma instância
    electron_1.ipcMain.handle('stop-instance-services', async (_event, instanceId) => {
        const instance = config.instances.find(i => i.id === instanceId);
        if (!instance)
            return { success: false, message: 'Instância não encontrada' };
        const results = [];
        for (const serviceName of instance.services) {
            const service = config.services.find(e => e.name === serviceName);
            if (service) {
                const result = await stopService(service);
                results.push({ service: serviceName, success: result.success, message: result.message });
            }
        }
        return {
            success: results.every(r => r.success),
            results,
        };
    });
    // ==================== ENVIRONMENTS DO INI ====================
    // Obtém environments de um serviço
    electron_1.ipcMain.handle('get-service-ini-environments', async (_event, serviceName) => {
        const env = config.services.find(e => e.name === serviceName);
        if (!env)
            return [];
        return extractEnvironmentsFromIni(env.iniPath);
    });
    // Obtém todos os environments de todos os serviços
    electron_1.ipcMain.handle('get-all-ini-environments', async () => {
        const result = [];
        for (const env of config.services) {
            const environments = extractEnvironmentsFromIni(env.iniPath);
            if (environments.length > 0) {
                result.push({
                    serviceName: env.name,
                    serviceDisplayName: env.displayName,
                    environments,
                });
            }
        }
        return result;
    });
    // ==================== DOCUMENTA�?�fO ====================
    // Obtém documentação da API
    electron_1.ipcMain.handle('get-api-docs', () => getApiDocumentation());
    // ==================== WEBHOOKS ====================
    // Lista todos os webhooks
    electron_1.ipcMain.handle('get-webhooks', () => {
        return { webhooks: config.webhooks || [] };
    });
    // Obtém um webhook específico
    electron_1.ipcMain.handle('get-webhook', (_event, id) => {
        return config.webhooks?.find(w => w.id === id) || null;
    });
    // Cria um novo webhook
    electron_1.ipcMain.handle('create-webhook', (_event, data) => {
        if (!config.webhooks)
            config.webhooks = [];
        const webhook = {
            id: crypto.randomUUID(),
            name: data.name || 'Novo Webhook',
            url: data.url || '',
            secret: data.secret,
            events: data.events || ['*'],
            enabled: data.enabled !== false,
            retryCount: data.retryCount ?? 3,
            retryDelayMs: data.retryDelayMs ?? 5000,
            timeoutMs: data.timeoutMs ?? 10000,
            headers: data.headers,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        config.webhooks.push(webhook);
        saveConfig(config);
        return webhook;
    });
    // Atualiza um webhook existente
    electron_1.ipcMain.handle('update-webhook', (_event, id, updates) => {
        if (!config.webhooks)
            return null;
        const index = config.webhooks.findIndex(w => w.id === id);
        if (index === -1)
            return null;
        config.webhooks[index] = {
            ...config.webhooks[index],
            ...updates,
            id, // Mantém o ID original
            createdAt: config.webhooks[index].createdAt, // Mantém a data de criação
            updatedAt: new Date().toISOString(),
        };
        saveConfig(config);
        return config.webhooks[index];
    });
    // Exclui um webhook
    electron_1.ipcMain.handle('delete-webhook', (_event, id) => {
        if (!config.webhooks)
            return false;
        const initialLength = config.webhooks.length;
        config.webhooks = config.webhooks.filter(w => w.id !== id);
        if (config.webhooks.length !== initialLength) {
            saveConfig(config);
            return true;
        }
        return false;
    });
    // Testa um webhook
    electron_1.ipcMain.handle('test-webhook', async (_event, id) => {
        const webhook = config.webhooks?.find(w => w.id === id);
        if (!webhook) {
            return { success: false, error: 'Webhook não encontrado' };
        }
        const testPayload = {
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            event: {
                type: 'test',
                timestamp: Date.now(),
                details: { message: 'Evento de teste do Ncloud Agent' },
            },
            agent: {
                id: 'windows-agent',
                hostname: require('os').hostname(),
                version: '1.3.0',
            },
        };
        const startTime = Date.now();
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), webhook.timeoutMs || 10000);
            const headers = {
                'Content-Type': 'application/json',
                'User-Agent': 'NcloudAgent/1.3.0',
                ...webhook.headers,
            };
            // Adiciona HMAC se houver secret
            if (webhook.secret) {
                const crypto = require('crypto');
                const signature = crypto
                    .createHmac('sha256', webhook.secret)
                    .update(JSON.stringify(testPayload))
                    .digest('hex');
                headers['X-Webhook-Signature'] = `sha256=${signature}`;
            }
            const response = await fetch(webhook.url, {
                method: 'POST',
                headers,
                body: JSON.stringify(testPayload),
                signal: controller.signal,
            });
            clearTimeout(timeoutId);
            const responseTime = Date.now() - startTime;
            return {
                success: response.ok,
                statusCode: response.status,
                responseTime,
                error: response.ok ? undefined : `HTTP ${response.status} ${response.statusText}`,
            };
        }
        catch (error) {
            return {
                success: false,
                responseTime: Date.now() - startTime,
                error: error instanceof Error ? error.message : 'Erro desconhecido',
            };
        }
    });
    // Obtém histórico de entregas de um webhook
    electron_1.ipcMain.handle('get-webhook-deliveries', (_event, _id, _limit) => {
        // No Windows/Electron, não temos histórico persistente por enquanto
        // Retornamos vazio - em produção isso seria salvo em um arquivo ou DB
        return { deliveries: [] };
    });
}
// ============================================================================
// SERVICE MONITOR - Monitora serviços e envia webhooks
// ============================================================================
// Armazena snapshots anteriores para detectar mudanças
const serviceSnapshots = new Map();
let monitorInterval = null;
const MONITOR_POLL_INTERVAL = 5000; // 5 segundos - polling mais frequente para UI responsiva
// Histórico de entregas de webhook (em memória)
const webhookDeliveryHistory = [];
const MAX_DELIVERY_HISTORY = 100;
// Envia evento para todos os webhooks configurados
async function sendWebhookEvent(event) {
    const webhooks = config.webhooks?.filter(w => w.enabled) || [];
    for (const webhook of webhooks) {
        // Verifica se o webhook está inscrito neste evento
        const isSubscribed = webhook.events.includes('*') || webhook.events.includes(event.type);
        if (!isSubscribed)
            continue;
        const payload = {
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            event,
            agent: {
                id: 'windows-agent',
                hostname: require('os').hostname(),
                version: '1.3.0',
            },
        };
        // Enviar com retry
        await sendWithRetry(webhook, payload, 0);
    }
}
async function sendWithRetry(webhook, payload, attempt) {
    const delivery = {
        id: crypto.randomUUID(),
        webhookId: webhook.id,
        timestamp: new Date().toISOString(),
        event: payload.event,
        success: false,
        status: 'pending',
        attempts: attempt + 1,
    };
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), webhook.timeoutMs || 10000);
        const headers = {
            'Content-Type': 'application/json',
            'User-Agent': 'NcloudAgent/1.3.0',
            'X-Agent-Token': config.auth?.token || '',
            ...webhook.headers,
        };
        // Adiciona HMAC se houver secret
        if (webhook.secret) {
            const signature = crypto
                .createHmac('sha256', webhook.secret)
                .update(JSON.stringify(payload))
                .digest('hex');
            headers['X-Webhook-Signature'] = `sha256=${signature}`;
        }
        const response = await fetch(webhook.url, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
            signal: controller.signal,
        });
        clearTimeout(timeoutId);
        delivery.statusCode = response.status;
        delivery.success = response.ok;
        delivery.status = response.ok ? 'success' : 'failed';
        if (!response.ok) {
            delivery.error = `HTTP ${response.status} ${response.statusText}`;
        }
        console.log(`[Webhook] ${webhook.name}: ${response.ok ? 'SUCCESS' : 'FAILED'} - ${payload.event.type}`);
    }
    catch (error) {
        delivery.success = false;
        delivery.status = 'failed';
        delivery.error = error instanceof Error ? error.message : 'Erro desconhecido';
        console.error(`[Webhook] ${webhook.name}: ERROR - ${delivery.error}`);
        // Retry se ainda houver tentativas
        if (attempt < (webhook.retryCount || 3)) {
            const delay = webhook.retryDelayMs || 5000;
            console.log(`[Webhook] ${webhook.name}: Retry ${attempt + 1}/${webhook.retryCount} em ${delay}ms`);
            setTimeout(() => sendWithRetry(webhook, payload, attempt + 1), delay);
        }
    }
    // Salvar no histórico
    webhookDeliveryHistory.unshift(delivery);
    if (webhookDeliveryHistory.length > MAX_DELIVERY_HISTORY) {
        webhookDeliveryHistory.pop();
    }
}
// Poll de serviços e detecção de mudanças
async function pollServices() {
    const environments = config.services || [];
    let hasChanges = false;
    const allStatuses = [];
    for (const env of environments) {
        if (!env.enabled)
            continue;
        try {
            const status = await getServiceStatus(env);
            allStatuses.push(status);
            const previousSnapshot = serviceSnapshots.get(env.name);
            const currentStatus = status.status;
            // Detecta mudança de estado
            if (previousSnapshot && previousSnapshot.status !== currentStatus) {
                hasChanges = true;
                const eventType = currentStatus === 'running'
                    ? 'service:started'
                    : currentStatus === 'stopped'
                        ? 'service:stopped'
                        : 'service:health_changed';
                console.log(`[Monitor] ${env.displayName}: ${previousSnapshot.status} -> ${currentStatus}`);
                // Envia evento de mudança via webhook
                await sendWebhookEvent({
                    type: eventType,
                    serviceId: env.name,
                    serviceName: env.displayName,
                    timestamp: Date.now(),
                    previousState: previousSnapshot.status,
                    currentState: currentStatus,
                    details: {
                        port: status.port,
                        pid: status.pid,
                        memory: status.memory,
                        type: env.type,
                    },
                });
            }
            // Atualiza snapshot
            serviceSnapshots.set(env.name, {
                status: currentStatus,
                timestamp: Date.now(),
            });
        }
        catch (error) {
            console.error(`[Monitor] Erro ao verificar ${env.name}:`, error);
        }
    }
    // SEMPRE notifica o frontend com os status atuais (para manter a UI atualizada)
    notifyRendererOfStatusUpdate(allStatuses, hasChanges);
}
// Notifica o renderer sobre atualização de status dos serviços
function notifyRendererOfStatusUpdate(statuses, hasChanges) {
    if (!mainWindow || mainWindow.isDestroyed())
        return;
    try {
        mainWindow.webContents.send('services-status-update', {
            services: statuses,
            hasChanges,
            timestamp: Date.now(),
        });
    }
    catch (error) {
        console.error('[Monitor] Erro ao notificar renderer:', error);
    }
}
// Inicia o monitor de serviços
function startServiceMonitor() {
    if (monitorInterval) {
        console.log('[Monitor] Já está rodando');
        return;
    }
    console.log(`[Monitor] Iniciando monitoramento (intervalo: ${MONITOR_POLL_INTERVAL / 1000}s)`);
    // Executa imediatamente para capturar estado inicial
    pollServices().catch(err => console.error('[Monitor] Erro no poll inicial:', err));
    // Agenda execuções periódicas
    monitorInterval = setInterval(async () => {
        try {
            await pollServices();
        }
        catch (error) {
            console.error('[Monitor] Erro no poll:', error);
        }
    }, MONITOR_POLL_INTERVAL);
}
// Para o monitor de serviços
function stopServiceMonitor() {
    if (monitorInterval) {
        clearInterval(monitorInterval);
        monitorInterval = null;
        console.log('[Monitor] Monitoramento parado');
    }
}
// ============================================================================
// INICIALIZA�?�fO
// ============================================================================
electron_1.app.whenReady().then(async () => {
    config = loadConfig();
    registerIpcHandlers();
    createTray();
    createWindow();
    if (config.autoStart) {
        await startApiServer();
    }
    // Inicia o monitor de serviços
    startServiceMonitor();
});
const gotTheLock = electron_1.app.requestSingleInstanceLock();
if (!gotTheLock) {
    electron_1.app.quit();
}
else {
    electron_1.app.on('second-instance', showWindow);
}
electron_1.app.on('window-all-closed', () => {
    // Mantém na bandeja
});
electron_1.app.on('before-quit', async () => {
    isQuitting = true;
    stopServiceMonitor();
    await stopApiServer();
});
electron_1.app.on('activate', () => {
    if (electron_1.BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
//# sourceMappingURL=main.js.map