"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.install = install;
exports.uninstall = uninstall;
exports.showGenerateToken = showGenerateToken;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const node_child_process_1 = require("node:child_process");
const node_util_1 = require("node:util");
const index_js_1 = require("../core/config/index.js");
const execAsync = (0, node_util_1.promisify)(node_child_process_1.exec);
const INSTALL_DIR = '/opt/ncloud-agent';
const CONFIG_DIR = '/etc/ncloud-agent';
const LOG_DIR = '/var/log/ncloud-agent';
const SERVICE_FILE = '/etc/systemd/system/ncloud-agent.service';
/**
 * Instala o agente no sistema
 */
async function install() {
    console.log('Installing Ncloud Agent...\n');
    // Verifica se é root
    if (process.getuid && process.getuid() !== 0) {
        console.error('Error: Installation requires root privileges');
        console.error('Please run with sudo');
        process.exit(1);
    }
    // Cria diretórios
    console.log('Creating directories...');
    createDirectories();
    // Cria arquivo de configuração
    console.log('Creating configuration...');
    createDefaultConfig();
    // Cria arquivo de serviço systemd
    console.log('Creating systemd service...');
    createSystemdService();
    // Habilita e inicia serviço
    console.log('Enabling service...');
    await enableService();
    console.log('\n✅ Installation complete!\n');
    console.log('Next steps:');
    console.log('  1. Edit configuration: sudo nano /etc/ncloud-agent/config.json');
    console.log('  2. Add your authentication token');
    console.log('  3. Configure Protheus scan paths');
    console.log('  4. Start the service: sudo systemctl start ncloud-agent');
    console.log('  5. Check status: sudo systemctl status ncloud-agent');
}
/**
 * Desinstala o agente
 */
async function uninstall() {
    console.log('Uninstalling Ncloud Agent...\n');
    // Verifica se é root
    if (process.getuid && process.getuid() !== 0) {
        console.error('Error: Uninstallation requires root privileges');
        process.exit(1);
    }
    // Para e desabilita serviço
    console.log('Stopping service...');
    await execAsync('systemctl stop ncloud-agent').catch(() => { });
    await execAsync('systemctl disable ncloud-agent').catch(() => { });
    // Remove arquivo de serviço
    console.log('Removing systemd service...');
    if (node_fs_1.default.existsSync(SERVICE_FILE)) {
        node_fs_1.default.unlinkSync(SERVICE_FILE);
    }
    await execAsync('systemctl daemon-reload').catch(() => { });
    // Remove diretórios (mantém config e logs por segurança)
    console.log('Removing installation directory...');
    if (node_fs_1.default.existsSync(INSTALL_DIR)) {
        node_fs_1.default.rmSync(INSTALL_DIR, { recursive: true });
    }
    console.log('\n✅ Uninstallation complete!\n');
    console.log('Note: Configuration and logs were preserved in:');
    console.log(`  - ${CONFIG_DIR}`);
    console.log(`  - ${LOG_DIR}`);
    console.log('You can remove them manually if desired.');
}
/**
 * Cria diretórios necessários
 */
function createDirectories() {
    const dirs = [INSTALL_DIR, CONFIG_DIR, LOG_DIR, node_path_1.default.join(INSTALL_DIR, 'bin')];
    for (const dir of dirs) {
        if (!node_fs_1.default.existsSync(dir)) {
            node_fs_1.default.mkdirSync(dir, { recursive: true, mode: 0o755 });
        }
    }
}
/**
 * Cria configuração padrão
 */
function createDefaultConfig() {
    const configPath = node_path_1.default.join(CONFIG_DIR, 'config.json');
    // Não sobrescreve se já existe
    if (node_fs_1.default.existsSync(configPath)) {
        console.log('  Configuration already exists, skipping...');
        return;
    }
    // Gera token
    const token = (0, index_js_1.generateToken)();
    const tokenHash = (0, index_js_1.hashToken)(token);
    const config = {
        server: {
            port: 3100,
            host: '0.0.0.0',
            cors: {
                enabled: true,
                origins: ['*'],
            },
        },
        auth: {
            token: '***CONFIGURE_YOUR_TOKEN***',
            tokenHash: tokenHash,
        },
        protheus: {
            scanPaths: ['/totvs', '/opt/totvs'],
            iniPatterns: ['appserver.ini', 'dbaccess.ini'],
        },
        logging: {
            level: 'info',
            file: node_path_1.default.join(LOG_DIR, 'agent.log'),
            maxSize: '10m',
            maxFiles: 5,
        },
        metrics: {
            enabled: true,
            interval: 30000,
        },
    };
    node_fs_1.default.writeFileSync(configPath, JSON.stringify(config, null, 2), {
        encoding: 'utf-8',
        mode: 0o600,
    });
    console.log(`  Generated token: ${token}`);
    console.log('  ⚠️  Save this token! It won\'t be shown again.');
}
/**
 * Cria arquivo de serviço systemd
 */
function createSystemdService() {
    const serviceContent = `[Unit]
Description=Ncloud Agent for TOTVS Protheus
Documentation=https://github.com/neewe/ncloud-agent
After=network.target

[Service]
Type=simple
User=root
Group=root
WorkingDirectory=${INSTALL_DIR}
ExecStart=/usr/bin/node ${INSTALL_DIR}/bin/ncloud-agent
Restart=always
RestartSec=10
StandardOutput=append:${LOG_DIR}/agent.log
StandardError=append:${LOG_DIR}/agent.log
Environment=NODE_ENV=production
Environment=CONFIG_PATH=${CONFIG_DIR}/config.json

# Security
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=${LOG_DIR} ${CONFIG_DIR}

[Install]
WantedBy=multi-user.target
`;
    node_fs_1.default.writeFileSync(SERVICE_FILE, serviceContent, {
        encoding: 'utf-8',
        mode: 0o644,
    });
}
/**
 * Habilita serviço systemd
 */
async function enableService() {
    await execAsync('systemctl daemon-reload');
    await execAsync('systemctl enable ncloud-agent');
}
/**
 * Exibe configuração para gerar token
 */
function showGenerateToken() {
    const token = (0, index_js_1.generateToken)();
    const hash = (0, index_js_1.hashToken)(token);
    console.log('\n🔐 Generated Authentication Token:\n');
    console.log(`Token: ${token}`);
    console.log(`Hash:  ${hash}`);
    console.log('\nAdd this to your config.json:');
    console.log(JSON.stringify({ auth: { token, tokenHash: hash } }, null, 2));
}
//# sourceMappingURL=installer.js.map