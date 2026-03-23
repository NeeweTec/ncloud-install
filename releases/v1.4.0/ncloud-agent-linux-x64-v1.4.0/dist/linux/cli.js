#!/usr/bin/env node
"use strict";
/**
 * Ncloud Agent - CLI para Linux
 * Interface de linha de comando para configuração e gerenciamento
 *
 * Recursos:
 * - Gerenciamento de serviços Protheus
 * - Gerenciamento de Instâncias (grupos de serviços)
 * - Visualização de Environments do INI
 * - Auto-detecção de ambientes
 * - Configuração da API
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
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const readline = __importStar(require("readline"));
const crypto = __importStar(require("crypto"));
const child_process_1 = require("child_process");
const util_1 = require("util");
const config_store_js_1 = require("./config-store.js");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
// ============================================================================
// CORES ANSI
// ============================================================================
const Colors = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    gray: '\x1b[90m',
};
const c = Colors;
// ============================================================================
// CONFIGURAÇÃO - USANDO CONFIG STORE CENTRALIZADO
// ============================================================================
const VERSION = '1.2.0';
// Funções de conveniência para o CLI
const loadConfig = () => config_store_js_1.daemonConfigStore.get();
// Função saveConfig que aceita o config modificado e sincroniza com o store
function saveConfig(config) {
    try {
        config_store_js_1.daemonConfigStore.replace(config);
        return config_store_js_1.daemonConfigStore.flush();
    }
    catch (error) {
        console.error('Erro ao salvar configuração:', error);
        return false;
    }
}
// ============================================================================
// UTILIDADES
// ============================================================================
function clearScreen() {
    console.clear();
}
function printLine() {
    console.log(`${c.gray}${'─'.repeat(70)}${c.reset}`);
}
function printHeader() {
    clearScreen();
    console.log();
    printLine();
    console.log(`  ${c.bold}${c.cyan}☁️  NCLOUD AGENT${c.reset} ${c.gray}|${c.reset} Gerenciador de Serviços Protheus v${VERSION}`);
    console.log(`  ${c.gray}Linux CLI - Neewe Consultoria${c.reset}`);
    printLine();
    console.log();
}
function msgOk(text) {
    console.log(`  ${c.green}✓${c.reset}  ${text}`);
}
function msgFail(text) {
    console.log(`  ${c.red}✗${c.reset}  ${text}`);
}
function msgInfo(text) {
    console.log(`  ${c.blue}ℹ${c.reset}  ${text}`);
}
function msgWarn(text) {
    console.log(`  ${c.yellow}⚠${c.reset}  ${text}`);
}
function msgSkip(text) {
    console.log(`  ${c.yellow}○${c.reset}  ${text}`);
}
// ============================================================================
// PARSER INI
// ============================================================================
function parseIniFile(filePath) {
    try {
        if (!fs.existsSync(filePath))
            return null;
        const content = fs.readFileSync(filePath, 'utf-8');
        const result = {};
        let currentSection = 'general';
        for (const line of content.split(/\r?\n/)) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith(';') || trimmed.startsWith('#'))
                continue;
            const sectionMatch = trimmed.match(/^\[([^\]]+)\]$/);
            if (sectionMatch) {
                currentSection = sectionMatch[1].toLowerCase();
                if (!result[currentSection])
                    result[currentSection] = {};
                continue;
            }
            const kvMatch = trimmed.match(/^([^=]+)=(.*)$/);
            if (kvMatch) {
                if (!result[currentSection])
                    result[currentSection] = {};
                result[currentSection][kvMatch[1].trim().toLowerCase()] = kvMatch[2].trim();
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
            if (isCommented)
                continue;
            if (trimmed.startsWith(';') || trimmed.startsWith('#') || !trimmed)
                continue;
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
function detectServicePort(ini, serviceType) {
    if (!ini)
        return 0;
    const portSections = {
        'dbaccess': [['general', 'port'], ['dbaccess', 'port']],
        'license': [['licenseserver', 'port'], ['tcp', 'port']],
        'appserver': [['tcp', 'port'], ['general', 'port']],
        'rest': [['httprest', 'port'], ['tcp', 'port']],
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
// ============================================================================
// CONTROLE DE PROCESSOS
// ============================================================================
async function checkPortInUse(port) {
    try {
        const { stdout } = await execAsync(`ss -tlnp 2>/dev/null | grep ":${port} " || netstat -tlnp 2>/dev/null | grep ":${port} "`);
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
        const { stdout: ns } = await execAsync(`netstat -tlnp 2>/dev/null | grep ":${port} " | awk '{print $7}' | cut -d'/' -f1 | head -1`);
        const nsPid = parseInt(ns.trim(), 10);
        if (!isNaN(nsPid) && nsPid > 0)
            return nsPid;
    }
    catch { }
    return undefined;
}
async function getServiceStatus(svc) {
    let ini = parseIniFile(svc.iniPath);
    let port = svc.port || detectServicePort(ini, svc.type);
    if (port === 0 && svc.type === 'license') {
        const altPath = path.join(svc.rootPath, 'appserver.ini');
        if (fs.existsSync(altPath)) {
            const altIni = parseIniFile(altPath);
            port = detectServicePort(altIni, svc.type);
        }
    }
    if (port > 0) {
        const inUse = await checkPortInUse(port);
        if (inUse) {
            const pid = await getPidByPort(port);
            let memory;
            if (pid) {
                try {
                    const { stdout } = await execAsync(`ps -p ${pid} -o rss= 2>/dev/null`);
                    memory = Math.round(parseInt(stdout.trim(), 10) / 1024);
                }
                catch { }
            }
            return { status: 'running', pid, port, memory };
        }
    }
    return { status: 'stopped', port };
}
async function startService(env) {
    const status = await getServiceStatus(env);
    if (status.status === 'running') {
        return { success: true, message: 'Serviço já está em execução' };
    }
    let executable = '';
    if (env.type === 'dbaccess') {
        executable = path.join(env.rootPath, 'dbaccess64');
        if (!fs.existsSync(executable)) {
            executable = path.join(env.rootPath, 'dbaccess');
        }
    }
    else {
        executable = path.join(env.rootPath, 'appsrvlinux');
    }
    if (!fs.existsSync(executable)) {
        return { success: false, message: `Executável não encontrado: ${executable}` };
    }
    try {
        const ldPath = `${env.rootPath}:${process.env.LD_LIBRARY_PATH || ''}`;
        const child = (0, child_process_1.spawn)(executable, [], {
            cwd: env.rootPath,
            detached: true,
            stdio: 'ignore',
            env: { ...process.env, LD_LIBRARY_PATH: ldPath },
        });
        child.unref();
        await new Promise(resolve => setTimeout(resolve, 5000));
        const newStatus = await getServiceStatus(env);
        if (newStatus.status === 'running') {
            return { success: true, message: 'Serviço iniciado com sucesso' };
        }
        return { success: false, message: 'Serviço iniciou mas não está respondendo na porta' };
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
        await new Promise(resolve => setTimeout(resolve, 2000));
        const newStatus = await getServiceStatus(env);
        if (newStatus.status === 'stopped') {
            return { success: true, message: 'Serviço parado com sucesso' };
        }
        await execAsync(`kill -9 ${status.pid}`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        return { success: true, message: 'Serviço parado (forçado)' };
    }
    catch (error) {
        return { success: false, message: `Erro: ${error}` };
    }
}
function createDetectedService(name, displayName, rootPath, iniPath, type) {
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
        if (files.includes('appsrvlinux') && files.includes('appserver.ini')) {
            const iniPath = path.join(dirPath, 'appserver.ini');
            const isLicense = files.includes('licenseserver.ini') || dirPath.toLowerCase().includes('license');
            if (isLicense) {
                const baseName = path.basename(dirPath).toLowerCase().replace(/\s+/g, '-');
                const parentName = path.basename(path.dirname(dirPath)).toLowerCase().replace(/\s+/g, '-');
                result.licenses.push(createDetectedService(`license-${parentName}-${baseName}`, `License Server - ${path.basename(path.dirname(dirPath))}`, dirPath, files.includes('licenseserver.ini') ? path.join(dirPath, 'licenseserver.ini') : iniPath, 'license'));
            }
            else {
                result.appservers.push(createDetectedService(path.basename(dirPath).toLowerCase().replace(/\s+/g, '-'), `${path.basename(dirPath)} (${path.basename(path.dirname(dirPath))})`, dirPath, iniPath, 'appserver'));
            }
        }
        if ((files.includes('dbaccess64') || files.includes('dbaccess')) && files.includes('dbaccess.ini')) {
            result.dbaccess.push(createDetectedService(path.basename(dirPath).toLowerCase().replace(/\s+/g, '-'), `DbAccess - ${path.basename(path.dirname(dirPath))}`, dirPath, path.join(dirPath, 'dbaccess.ini'), 'dbaccess'));
        }
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
// READLINE
// ============================================================================
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});
function prompt(question) {
    return new Promise(resolve => {
        rl.question(question, answer => resolve(answer.trim()));
    });
}
function close() {
    rl.close();
}
// ============================================================================
// MENUS
// ============================================================================
async function showMainMenu(config) {
    while (true) {
        printHeader();
        // Resumo rápido do estado
        let totalServices = config.services.length;
        let totalRunning = 0;
        for (const svc of config.services.filter(s => s.enabled)) {
            const st = await getServiceStatus(svc);
            if (st.status === 'running')
                totalRunning++;
        }
        const statusSummary = totalServices === 0
            ? `${c.dim}Nenhum serviço configurado${c.reset}`
            : totalRunning === totalServices
                ? `${c.green}● ${totalRunning}/${totalServices} ativos${c.reset}`
                : totalRunning > 0
                    ? `${c.yellow}◐ ${totalRunning}/${totalServices} ativos${c.reset}`
                    : `${c.red}○ ${totalRunning}/${totalServices} ativos${c.reset}`;
        console.log(`  ${c.bold}${c.white}NCLOUD AGENT${c.reset}  ${c.dim}v${VERSION}${c.reset}  ${statusSummary}`);
        console.log();
        printLine();
        console.log(`     ${c.white}1${c.reset}   ${c.cyan}☁  Instâncias Protheus${c.reset}       ${c.dim}Grupos: DEV, QA, PROD${c.reset}`);
        console.log(`     ${c.white}2${c.reset}   ${c.cyan}⚡ Gerenciar Serviços${c.reset}        ${c.dim}AppServer, DBAccess, License${c.reset}`);
        console.log(`     ${c.white}3${c.reset}   ${c.cyan}📋 Status dos Serviços${c.reset}       ${c.dim}Visão geral${c.reset}`);
        console.log(`     ${c.white}4${c.reset}   ${c.cyan}🗂  Ambientes INI${c.reset}             ${c.dim}Seções [ENV] dos appserver.ini${c.reset}`);
        printLine();
        console.log(`     ${c.white}5${c.reset}   ${c.cyan}🔍 Auto-detectar Serviços${c.reset}    ${c.dim}Scan de diretórios${c.reset}`);
        console.log(`     ${c.white}6${c.reset}   ${c.cyan}🛠  Configurar Serviços${c.reset}      ${c.dim}Adicionar/editar manualmente${c.reset}`);
        console.log(`     ${c.white}7${c.reset}   ${c.cyan}⚙  Configurações da API${c.reset}     ${c.dim}Porta, host, token${c.reset}`);
        console.log(`     ${c.white}8${c.reset}   ${c.cyan}🔗 Gerenciar Webhooks${c.reset}       ${c.dim}Notificações de eventos${c.reset}`);
        console.log(`     ${c.white}9${c.reset}   ${c.cyan}🔄 Controle do Daemon${c.reset}       ${c.dim}Iniciar/parar, systemd${c.reset}`);
        printLine();
        console.log(`     ${c.white}0${c.reset}   ${c.dim}Sair${c.reset}`);
        console.log();
        const choice = await prompt(`  Selecione: `);
        switch (choice) {
            case '1':
                await showInstancesMenu(config);
                break;
            case '2':
                await showServicesMenu(config);
                break;
            case '3':
                await showStatusMenu(config);
                break;
            case '4':
                await showIniEnvironmentsMenu(config);
                break;
            case '5':
                await runAutoDetect(config);
                break;
            case '6':
                await showServicesConfigMenu(config);
                break;
            case '7':
                await showApiConfigMenu(config);
                break;
            case '8':
                await showWebhooksMenu(config);
                break;
            case '9':
                await showDaemonMenu(config);
                break;
            case '0':
            case '':
                close();
                console.log();
                msgInfo('Até logo!');
                console.log();
                process.exit(0);
            default:
                msgFail('Opção inválida');
                await prompt('  Pressione Enter para continuar...');
        }
    }
}
// ============================================================================
// SERVICES MENU
// ============================================================================
async function showServicesMenu(config) {
    while (true) {
        printHeader();
        console.log(`  ${c.bold}${c.white}GERENCIAR SERVIÇOS${c.reset}`);
        console.log();
        if (config.services.length === 0) {
            msgWarn('Nenhum serviço configurado. Use "Auto-detectar" primeiro.');
            await prompt('  Pressione Enter para voltar...');
            return;
        }
        for (let i = 0; i < config.services.length; i++) {
            const svc = config.services[i];
            const status = await getServiceStatus(svc);
            const statusIcon = status.status === 'running' ? `${c.green}●${c.reset}` : `${c.red}○${c.reset}`;
            const statusText = status.status === 'running'
                ? `${c.green}ativo${c.reset} ${c.gray}(porta ${status.port}, pid ${status.pid})${c.reset}`
                : `${c.dim}parado${c.reset}`;
            // Mostra instância associada
            const instance = config.instances.find(inst => inst.services.includes(svc.name));
            const instanceTag = instance ? `${c.magenta}[${instance.displayName}]${c.reset} ` : '';
            console.log(`     ${c.white}${i + 1}${c.reset}   ${statusIcon}  ${instanceTag}${svc.displayName}  ${statusText}`);
        }
        console.log();
        printLine();
        console.log(`     ${c.white}A${c.reset}   ${c.green}Iniciar Todos${c.reset}`);
        console.log(`     ${c.white}P${c.reset}   ${c.red}Parar Todos${c.reset}`);
        console.log(`     ${c.white}R${c.reset}   ${c.yellow}Reiniciar Todos${c.reset}`);
        printLine();
        console.log(`     ${c.white}0${c.reset}   ${c.dim}Voltar${c.reset}`);
        console.log();
        const choice = await prompt(`  Selecione (número ou A/P/R): `);
        if (choice === '0' || choice === '')
            return;
        if (choice.toLowerCase() === 'a') {
            await startAllServices(config);
            continue;
        }
        if (choice.toLowerCase() === 'p') {
            await stopAllServices(config);
            continue;
        }
        if (choice.toLowerCase() === 'r') {
            await stopAllServices(config);
            await startAllServices(config);
            continue;
        }
        const index = parseInt(choice, 10) - 1;
        if (index >= 0 && index < config.services.length) {
            await showServiceActions(config.services[index]);
        }
    }
}
async function showServiceActions(env) {
    while (true) {
        printHeader();
        const status = await getServiceStatus(env);
        console.log(`  ${c.bold}${c.white}${env.displayName}${c.reset}`);
        console.log(`  ${c.gray}${env.rootPath}${c.reset}`);
        console.log();
        if (status.status === 'running') {
            console.log(`  Status: ${c.green}●${c.reset} ${c.green}Ativo${c.reset}`);
            console.log(`  Porta:  ${c.cyan}${status.port}${c.reset}`);
            console.log(`  PID:    ${c.cyan}${status.pid}${c.reset}`);
            if (status.memory)
                console.log(`  Memória: ${c.cyan}${status.memory} MB${c.reset}`);
        }
        else {
            console.log(`  Status: ${c.red}○${c.reset} ${c.dim}Parado${c.reset}`);
        }
        console.log();
        printLine();
        if (status.status === 'running') {
            console.log(`     ${c.white}1${c.reset}   ${c.red}Parar${c.reset}`);
            console.log(`     ${c.white}2${c.reset}   ${c.yellow}Reiniciar${c.reset}`);
        }
        else {
            console.log(`     ${c.white}1${c.reset}   ${c.green}Iniciar${c.reset}`);
        }
        console.log(`     ${c.white}0${c.reset}   ${c.dim}Voltar${c.reset}`);
        console.log();
        const choice = await prompt(`  Selecione: `);
        if (choice === '0' || choice === '')
            return;
        if (choice === '1') {
            if (status.status === 'running') {
                console.log();
                msgInfo('Parando serviço...');
                const result = await stopService(env);
                result.success ? msgOk(result.message) : msgFail(result.message);
            }
            else {
                console.log();
                msgInfo('Iniciando serviço...');
                const result = await startService(env);
                result.success ? msgOk(result.message) : msgFail(result.message);
            }
            await prompt('  Pressione Enter para continuar...');
        }
        if (choice === '2' && status.status === 'running') {
            console.log();
            msgInfo('Reiniciando serviço...');
            await stopService(env);
            await new Promise(resolve => setTimeout(resolve, 2000));
            const result = await startService(env);
            result.success ? msgOk(result.message) : msgFail(result.message);
            await prompt('  Pressione Enter para continuar...');
        }
    }
}
async function startAllServices(config) {
    console.log();
    for (const svc of config.services.filter(s => s.enabled)) {
        msgInfo(`Iniciando ${svc.displayName}...`);
        const result = await startService(svc);
        result.success ? msgOk(result.message) : msgFail(result.message);
    }
    await prompt('  Pressione Enter para continuar...');
}
async function stopAllServices(config) {
    console.log();
    for (const svc of config.services.filter(s => s.enabled)) {
        msgInfo(`Parando ${svc.displayName}...`);
        const result = await stopService(svc);
        result.success ? msgOk(result.message) : msgFail(result.message);
    }
    await prompt('  Pressione Enter para continuar...');
}
async function showStatusMenu(config) {
    printHeader();
    console.log(`  ${c.bold}${c.white}STATUS DOS SERVIÇOS${c.reset}`);
    console.log();
    if (config.services.length === 0) {
        msgWarn('Nenhum serviço configurado.');
        await prompt('  Pressione Enter para voltar...');
        return;
    }
    let running = 0;
    let stopped = 0;
    for (const svc of config.services) {
        const status = await getServiceStatus(svc);
        if (status.status === 'running') {
            running++;
            console.log(`  ${c.green}●${c.reset}  ${svc.displayName.padEnd(25)} ${c.gray}porta${c.reset} ${String(status.port).padEnd(5)} ${c.green}ativo${c.reset} ${c.gray}pid${c.reset} ${status.pid}`);
        }
        else {
            stopped++;
            console.log(`  ${c.red}○${c.reset}  ${c.dim}${svc.displayName.padEnd(25)} porta ${String(status.port || '-').padEnd(5)} parado${c.reset}`);
        }
    }
    console.log();
    printLine();
    if (running === config.services.length) {
        console.log(`  ${c.green}✓${c.reset} Todos os serviços ativos ${c.gray}(${running}/${config.services.length})${c.reset}`);
    }
    else if (running === 0) {
        console.log(`  ${c.red}✗${c.reset} Todos os serviços parados ${c.gray}(${running}/${config.services.length})${c.reset}`);
    }
    else {
        console.log(`  ${c.yellow}⚠${c.reset} Parcial ${c.gray}(${running}/${config.services.length} ativos)${c.reset}`);
    }
    console.log();
    await prompt('  Pressione Enter para voltar...');
}
// ============================================================================
// INSTANCES MENU
// ============================================================================
async function showInstancesMenu(config) {
    while (true) {
        printHeader();
        console.log(`  ${c.bold}${c.white}GERENCIAR INSTÂNCIAS${c.reset}`);
        console.log(`  ${c.gray}Instâncias são grupos de serviços (DEV, QA, PROD)${c.reset}`);
        console.log();
        if (config.instances.length === 0) {
            msgWarn('Nenhuma instância configurada.');
        }
        else {
            for (let i = 0; i < config.instances.length; i++) {
                const inst = config.instances[i];
                const typeColor = inst.type === 'DESENVOLVIMENTO' ? c.green : inst.type === 'QA' ? c.yellow : c.red;
                const typeLabel = inst.type === 'DESENVOLVIMENTO' ? 'DEV' : inst.type;
                // Conta serviços ativos
                let runningCount = 0;
                for (const svcName of inst.services) {
                    const svc = config.services.find(s => s.name === svcName);
                    if (svc) {
                        const status = await getServiceStatus(svc);
                        if (status.status === 'running')
                            runningCount++;
                    }
                }
                const statusIndicator = runningCount === inst.services.length && inst.services.length > 0
                    ? `${c.green}●${c.reset}`
                    : runningCount > 0
                        ? `${c.yellow}◐${c.reset}`
                        : `${c.red}○${c.reset}`;
                console.log(`     ${c.white}${i + 1}${c.reset}   ${statusIndicator}  ${typeColor}[${typeLabel}]${c.reset} ${inst.displayName}`);
                console.log(`         ${c.dim}${inst.services.length} serviço(s) - ${runningCount} ativo(s)${c.reset}`);
            }
        }
        console.log();
        printLine();
        console.log(`     ${c.white}N${c.reset}   ${c.cyan}Nova instância${c.reset}`);
        console.log(`     ${c.white}0${c.reset}   ${c.dim}Voltar${c.reset}`);
        console.log();
        const choice = await prompt(`  Selecione: `);
        if (choice === '0' || choice === '')
            return;
        if (choice.toLowerCase() === 'n') {
            await createInstance(config);
            continue;
        }
        const index = parseInt(choice, 10) - 1;
        if (index >= 0 && index < config.instances.length) {
            await showInstanceDetails(config, index);
        }
    }
}
async function createInstance(config) {
    printHeader();
    console.log(`  ${c.bold}${c.white}NOVA INSTÂNCIA${c.reset}`);
    console.log();
    const name = await prompt(`  Nome (identificador): `);
    if (!name)
        return;
    const displayName = await prompt(`  Nome de exibição: `);
    if (!displayName)
        return;
    console.log();
    console.log(`  Tipo da instância:`);
    console.log(`     ${c.white}1${c.reset}   ${c.green}DESENVOLVIMENTO${c.reset}`);
    console.log(`     ${c.white}2${c.reset}   ${c.yellow}QA${c.reset}`);
    console.log(`     ${c.white}3${c.reset}   ${c.red}PRODUÇÃO${c.reset}`);
    const typeChoice = await prompt(`  Selecione: `);
    const types = {
        '1': 'DESENVOLVIMENTO',
        '2': 'QA',
        '3': 'PRODUCAO',
    };
    const type = types[typeChoice] || 'DESENVOLVIMENTO';
    const description = await prompt(`  Descrição (opcional): `);
    const newInstance = {
        id: crypto.randomUUID(),
        name: name.toLowerCase().replace(/\s+/g, '-'),
        displayName,
        type,
        description: description || '',
        services: [],
        enabled: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
    config.instances.push(newInstance);
    saveConfig(config);
    msgOk('Instância criada com sucesso!');
    await prompt('  Pressione Enter para continuar...');
}
async function showInstanceDetails(config, index) {
    while (true) {
        printHeader();
        const inst = config.instances[index];
        if (!inst)
            return; // Proteção caso tenha sido removida
        const typeColor = inst.type === 'DESENVOLVIMENTO' ? c.green : inst.type === 'QA' ? c.yellow : c.red;
        const typeLabel = inst.type === 'DESENVOLVIMENTO' ? 'DEV' : inst.type;
        console.log(`  ${c.bold}${c.white}${inst.displayName}${c.reset}  ${typeColor}[${typeLabel}]${c.reset}`);
        if (inst.description) {
            console.log(`  ${c.dim}${inst.description}${c.reset}`);
        }
        console.log();
        // ── Serviços com status detalhado ──
        if (inst.services.length === 0) {
            msgWarn('Nenhum serviço associado a esta instância.');
        }
        else {
            console.log(`  ${c.bold}${c.white}SERVIÇOS${c.reset}  ${c.dim}(${inst.services.length})${c.reset}`);
            console.log();
            let runningCount = 0;
            for (const svcName of inst.services) {
                const svc = config.services.find(s => s.name === svcName);
                if (!svc) {
                    console.log(`     ${c.dim}○  ${svcName} ${c.red}(não encontrado)${c.reset}`);
                    continue;
                }
                const status = await getServiceStatus(svc);
                if (status.status === 'running') {
                    runningCount++;
                    const portStr = status.port ? `porta ${c.cyan}${status.port}${c.reset}` : '';
                    const pidStr = status.pid ? `pid ${c.cyan}${status.pid}${c.reset}` : '';
                    const memStr = status.memory ? `${c.cyan}${status.memory}MB${c.reset}` : '';
                    const details = [portStr, pidStr, memStr].filter(Boolean).join('  ');
                    console.log(`     ${c.green}●${c.reset}  ${svc.displayName}  ${c.dim}(${svc.type})${c.reset}`);
                    console.log(`        ${details}`);
                }
                else {
                    const portStr = status.port ? `porta ${status.port}` : 'sem porta';
                    console.log(`     ${c.red}○${c.reset}  ${c.dim}${svc.displayName}  (${svc.type})  ${portStr}${c.reset}`);
                }
            }
            console.log();
            // Resumo inline
            if (runningCount === inst.services.length) {
                console.log(`  ${c.green}✓${c.reset} Todos os serviços ativos`);
            }
            else if (runningCount > 0) {
                console.log(`  ${c.yellow}⚠${c.reset} ${runningCount}/${inst.services.length} ativo(s)`);
            }
            else {
                console.log(`  ${c.red}✗${c.reset} Todos os serviços parados`);
            }
        }
        // ── Ambientes INI (prévia rápida) ──
        const appSvcs = inst.services
            .map(name => config.services.find(s => s.name === name))
            .filter((s) => !!s && (s.type === 'appserver' || s.type === 'rest'));
        if (appSvcs.length > 0) {
            let totalEnvs = 0;
            for (const svc of appSvcs) {
                totalEnvs += extractEnvironmentsFromIni(svc.iniPath).length;
            }
            if (totalEnvs > 0) {
                console.log(`  ${c.dim}📋 ${totalEnvs} ambiente(s) INI disponíveis${c.reset}`);
            }
        }
        console.log();
        printLine();
        console.log(`     ${c.white}S${c.reset}   ${c.green}▶ Iniciar todos${c.reset}`);
        console.log(`     ${c.white}P${c.reset}   ${c.red}■ Parar todos${c.reset}`);
        console.log(`     ${c.white}R${c.reset}   ${c.yellow}↻ Reiniciar todos${c.reset}`);
        printLine();
        console.log(`     ${c.white}A${c.reset}   ${c.cyan}Associar serviço${c.reset}`);
        console.log(`     ${c.white}X${c.reset}   ${c.red}Remover serviço${c.reset}`);
        console.log(`     ${c.white}E${c.reset}   ${c.yellow}Editar instância${c.reset}`);
        console.log(`     ${c.white}D${c.reset}   ${c.red}Excluir instância${c.reset}`);
        printLine();
        console.log(`     ${c.white}I${c.reset}   ${c.cyan}Ver Ambientes INI${c.reset}          ${c.dim}Seções [ENV] dos serviços desta instância${c.reset}`);
        console.log(`     ${c.white}0${c.reset}   ${c.dim}Voltar${c.reset}`);
        console.log();
        const choice = await prompt(`  Selecione: `);
        if (choice === '0' || choice === '')
            return;
        switch (choice.toLowerCase()) {
            case 'a':
                await addServiceToInstance(config, inst);
                break;
            case 'x':
                await removeServiceFromInstance(config, inst);
                break;
            case 's':
                await startInstanceServices(config, inst);
                break;
            case 'p':
                await stopInstanceServices(config, inst);
                break;
            case 'r':
                await restartInstanceServices(config, inst);
                break;
            case 'e':
                await editInstance(config, inst);
                break;
            case 'd': {
                const confirmDel = await prompt(`  ${c.red}Confirma exclusão? (s/n):${c.reset} `);
                if (confirmDel.toLowerCase() === 's') {
                    config.instances.splice(index, 1);
                    saveConfig(config);
                    msgOk('Instância excluída');
                    await prompt('  Pressione Enter para continuar...');
                    return;
                }
                break;
            }
            case 'i':
                await showInstanceIniEnvironments(config, inst);
                break;
        }
    }
}
async function addServiceToInstance(config, inst) {
    printHeader();
    console.log(`  ${c.bold}${c.white}ASSOCIAR SERVIÇO${c.reset}`);
    console.log(`  ${c.gray}Instância: ${inst.displayName}${c.reset}`);
    console.log();
    const availableServices = config.services.filter(s => !inst.services.includes(s.name));
    if (availableServices.length === 0) {
        msgWarn('Todos os serviços já estão associados a esta instância.');
        await prompt('  Pressione Enter para voltar...');
        return;
    }
    console.log(`  Serviços disponíveis:`);
    for (let i = 0; i < availableServices.length; i++) {
        const env = availableServices[i];
        console.log(`     ${c.white}${i + 1}${c.reset}   ${env.displayName}`);
    }
    console.log();
    const choice = await prompt(`  Selecione (ou Enter para cancelar): `);
    if (!choice)
        return;
    const index = parseInt(choice, 10) - 1;
    if (index >= 0 && index < availableServices.length) {
        inst.services.push(availableServices[index].name);
        inst.updatedAt = new Date().toISOString();
        saveConfig(config);
        msgOk(`Serviço ${availableServices[index].displayName} associado`);
    }
    await prompt('  Pressione Enter para continuar...');
}
async function removeServiceFromInstance(config, inst) {
    printHeader();
    console.log(`  ${c.bold}${c.white}REMOVER SERVIÇO${c.reset}`);
    console.log(`  ${c.gray}Instância: ${inst.displayName}${c.reset}`);
    console.log();
    if (inst.services.length === 0) {
        msgWarn('Nenhum serviço associado.');
        await prompt('  Pressione Enter para voltar...');
        return;
    }
    console.log(`  Serviços associados:`);
    for (let i = 0; i < inst.services.length; i++) {
        const svc = config.services.find(s => s.name === inst.services[i]);
        const name = svc?.displayName || inst.services[i];
        console.log(`     ${c.white}${i + 1}${c.reset}   ${name}`);
    }
    console.log();
    const choice = await prompt(`  Selecione (ou Enter para cancelar): `);
    if (!choice)
        return;
    const index = parseInt(choice, 10) - 1;
    if (index >= 0 && index < inst.services.length) {
        const removed = inst.services.splice(index, 1);
        inst.updatedAt = new Date().toISOString();
        saveConfig(config);
        msgOk(`Serviço removido`);
    }
    await prompt('  Pressione Enter para continuar...');
}
async function startInstanceServices(config, inst) {
    console.log();
    for (const svcName of inst.services) {
        const svc = config.services.find(s => s.name === svcName);
        if (svc) {
            msgInfo(`Iniciando ${svc.displayName}...`);
            const result = await startService(svc);
            result.success ? msgOk(result.message) : msgFail(result.message);
        }
    }
    await prompt('  Pressione Enter para continuar...');
}
async function stopInstanceServices(config, inst) {
    console.log();
    for (const svcName of inst.services) {
        const svc = config.services.find(s => s.name === svcName);
        if (svc) {
            msgInfo(`Parando ${svc.displayName}...`);
            const result = await stopService(svc);
            result.success ? msgOk(result.message) : msgFail(result.message);
        }
    }
    await prompt('  Pressione Enter para continuar...');
}
async function restartInstanceServices(config, inst) {
    console.log();
    msgInfo('Parando serviços...');
    for (const svcName of inst.services) {
        const svc = config.services.find(s => s.name === svcName);
        if (svc) {
            msgInfo(`Parando ${svc.displayName}...`);
            const result = await stopService(svc);
            result.success ? msgOk(result.message) : msgFail(result.message);
        }
    }
    console.log();
    msgInfo('Aguardando 2 segundos...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log();
    msgInfo('Iniciando serviços...');
    for (const svcName of inst.services) {
        const svc = config.services.find(s => s.name === svcName);
        if (svc) {
            msgInfo(`Iniciando ${svc.displayName}...`);
            const result = await startService(svc);
            result.success ? msgOk(result.message) : msgFail(result.message);
        }
    }
    await prompt('  Pressione Enter para continuar...');
}
async function editInstance(config, inst) {
    printHeader();
    console.log(`  ${c.bold}${c.white}EDITAR INSTÂNCIA${c.reset}`);
    console.log();
    const newName = await prompt(`  Nome de exibição [${inst.displayName}]: `);
    if (newName)
        inst.displayName = newName;
    const newDesc = await prompt(`  Descrição [${inst.description || '(vazio)'}]: `);
    if (newDesc)
        inst.description = newDesc;
    console.log();
    console.log(`  Tipo da instância:`);
    console.log(`     ${c.white}1${c.reset}   ${c.green}DESENVOLVIMENTO${c.reset}`);
    console.log(`     ${c.white}2${c.reset}   ${c.yellow}QA${c.reset}`);
    console.log(`     ${c.white}3${c.reset}   ${c.red}PRODUÇÃO${c.reset}`);
    const typeChoice = await prompt(`  Novo tipo (Enter para manter): `);
    if (typeChoice) {
        const types = { '1': 'DESENVOLVIMENTO', '2': 'QA', '3': 'PRODUCAO' };
        if (types[typeChoice])
            inst.type = types[typeChoice];
    }
    inst.updatedAt = new Date().toISOString();
    saveConfig(config);
    msgOk('Instância atualizada!');
    await prompt('  Pressione Enter para continuar...');
}
// ============================================================================
// INI ENVIRONMENTS MENU (AMBIENTES)
// ============================================================================
/**
 * Exibe ambientes INI agrupados por Instância → Serviço
 * Ambientes = seções [ENV] do appserver.ini com SourcePath + RootPath
 */
async function showIniEnvironmentsMenu(config) {
    printHeader();
    console.log(`  ${c.bold}${c.white}AMBIENTES INI${c.reset}`);
    console.log(`  ${c.gray}Seções [ENVIRONMENT] configuradas nos arquivos appserver.ini${c.reset}`);
    console.log();
    const appservers = config.services.filter(s => s.type === 'appserver' || s.type === 'rest');
    if (appservers.length === 0) {
        msgWarn('Nenhum AppServer/REST configurado.');
        await prompt('  Pressione Enter para voltar...');
        return;
    }
    // Agrupa por instância
    const instanceGroups = new Map();
    // Serviços com instância
    for (const inst of config.instances) {
        const instServices = appservers.filter(svc => inst.services.includes(svc.name));
        if (instServices.length > 0) {
            instanceGroups.set(inst.id, { instance: inst, services: instServices });
        }
    }
    // Serviços sem instância ("avulsos")
    const assignedNames = new Set(config.instances.flatMap(inst => inst.services));
    const unassigned = appservers.filter(svc => !assignedNames.has(svc.name));
    if (unassigned.length > 0) {
        instanceGroups.set('__unassigned__', { instance: null, services: unassigned });
    }
    let totalEnvs = 0;
    for (const [, group] of instanceGroups) {
        if (group.instance) {
            const typeColor = group.instance.type === 'DESENVOLVIMENTO' ? c.green : group.instance.type === 'QA' ? c.yellow : c.red;
            const typeLabel = group.instance.type === 'DESENVOLVIMENTO' ? 'DEV' : group.instance.type;
            console.log(`  ${c.bold}${c.white}INSTÂNCIA: ${group.instance.displayName}${c.reset}  ${typeColor}[${typeLabel}]${c.reset}`);
        }
        else {
            console.log(`  ${c.bold}${c.dim}SERVIÇOS SEM INSTÂNCIA${c.reset}`);
        }
        console.log();
        for (const svc of group.services) {
            console.log(`  ${c.cyan}└─ ${svc.displayName}${c.reset}  ${c.dim}(${svc.iniPath})${c.reset}`);
            console.log();
            const environments = extractEnvironmentsFromIni(svc.iniPath);
            if (environments.length === 0) {
                console.log(`     ${c.dim}Nenhum ambiente encontrado${c.reset}`);
            }
            else {
                for (const iniEnv of environments) {
                    totalEnvs++;
                    console.log(`     ${c.magenta}[${iniEnv.name}]${c.reset}`);
                    console.log(`        SourcePath: ${c.cyan}${iniEnv.sourcePath}${c.reset}`);
                    console.log(`        RootPath:   ${c.cyan}${iniEnv.rootPath}${c.reset}`);
                    if (iniEnv.rpoCustom)
                        console.log(`        RPOCustom:  ${c.cyan}${iniEnv.rpoCustom}${c.reset}`);
                    if (iniEnv.dbAlias)
                        console.log(`        DBAlias:    ${c.cyan}${iniEnv.dbAlias}${c.reset}`);
                    if (iniEnv.dbServer)
                        console.log(`        DBServer:   ${c.cyan}${iniEnv.dbServer}:${iniEnv.dbPort || ''}${c.reset}`);
                    console.log();
                }
            }
        }
        printLine();
        console.log();
    }
    console.log(`  ${c.dim}Total: ${totalEnvs} ambiente(s) encontrado(s)${c.reset}`);
    console.log();
    await prompt('  Pressione Enter para voltar...');
}
/**
 * Exibe ambientes INI apenas de uma instância específica
 * Chamado a partir do menu de detalhes da instância
 */
async function showInstanceIniEnvironments(config, inst) {
    printHeader();
    const typeColor = inst.type === 'DESENVOLVIMENTO' ? c.green : inst.type === 'QA' ? c.yellow : c.red;
    const typeLabel = inst.type === 'DESENVOLVIMENTO' ? 'DEV' : inst.type;
    console.log(`  ${c.bold}${c.white}AMBIENTES INI${c.reset}`);
    console.log(`  ${c.gray}Instância:${c.reset} ${inst.displayName} ${typeColor}[${typeLabel}]${c.reset}`);
    console.log();
    const appSvcs = inst.services
        .map(name => config.services.find(s => s.name === name))
        .filter((s) => !!s && (s.type === 'appserver' || s.type === 'rest'));
    if (appSvcs.length === 0) {
        msgWarn('Nenhum AppServer/REST associado a esta instância.');
        await prompt('  Pressione Enter para voltar...');
        return;
    }
    let totalEnvs = 0;
    for (const svc of appSvcs) {
        console.log(`  ${c.cyan}└─ ${svc.displayName}${c.reset}  ${c.dim}(${svc.iniPath})${c.reset}`);
        console.log();
        const environments = extractEnvironmentsFromIni(svc.iniPath);
        if (environments.length === 0) {
            console.log(`     ${c.dim}Nenhum ambiente encontrado${c.reset}`);
        }
        else {
            for (const iniEnv of environments) {
                totalEnvs++;
                console.log(`     ${c.magenta}[${iniEnv.name}]${c.reset}`);
                console.log(`        SourcePath: ${c.cyan}${iniEnv.sourcePath}${c.reset}`);
                console.log(`        RootPath:   ${c.cyan}${iniEnv.rootPath}${c.reset}`);
                if (iniEnv.rpoCustom)
                    console.log(`        RPOCustom:  ${c.cyan}${iniEnv.rpoCustom}${c.reset}`);
                if (iniEnv.dbAlias)
                    console.log(`        DBAlias:    ${c.cyan}${iniEnv.dbAlias}${c.reset}`);
                if (iniEnv.dbServer)
                    console.log(`        DBServer:   ${c.cyan}${iniEnv.dbServer}:${iniEnv.dbPort || ''}${c.reset}`);
                console.log();
            }
        }
        printLine();
        console.log();
    }
    console.log(`  ${c.dim}Total: ${totalEnvs} ambiente(s) encontrado(s)${c.reset}`);
    console.log();
    await prompt('  Pressione Enter para voltar...');
}
// ============================================================================
// OTHER MENUS (environments, auto-detect, api config, daemon)
// ============================================================================
async function showServicesConfigMenu(config) {
    while (true) {
        printHeader();
        console.log(`  ${c.bold}${c.white}SERVIÇOS CONFIGURADOS${c.reset}`);
        console.log();
        if (config.services.length === 0) {
            msgWarn('Nenhum serviço configurado.');
        }
        else {
            for (let i = 0; i < config.services.length; i++) {
                const svc = config.services[i];
                const status = svc.enabled ? `${c.green}✓${c.reset}` : `${c.dim}○${c.reset}`;
                console.log(`     ${c.white}${i + 1}${c.reset}   ${status}  ${svc.displayName} ${c.gray}(${svc.type})${c.reset}`);
                console.log(`         ${c.dim}${svc.rootPath}${c.reset}`);
            }
        }
        console.log();
        printLine();
        console.log(`     ${c.white}A${c.reset}   ${c.cyan}Adicionar manualmente${c.reset}`);
        console.log(`     ${c.white}D${c.reset}   ${c.cyan}Auto-detectar${c.reset}`);
        console.log(`     ${c.white}0${c.reset}   ${c.dim}Voltar${c.reset}`);
        console.log();
        const choice = await prompt(`  Selecione: `);
        if (choice === '0' || choice === '')
            return;
        if (choice.toLowerCase() === 'a') {
            await addServiceManually(config);
            continue;
        }
        if (choice.toLowerCase() === 'd') {
            await runAutoDetect(config);
            continue;
        }
        const index = parseInt(choice, 10) - 1;
        if (index >= 0 && index < config.services.length) {
            await editServiceConfig(config, index);
        }
    }
}
async function addServiceManually(config) {
    printHeader();
    console.log(`  ${c.bold}${c.white}ADICIONAR SERVIÇO${c.reset}`);
    console.log();
    const name = await prompt(`  Nome (identificador): `);
    if (!name)
        return;
    const displayName = await prompt(`  Nome de exibição: `);
    const rootPath = await prompt(`  Caminho do diretório: `);
    if (!rootPath || !fs.existsSync(rootPath)) {
        msgFail('Diretório não encontrado');
        await prompt('  Pressione Enter para voltar...');
        return;
    }
    const iniPath = await prompt(`  Caminho do arquivo INI [${rootPath}/appserver.ini]: `) || path.join(rootPath, 'appserver.ini');
    console.log();
    console.log(`  Tipo:`);
    console.log(`     1  AppServer`);
    console.log(`     2  DbAccess`);
    console.log(`     3  License Server`);
    console.log(`     4  REST API`);
    const typeChoice = await prompt(`  Selecione: `);
    const types = {
        '1': 'appserver',
        '2': 'dbaccess',
        '3': 'license',
        '4': 'rest',
    };
    const type = types[typeChoice] || 'appserver';
    const now = new Date().toISOString();
    config.services.push({
        id: crypto.randomUUID(),
        name: name.toLowerCase().replace(/\s+/g, '-'),
        displayName: displayName || name,
        rootPath,
        iniPath,
        enabled: true,
        type,
        createdAt: now,
        updatedAt: now,
    });
    saveConfig(config);
    msgOk('Serviço adicionado com sucesso!');
    await prompt('  Pressione Enter para continuar...');
}
async function editServiceConfig(config, index) {
    const svc = config.services[index];
    printHeader();
    console.log(`  ${c.bold}${c.white}EDITAR: ${svc.displayName}${c.reset}`);
    console.log();
    console.log(`  ${c.gray}${svc.rootPath}${c.reset}`);
    console.log();
    printLine();
    console.log(`     ${c.white}1${c.reset}   ${svc.enabled ? 'Desativar' : 'Ativar'}`);
    console.log(`     ${c.white}2${c.reset}   ${c.red}Remover${c.reset}`);
    console.log(`     ${c.white}0${c.reset}   ${c.dim}Voltar${c.reset}`);
    console.log();
    const choice = await prompt(`  Selecione: `);
    if (choice === '1') {
        svc.enabled = !svc.enabled;
        svc.updatedAt = new Date().toISOString();
        saveConfig(config);
        msgOk(svc.enabled ? 'Serviço ativado' : 'Serviço desativado');
        await prompt('  Pressione Enter para continuar...');
    }
    if (choice === '2') {
        const confirm = await prompt(`  Confirma remoção? (s/n): `);
        if (confirm.toLowerCase() === 's') {
            config.services.splice(index, 1);
            saveConfig(config);
            msgOk('Serviço removido');
            await prompt('  Pressione Enter para continuar...');
        }
    }
}
async function runAutoDetect(config) {
    printHeader();
    console.log(`  ${c.bold}${c.white}AUTO-DETECTAR SERVIÇOS${c.reset}`);
    console.log(`  ${c.gray}Escaneia diretórios em busca de AppServers, DBAccess e License Servers${c.reset}`);
    console.log();
    msgInfo('Diretórios para escanear:');
    for (const p of config.scanPaths) {
        console.log(`     ${c.gray}${p}${c.reset}`);
    }
    console.log();
    const addPath = await prompt(`  Adicionar outro diretório (ou Enter para continuar): `);
    if (addPath && fs.existsSync(addPath)) {
        const normalizedPath = path.resolve(addPath);
        const alreadyExists = config.scanPaths.some(p => path.resolve(p) === normalizedPath ||
            normalizedPath.startsWith(path.resolve(p) + path.sep));
        if (!alreadyExists) {
            config.scanPaths.push(addPath);
            saveConfig(config);
        }
        else {
            msgInfo('Diretório já está incluído na lista de scan');
        }
    }
    console.log();
    msgInfo('Escaneando...');
    const results = { appservers: [], dbaccess: [], licenses: [] };
    const seenPaths = new Set();
    for (const scanPath of config.scanPaths) {
        if (fs.existsSync(scanPath)) {
            const r = scanDirectory(scanPath);
            for (const app of r.appservers) {
                if (!seenPaths.has(app.rootPath)) {
                    seenPaths.add(app.rootPath);
                    results.appservers.push(app);
                }
            }
            for (const db of r.dbaccess) {
                if (!seenPaths.has(db.rootPath)) {
                    seenPaths.add(db.rootPath);
                    results.dbaccess.push(db);
                }
            }
            for (const lic of r.licenses) {
                if (!seenPaths.has(lic.rootPath)) {
                    seenPaths.add(lic.rootPath);
                    results.licenses.push(lic);
                }
            }
        }
    }
    const total = results.appservers.length + results.dbaccess.length + results.licenses.length;
    if (total === 0) {
        msgWarn('Nenhum componente encontrado');
        await prompt('  Pressione Enter para voltar...');
        return;
    }
    console.log();
    msgOk(`Encontrado(s) ${total} componente(s):`);
    console.log();
    const allComponents = [
        ...results.appservers,
        ...results.dbaccess,
        ...results.licenses,
    ];
    for (let i = 0; i < allComponents.length; i++) {
        const comp = allComponents[i];
        const icon = comp.type === 'appserver' ? '🖥️' : comp.type === 'dbaccess' ? '🗄️' : '🔑';
        const alreadyExists = config.services.some(s => s.rootPath === comp.rootPath);
        const existsTag = alreadyExists ? ` ${c.yellow}(já configurado)${c.reset}` : '';
        console.log(`     ${c.white}${i + 1}${c.reset}   ${icon}  ${comp.displayName}${existsTag}`);
        console.log(`         ${c.dim}${comp.rootPath}${c.reset}`);
    }
    console.log();
    const selection = await prompt(`  Adicionar quais? (ex: 1,2,3 ou "todos"): `);
    if (!selection)
        return;
    let toAdd = [];
    if (selection.toLowerCase() === 'todos') {
        toAdd = allComponents;
    }
    else {
        const indices = selection.split(',').map(s => parseInt(s.trim(), 10) - 1);
        toAdd = indices
            .filter(i => i >= 0 && i < allComponents.length)
            .map(i => allComponents[i]);
    }
    let addedCount = 0;
    for (const svc of toAdd) {
        if (!config.services.some(s => s.rootPath === svc.rootPath)) {
            config.services.push(svc);
            msgOk(`Adicionado: ${svc.displayName}`);
            addedCount++;
        }
        else {
            msgSkip(`Já existe: ${svc.displayName}`);
        }
    }
    saveConfig(config);
    // ── Associar a instância ──
    if (addedCount > 0 && config.instances.length > 0) {
        console.log();
        printLine();
        console.log();
        console.log(`  ${c.bold}${c.white}ASSOCIAR A UMA INSTÂNCIA?${c.reset}`);
        console.log(`  ${c.gray}Os serviços adicionados podem ser associados a uma instância existente.${c.reset}`);
        console.log();
        for (let i = 0; i < config.instances.length; i++) {
            const inst = config.instances[i];
            const typeColor = inst.type === 'DESENVOLVIMENTO' ? c.green : inst.type === 'QA' ? c.yellow : c.red;
            const typeLabel = inst.type === 'DESENVOLVIMENTO' ? 'DEV' : inst.type;
            console.log(`     ${c.white}${i + 1}${c.reset}   ${typeColor}[${typeLabel}]${c.reset} ${inst.displayName}  ${c.dim}(${inst.services.length} serviço(s))${c.reset}`);
        }
        console.log(`     ${c.white}0${c.reset}   ${c.dim}Pular (sem instância por agora)${c.reset}`);
        console.log();
        const instChoice = await prompt(`  Associar a: `);
        if (instChoice && instChoice !== '0') {
            const instIndex = parseInt(instChoice, 10) - 1;
            if (instIndex >= 0 && instIndex < config.instances.length) {
                const inst = config.instances[instIndex];
                // Adiciona os serviços recém-adicionados à instância
                for (const svc of toAdd) {
                    if (!inst.services.includes(svc.name) && config.services.some(s => s.rootPath === svc.rootPath)) {
                        inst.services.push(svc.name);
                    }
                }
                inst.updatedAt = new Date().toISOString();
                saveConfig(config);
                msgOk(`Serviços associados à instância "${inst.displayName}"`);
            }
        }
    }
    else if (addedCount > 0 && config.instances.length === 0) {
        console.log();
        msgInfo('Dica: Crie uma instância no menu "Instâncias Protheus" para agrupar seus serviços.');
    }
    await prompt('  Pressione Enter para continuar...');
}
async function showApiConfigMenu(config) {
    printHeader();
    console.log(`  ${c.bold}${c.white}CONFIGURAÇÕES DA API${c.reset}`);
    console.log();
    console.log(`  Porta atual:  ${c.cyan}${config.server.port}${c.reset}`);
    console.log(`  Host atual:   ${c.cyan}${config.server.host}${c.reset}`);
    console.log(`  Token:        ${c.cyan}${config.auth.token.substring(0, 10)}...${c.reset}`);
    console.log();
    const newPort = await prompt(`  Nova porta [${config.server.port}]: `);
    if (newPort) {
        config.server.port = parseInt(newPort, 10) || config.server.port;
    }
    const newHost = await prompt(`  Novo host [${config.server.host}]: `);
    if (newHost) {
        config.server.host = newHost;
    }
    const newToken = await prompt(`  Novo token (Enter para manter): `);
    if (newToken) {
        config.auth.token = newToken;
    }
    saveConfig(config);
    msgOk('Configurações salvas!');
    await prompt('  Pressione Enter para voltar...');
}
// ============================================================================
// WEBHOOKS MENU
// ============================================================================
async function showWebhooksMenu(config) {
    while (true) {
        printHeader();
        console.log(`  ${c.bold}${c.white}GERENCIAR WEBHOOKS${c.reset}`);
        console.log(`  ${c.gray}Receba notificações quando serviços mudam de estado${c.reset}`);
        console.log();
        const webhooks = config_store_js_1.daemonConfigStore.listWebhooks();
        if (webhooks.length === 0) {
            msgWarn('Nenhum webhook configurado.');
        }
        else {
            for (let i = 0; i < webhooks.length; i++) {
                const wh = webhooks[i];
                const statusIcon = wh.enabled ? `${c.green}●${c.reset}` : `${c.red}○${c.reset}`;
                const eventsText = wh.events.includes('*') ? 'Todos' : wh.events.slice(0, 2).join(', ') + (wh.events.length > 2 ? ` +${wh.events.length - 2}` : '');
                console.log(`     ${c.white}${i + 1}${c.reset}   ${statusIcon}  ${c.bold}${wh.name}${c.reset}`);
                console.log(`         ${c.dim}URL: ${wh.url.substring(0, 50)}${wh.url.length > 50 ? '...' : ''}${c.reset}`);
                console.log(`         ${c.dim}Eventos: ${eventsText}${c.reset}`);
            }
        }
        console.log();
        printLine();
        console.log(`     ${c.white}N${c.reset}   ${c.cyan}Novo webhook${c.reset}`);
        console.log(`     ${c.white}0${c.reset}   ${c.dim}Voltar${c.reset}`);
        console.log();
        const choice = await prompt(`  Selecione: `);
        if (choice === '0' || choice === '')
            return;
        if (choice.toLowerCase() === 'n') {
            await createWebhook(config);
            continue;
        }
        const index = parseInt(choice, 10) - 1;
        if (index >= 0 && index < webhooks.length) {
            await showWebhookDetails(config, webhooks[index]);
        }
    }
}
async function createWebhook(config) {
    printHeader();
    console.log(`  ${c.bold}${c.white}NOVO WEBHOOK${c.reset}`);
    console.log();
    const name = await prompt(`  Nome: `);
    if (!name)
        return;
    const url = await prompt(`  URL do endpoint: `);
    if (!url)
        return;
    const secret = await prompt(`  Secret HMAC (opcional, Enter para pular): `);
    console.log();
    console.log(`  ${c.bold}Selecione os eventos:${c.reset}`);
    console.log(`     ${c.white}1${c.reset}   ${c.yellow}*${c.reset} - Todos os eventos`);
    console.log(`     ${c.white}2${c.reset}   ${c.green}service:started${c.reset} - Serviço iniciou`);
    console.log(`     ${c.white}3${c.reset}   ${c.red}service:stopped${c.reset} - Serviço parou`);
    console.log(`     ${c.white}4${c.reset}   ${c.red}service:crashed${c.reset} - Serviço caiu`);
    console.log(`     ${c.white}5${c.reset}   ${c.yellow}service:restarted${c.reset} - Serviço reiniciou`);
    console.log(`     ${c.white}6${c.reset}   ${c.blue}service:health_changed${c.reset} - Status alterado`);
    console.log();
    const eventsChoice = await prompt(`  Eventos (separe por vírgula, ex: 1,2,3): `);
    const eventMap = {
        '1': '*',
        '2': 'service:started',
        '3': 'service:stopped',
        '4': 'service:crashed',
        '5': 'service:restarted',
        '6': 'service:health_changed',
    };
    const events = [];
    if (eventsChoice) {
        for (const e of eventsChoice.split(',').map(s => s.trim())) {
            if (eventMap[e]) {
                events.push(eventMap[e]);
            }
        }
    }
    if (events.length === 0) {
        events.push('*');
    }
    // Se selecionou '*', remove outros eventos
    if (events.includes('*')) {
        events.length = 0;
        events.push('*');
    }
    try {
        config_store_js_1.daemonConfigStore.addWebhook({
            name,
            url,
            secret: secret || undefined,
            events,
            enabled: true,
            retryCount: 3,
            retryDelayMs: 5000,
            timeoutMs: 10000,
        });
        msgOk('Webhook criado com sucesso!');
    }
    catch (error) {
        msgFail(`Erro ao criar webhook: ${error}`);
    }
    await prompt('  Pressione Enter para continuar...');
}
async function showWebhookDetails(config, webhook) {
    while (true) {
        printHeader();
        const statusIcon = webhook.enabled ? `${c.green}●${c.reset} Ativo` : `${c.red}○${c.reset} Inativo`;
        console.log(`  ${c.bold}${c.white}${webhook.name}${c.reset}`);
        console.log(`  ${statusIcon}`);
        console.log();
        console.log(`  ${c.bold}URL:${c.reset}`);
        console.log(`     ${c.cyan}${webhook.url}${c.reset}`);
        console.log();
        console.log(`  ${c.bold}Eventos:${c.reset}`);
        for (const event of webhook.events) {
            const eventColor = event === '*' ? c.yellow :
                event.includes('started') ? c.green :
                    event.includes('stopped') || event.includes('crashed') ? c.red :
                        c.blue;
            console.log(`     ${eventColor}${event}${c.reset}`);
        }
        console.log();
        console.log(`  ${c.bold}Configurações:${c.reset}`);
        console.log(`     Timeout: ${webhook.timeoutMs}ms`);
        console.log(`     Tentativas: ${webhook.retryCount}`);
        console.log(`     Intervalo: ${webhook.retryDelayMs}ms`);
        console.log(`     Secret: ${webhook.secret ? '••••••••' : 'Não definido'}`);
        console.log();
        printLine();
        console.log(`     ${c.white}T${c.reset}   ${c.green}Testar webhook${c.reset}`);
        console.log(`     ${c.white}E${c.reset}   ${c.yellow}Editar${c.reset}`);
        console.log(`     ${c.white}H${c.reset}   ${webhook.enabled ? `${c.red}Desativar${c.reset}` : `${c.green}Ativar${c.reset}`}`);
        console.log(`     ${c.white}D${c.reset}   ${c.red}Excluir${c.reset}`);
        console.log(`     ${c.white}0${c.reset}   ${c.dim}Voltar${c.reset}`);
        console.log();
        const choice = await prompt(`  Selecione: `);
        if (choice === '0' || choice === '')
            return;
        switch (choice.toLowerCase()) {
            case 't':
                await testWebhook(webhook);
                break;
            case 'e':
                await editWebhook(config, webhook);
                // Atualiza o webhook após edição
                const updated = config_store_js_1.daemonConfigStore.getWebhook(webhook.id);
                if (updated)
                    webhook = updated;
                break;
            case 'h':
                config_store_js_1.daemonConfigStore.updateWebhook(webhook.id, { enabled: !webhook.enabled });
                webhook.enabled = !webhook.enabled;
                msgOk(webhook.enabled ? 'Webhook ativado!' : 'Webhook desativado!');
                await prompt('  Pressione Enter para continuar...');
                break;
            case 'd':
                const confirm = await prompt(`  ${c.red}Confirma exclusão? (s/n):${c.reset} `);
                if (confirm.toLowerCase() === 's') {
                    config_store_js_1.daemonConfigStore.removeWebhook(webhook.id);
                    msgOk('Webhook excluído!');
                    await prompt('  Pressione Enter para continuar...');
                    return;
                }
                break;
        }
    }
}
async function testWebhook(webhook) {
    printHeader();
    console.log(`  ${c.bold}${c.white}TESTAR WEBHOOK${c.reset}`);
    console.log(`  ${c.gray}${webhook.name}${c.reset}`);
    console.log();
    msgInfo('Enviando requisição de teste...');
    console.log();
    const testPayload = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        event: {
            type: 'test',
            timestamp: Date.now(),
            details: { message: 'Evento de teste do Ncloud Agent CLI' },
        },
        agent: {
            id: 'linux-cli',
            hostname: require('os').hostname(),
            version: VERSION,
        },
    };
    const startTime = Date.now();
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), webhook.timeoutMs || 10000);
        const headers = {
            'Content-Type': 'application/json',
            'User-Agent': `NcloudAgent/${VERSION}`,
            ...webhook.headers,
        };
        // Adiciona HMAC se houver secret
        if (webhook.secret) {
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
        if (response.ok) {
            msgOk(`Webhook funcionando! Status: ${response.status}`);
            console.log(`     ${c.dim}Tempo de resposta: ${responseTime}ms${c.reset}`);
        }
        else {
            msgFail(`Falha no teste. Status: ${response.status} ${response.statusText}`);
            console.log(`     ${c.dim}Tempo de resposta: ${responseTime}ms${c.reset}`);
        }
    }
    catch (error) {
        const responseTime = Date.now() - startTime;
        msgFail(`Erro ao testar: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
        console.log(`     ${c.dim}Tempo: ${responseTime}ms${c.reset}`);
    }
    await prompt('  Pressione Enter para voltar...');
}
async function editWebhook(config, webhook) {
    printHeader();
    console.log(`  ${c.bold}${c.white}EDITAR WEBHOOK${c.reset}`);
    console.log(`  ${c.gray}${webhook.name}${c.reset}`);
    console.log();
    console.log(`  ${c.dim}Pressione Enter para manter o valor atual${c.reset}`);
    console.log();
    const name = await prompt(`  Nome [${webhook.name}]: `);
    const url = await prompt(`  URL [${webhook.url}]: `);
    const secret = await prompt(`  Secret [${webhook.secret ? '••••••••' : 'vazio'}]: `);
    const timeout = await prompt(`  Timeout ms [${webhook.timeoutMs}]: `);
    const retryCount = await prompt(`  Tentativas [${webhook.retryCount}]: `);
    const retryDelay = await prompt(`  Intervalo ms [${webhook.retryDelayMs}]: `);
    const updates = {};
    if (name)
        updates.name = name;
    if (url)
        updates.url = url;
    if (secret)
        updates.secret = secret;
    if (timeout)
        updates.timeoutMs = parseInt(timeout, 10);
    if (retryCount)
        updates.retryCount = parseInt(retryCount, 10);
    if (retryDelay)
        updates.retryDelayMs = parseInt(retryDelay, 10);
    if (Object.keys(updates).length > 0) {
        config_store_js_1.daemonConfigStore.updateWebhook(webhook.id, updates);
        msgOk('Webhook atualizado!');
    }
    else {
        msgInfo('Nenhuma alteração feita.');
    }
    await prompt('  Pressione Enter para voltar...');
}
async function showDaemonMenu(config) {
    printHeader();
    console.log(`  ${c.bold}${c.white}DAEMON/SERVIÇO${c.reset}`);
    console.log();
    let daemonRunning = false;
    try {
        const { stdout } = await execAsync('systemctl is-active ncloud-agent 2>/dev/null || echo inactive');
        daemonRunning = stdout.trim() === 'active';
    }
    catch { }
    if (daemonRunning) {
        console.log(`  Status: ${c.green}●${c.reset} ${c.green}Ativo${c.reset}`);
    }
    else {
        console.log(`  Status: ${c.red}○${c.reset} ${c.dim}Inativo${c.reset}`);
    }
    console.log();
    printLine();
    if (daemonRunning) {
        console.log(`     ${c.white}1${c.reset}   ${c.red}Parar daemon${c.reset}`);
        console.log(`     ${c.white}2${c.reset}   ${c.yellow}Reiniciar daemon${c.reset}`);
    }
    else {
        console.log(`     ${c.white}1${c.reset}   ${c.green}Iniciar daemon${c.reset}`);
    }
    console.log(`     ${c.white}3${c.reset}   ${c.cyan}Instalar serviço systemd${c.reset}`);
    console.log(`     ${c.white}4${c.reset}   ${c.cyan}Ver logs${c.reset}`);
    console.log(`     ${c.white}0${c.reset}   ${c.dim}Voltar${c.reset}`);
    console.log();
    const choice = await prompt(`  Selecione: `);
    if (choice === '1') {
        try {
            if (daemonRunning) {
                await execAsync('sudo systemctl stop ncloud-agent');
                msgOk('Daemon parado');
            }
            else {
                await execAsync('sudo systemctl start ncloud-agent');
                msgOk('Daemon iniciado');
            }
        }
        catch (error) {
            msgFail(`Erro: ${error}`);
        }
        await prompt('  Pressione Enter para continuar...');
    }
    if (choice === '2') {
        try {
            await execAsync('sudo systemctl restart ncloud-agent');
            msgOk('Daemon reiniciado');
        }
        catch (error) {
            msgFail(`Erro: ${error}`);
        }
        await prompt('  Pressione Enter para continuar...');
    }
    if (choice === '3') {
        await installSystemdService(config);
    }
    if (choice === '4') {
        try {
            const { stdout } = await execAsync('journalctl -u ncloud-agent -n 50 --no-pager');
            console.log(stdout);
        }
        catch (error) {
            msgFail('Erro ao ler logs');
        }
        await prompt('  Pressione Enter para continuar...');
    }
}
async function installSystemdService(config) {
    printHeader();
    console.log(`  ${c.bold}${c.white}INSTALAR SERVIÇO SYSTEMD${c.reset}`);
    console.log();
    const serviceContent = `[Unit]
Description=Ncloud Agent - Protheus Service Manager
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/ncloud-agent
ExecStart=/usr/bin/node /opt/ncloud-agent/dist/linux/daemon.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=NCLOUD_CONFIG=${config_store_js_1.CONFIG_FILE}

[Install]
WantedBy=multi-user.target
`;
    msgInfo('Conteúdo do serviço:');
    console.log(c.dim + serviceContent + c.reset);
    const confirm = await prompt(`  Instalar? (s/n): `);
    if (confirm.toLowerCase() === 's') {
        try {
            fs.writeFileSync('/tmp/ncloud-agent.service', serviceContent);
            await execAsync('sudo mv /tmp/ncloud-agent.service /etc/systemd/system/ncloud-agent.service');
            await execAsync('sudo systemctl daemon-reload');
            await execAsync('sudo systemctl enable ncloud-agent');
            msgOk('Serviço instalado e habilitado!');
            msgInfo('Use: sudo systemctl start ncloud-agent');
        }
        catch (error) {
            msgFail(`Erro: ${error}`);
        }
    }
    await prompt('  Pressione Enter para voltar...');
}
// ============================================================================
// MAIN
// ============================================================================
async function main() {
    const args = process.argv.slice(2);
    const config = loadConfig();
    if (args.length > 0) {
        switch (args[0]) {
            case 'status':
                await showStatusMenu(config);
                close();
                break;
            case 'start':
                if (args[1]) {
                    const svc = config.services.find(s => s.name === args[1]);
                    if (svc) {
                        const result = await startService(svc);
                        result.success ? msgOk(result.message) : msgFail(result.message);
                    }
                    else {
                        msgFail(`Serviço não encontrado: ${args[1]}`);
                    }
                }
                else {
                    await startAllServices(config);
                }
                close();
                break;
            case 'stop':
                if (args[1]) {
                    const svc = config.services.find(s => s.name === args[1]);
                    if (svc) {
                        const result = await stopService(svc);
                        result.success ? msgOk(result.message) : msgFail(result.message);
                    }
                    else {
                        msgFail(`Serviço não encontrado: ${args[1]}`);
                    }
                }
                else {
                    await stopAllServices(config);
                }
                close();
                break;
            case 'instances':
                await showInstancesMenu(config);
                close();
                break;
            case 'services':
                await showServicesMenu(config);
                close();
                break;
            case 'environments':
            case 'envs':
                await showIniEnvironmentsMenu(config);
                close();
                break;
            case 'scan':
            case 'detect':
                await runAutoDetect(config);
                close();
                break;
            case 'webhooks':
                await showWebhooksMenu(config);
                close();
                break;
            case 'help':
                console.log(`
${c.bold}Ncloud Agent CLI${c.reset} v${VERSION}
${c.dim}Hierarquia: Servidor → Instância → Serviço → Ambiente${c.reset}

${c.bold}Uso:${c.reset}
  ncloud-agent                # Menu interativo
  ncloud-agent status         # Status dos serviços
  ncloud-agent start [nome]   # Iniciar serviço(s)
  ncloud-agent stop [nome]    # Parar serviço(s)
  ncloud-agent instances      # Gerenciar instâncias
  ncloud-agent services       # Gerenciar serviços
  ncloud-agent envs           # Ver ambientes dos INIs
  ncloud-agent scan           # Auto-detectar serviços
  ncloud-agent webhooks       # Gerenciar webhooks
  ncloud-agent help           # Esta ajuda
`);
                close();
                break;
            default:
                msgFail(`Comando desconhecido: ${args[0]}`);
                close();
        }
        return;
    }
    await showMainMenu(config);
}
main().catch(console.error);
//# sourceMappingURL=cli.js.map