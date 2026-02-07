#!/bin/bash
#
# NCLOUD AGENT - Instalador Linux
# NEEWE Tecnologia | v1.3.0
#
# Uso: curl -fsSL https://get.neewecloud.com/install.sh | sudo bash
#

set -o pipefail

# ==============================================================================
# CONFIGURACAO
# ==============================================================================

# Usar nome diferente para evitar conflito com /etc/os-release
INSTALLER_VERSION="1.3.0"
AGENT_VERSION="1.3.0"

# Cores ANSI
RST=$'\033[0m'
BOLD=$'\033[1m'
DIM=$'\033[2m'

RED=$'\033[31m'
GREEN=$'\033[32m'
YELLOW=$'\033[33m'
BLUE=$'\033[34m'
CYAN=$'\033[36m'
WHITE=$'\033[37m'
GRAY=$'\033[90m'
MAGENTA=$'\033[35m'

# Diretorios
INSTALL_DIR="/opt/ncloud-agent"
CONFIG_DIR="/etc/ncloud-agent"
LOG_DIR="/var/log/ncloud-agent"
SERVICE_NAME="ncloud-agent"

# URLs
DOWNLOAD_URL="https://get.neewecloud.com/releases/v${AGENT_VERSION}/ncloud-agent-linux-x64-v${AGENT_VERSION}.tar.gz"

# Requisitos
MIN_NODE_VERSION="20"

# Variaveis para resultado final
SAVED_TOKEN=""
SAVED_PORT=""

# ==============================================================================
# FUNCOES DE UI
# ==============================================================================

print_line() {
    echo "${GRAY}────────────────────────────────────────────────────────────────────────────────${RST}"
}

print_header() {
    clear
    echo ""
    echo "${CYAN}"
    cat << 'EOF'
    ╔═══════════════════════════════════════════════════════════════════════════╗
    ║                                                                           ║
    ║     ███╗   ██╗ ██████╗██╗      ██████╗ ██╗   ██╗██████╗                   ║
    ║     ████╗  ██║██╔════╝██║     ██╔═══██╗██║   ██║██╔══██╗                  ║
    ║     ██╔██╗ ██║██║     ██║     ██║   ██║██║   ██║██║  ██║                  ║
    ║     ██║╚██╗██║██║     ██║     ██║   ██║██║   ██║██║  ██║                  ║
    ║     ██║ ╚████║╚██████╗███████╗╚██████╔╝╚██████╔╝██████╔╝                  ║
    ║     ╚═╝  ╚═══╝ ╚═════╝╚══════╝ ╚═════╝  ╚═════╝ ╚═════╝                   ║
    ║                                                                           ║
    ╚═══════════════════════════════════════════════════════════════════════════╝
EOF
    echo "${RST}"
    echo ""
    echo "  ${BOLD}${WHITE}AGENT INSTALLER${RST} ${GRAY}|${RST} v${INSTALLER_VERSION} ${GRAY}|${RST} Protheus Service Manager"
    echo "  ${GRAY}NEEWE Tecnologia${RST}"
    print_line
    echo ""
}

print_section() {
    local title="$1"
    local icon="$2"
    echo ""
    echo "  ${BOLD}${WHITE}${icon}  ${title}${RST}"
    echo "  ${GRAY}────────────────────────────────────────${RST}"
}

print_step() {
    local step="$1"
    local total="$2"
    local title="$3"
    echo ""
    echo "  ${CYAN}[${step}/${total}]${RST} ${BOLD}${title}${RST}"
}

msg_ok() {
    echo "  ${GREEN}✓${RST}  $1"
}

msg_fail() {
    echo "  ${RED}✗${RST}  $1"
}

msg_skip() {
    echo "  ${YELLOW}○${RST}  $1"
}

msg_info() {
    echo "  ${BLUE}ℹ${RST}  $1"
}

msg_warn() {
    echo "  ${YELLOW}⚠${RST}  $1"
}

# Spinner
SPINNER_PID=""

spinner_start() {
    local msg="$1"
    (
        chars="◐◓◑◒"
        while true; do
            for (( i=0; i<${#chars}; i++ )); do
                printf "\r  ${CYAN}%s${RST}  %s  " "${chars:$i:1}" "$msg"
                sleep 0.12
            done
        done
    ) &
    SPINNER_PID=$!
}

spinner_stop() {
    if [[ -n "$SPINNER_PID" ]]; then
        kill "$SPINNER_PID" 2>/dev/null
        wait "$SPINNER_PID" 2>/dev/null
    fi
    SPINNER_PID=""
    printf "\r\033[K"
}

prompt_value() {
    local message="$1"
    local default="$2"
    local result=""
    
    if [[ -n "$default" ]]; then
        printf "  ${CYAN}?${RST}  %s [${GRAY}%s${RST}]: " "$message" "$default"
    else
        printf "  ${CYAN}?${RST}  %s: " "$message"
    fi
    
    read -r result </dev/tty
    echo "${result:-$default}"
}

confirm() {
    local message="$1"
    local default="${2:-n}"
    local result=""
    
    if [[ "$default" == "y" ]]; then
        printf "  ${CYAN}?${RST}  %s [${GRAY}Y/n${RST}]: " "$message"
    else
        printf "  ${CYAN}?${RST}  %s [${GRAY}y/N${RST}]: " "$message"
    fi
    
    read -r result </dev/tty
    result="${result:-$default}"
    [[ "$result" =~ ^[Yy]$ ]]
}

# ==============================================================================
# FUNCOES DE SISTEMA
# ==============================================================================

check_root() {
    if [[ $EUID -ne 0 ]]; then
        msg_fail "Este script precisa ser executado como root"
        echo ""
        echo "     Execute: ${CYAN}sudo bash${RST} ou ${CYAN}curl ... | sudo bash${RST}"
        echo ""
        exit 1
    fi
    msg_ok "Permissoes de root verificadas"
}

check_os() {
    if [[ -f /etc/os-release ]]; then
        # Usar subshell para não poluir namespace
        OS_NAME=$(grep -E "^NAME=" /etc/os-release | cut -d'"' -f2)
        msg_ok "Sistema detectado: ${CYAN}${OS_NAME}${RST}"
        return 0
    fi
    msg_fail "Sistema operacional nao suportado"
    exit 1
}

check_node() {
    if command -v node &> /dev/null; then
        local node_ver=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
        if [[ "$node_ver" -ge "$MIN_NODE_VERSION" ]]; then
            msg_ok "Node.js $(node -v) instalado"
            return 0
        fi
    fi
    return 1
}

install_node() {
    print_step 2 5 "Instalando Node.js"
    
    spinner_start "Configurando repositorio NodeSource"
    
    if command -v apt-get &> /dev/null; then
        curl -fsSL https://deb.nodesource.com/setup_20.x 2>/dev/null | bash - >/dev/null 2>&1
        spinner_stop
        
        spinner_start "Instalando Node.js via apt"
        apt-get install -y nodejs >/dev/null 2>&1
        spinner_stop
        
    elif command -v yum &> /dev/null; then
        curl -fsSL https://rpm.nodesource.com/setup_20.x 2>/dev/null | bash - >/dev/null 2>&1
        spinner_stop
        
        spinner_start "Instalando Node.js via yum"
        yum install -y nodejs >/dev/null 2>&1
        spinner_stop
        
    elif command -v dnf &> /dev/null; then
        curl -fsSL https://rpm.nodesource.com/setup_20.x 2>/dev/null | bash - >/dev/null 2>&1
        spinner_stop
        
        spinner_start "Instalando Node.js via dnf"
        dnf install -y nodejs >/dev/null 2>&1
        spinner_stop
    else
        spinner_stop
        msg_fail "Gerenciador de pacotes nao suportado"
        msg_info "Instale Node.js 20+ manualmente: ${CYAN}https://nodejs.org${RST}"
        exit 1
    fi
    
    if command -v node &> /dev/null; then
        msg_ok "Node.js $(node -v) instalado com sucesso"
    else
        msg_fail "Falha ao instalar Node.js"
        exit 1
    fi
}

generate_token() {
    openssl rand -hex 32
}

# ==============================================================================
# INSTALACAO
# ==============================================================================

download_agent() {
    print_step 3 5 "Baixando Ncloud Agent v${AGENT_VERSION}"
    
    spinner_start "Baixando de get.neewecloud.com"
    
    if ! curl -fsSL "$DOWNLOAD_URL" -o /tmp/ncloud-agent.tar.gz 2>/dev/null; then
        spinner_stop
        msg_fail "Falha ao baixar o agente"
        msg_info "URL: ${CYAN}$DOWNLOAD_URL${RST}"
        exit 1
    fi
    
    spinner_stop
    msg_ok "Download concluido"
    
    spinner_start "Extraindo arquivos"
    mkdir -p "$INSTALL_DIR"
    tar -xzf /tmp/ncloud-agent.tar.gz -C "$INSTALL_DIR" --strip-components=1 2>/dev/null
    rm -f /tmp/ncloud-agent.tar.gz
    spinner_stop
    msg_ok "Arquivos extraidos para ${CYAN}$INSTALL_DIR${RST}"
    
    spinner_start "Instalando dependencias"
    cd "$INSTALL_DIR"
    npm install --production --ignore-scripts >/dev/null 2>&1 || true
    cd - > /dev/null
    spinner_stop
    msg_ok "Dependencias instaladas"
}

configure_agent() {
    print_step 4 5 "Configurando Agent"
    
    mkdir -p "$CONFIG_DIR"
    mkdir -p "$LOG_DIR"
    
    # Gerar token
    local TOKEN=$(generate_token)
    
    print_section "Configuracao Interativa" "⚙️"
    echo ""
    
    # Porta
    local PORT=$(prompt_value "Porta da API" "3100")
    
    # Validar porta
    if ! [[ "$PORT" =~ ^[0-9]+$ ]]; then
        PORT="3100"
    fi
    
    # Diretorios de scan
    echo ""
    msg_info "Diretorios padrao para buscar Protheus:"
    echo "     ${GRAY}/totvs, /opt/totvs, /home/totvs${RST}"
    echo ""
    
    local CUSTOM_PATHS=""
    if confirm "Adicionar diretorios customizados" "n"; then
        CUSTOM_PATHS=$(prompt_value "Diretorios adicionais (separados por virgula)" "")
    fi
    
    # Montar array de paths
    local SCAN_PATHS='["/totvs", "/opt/totvs", "/home/totvs"'
    if [[ -n "$CUSTOM_PATHS" ]]; then
        IFS=',' read -ra CUSTOM_ARRAY <<< "$CUSTOM_PATHS"
        for path in "${CUSTOM_ARRAY[@]}"; do
            path=$(echo "$path" | xargs)
            SCAN_PATHS+=", \"$path\""
        done
    fi
    SCAN_PATHS+=']'
    
    # Webhook (opcional)
    local WEBHOOK_CONFIG=""
    echo ""
    if confirm "Configurar webhook para notificacoes" "n"; then
        local WEBHOOK_URL=$(prompt_value "URL do webhook" "")
        local WEBHOOK_SECRET=$(prompt_value "Secret do webhook (opcional)" "")
        
        if [[ -n "$WEBHOOK_URL" ]]; then
            local WEBHOOK_ID=$(openssl rand -hex 8)
            local CREATED_AT=$(date -Iseconds)
            WEBHOOK_CONFIG="[{\"id\":\"wh-${WEBHOOK_ID}\",\"name\":\"Webhook Principal\",\"url\":\"${WEBHOOK_URL}\",\"secret\":\"${WEBHOOK_SECRET}\",\"events\":[\"service:started\",\"service:stopped\",\"service:crashed\"],\"enabled\":true,\"retryCount\":3,\"retryDelayMs\":5000,\"timeoutMs\":10000,\"createdAt\":\"${CREATED_AT}\",\"updatedAt\":\"${CREATED_AT}\"}]"
        fi
    fi
    
    # Criar config.json
    local WEBHOOKS_JSON="${WEBHOOK_CONFIG:-[]}"
    
    cat > "$CONFIG_DIR/config.json" << EOFCONFIG
{
  "server": {
    "port": ${PORT},
    "host": "0.0.0.0"
  },
  "auth": {
    "token": "${TOKEN}"
  },
  "environments": [],
  "instances": [],
  "scanPaths": ${SCAN_PATHS},
  "autoStart": true,
  "webhooks": ${WEBHOOKS_JSON}
}
EOFCONFIG
    
    chmod 600 "$CONFIG_DIR/config.json"
    
    echo ""
    msg_ok "Configuracao salva em ${CYAN}$CONFIG_DIR/config.json${RST}"
    
    # Salvar variaveis para uso posterior
    SAVED_TOKEN="$TOKEN"
    SAVED_PORT="$PORT"
}

create_service() {
    print_step 5 5 "Criando Servico Systemd"
    
    spinner_start "Configurando servico"
    
    cat > /etc/systemd/system/${SERVICE_NAME}.service << EOF
[Unit]
Description=Ncloud Agent - Protheus Service Manager
Documentation=https://docs.neewecloud.com
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$INSTALL_DIR
ExecStart=/usr/bin/node $INSTALL_DIR/dist/linux/daemon.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=NCLOUD_CONFIG=$CONFIG_DIR/config.json

StandardOutput=journal
StandardError=journal
SyslogIdentifier=ncloud-agent

[Install]
WantedBy=multi-user.target
EOF
    
    spinner_stop
    msg_ok "Servico systemd criado"
    
    # Criar CLI wrapper
    spinner_start "Instalando CLI ncloud"
    
    cat > /usr/local/bin/ncloud << 'NCLOUD_CLI'
#!/bin/bash
SERVICE_NAME="ncloud-agent"
CONFIG_FILE="/etc/ncloud-agent/config.json"
INSTALL_DIR="/opt/ncloud-agent"

RST=$'\033[0m'
BOLD=$'\033[1m'
GREEN=$'\033[32m'
RED=$'\033[31m'
YELLOW=$'\033[33m'
CYAN=$'\033[36m'
GRAY=$'\033[90m'

check_root() {
    if [ "$EUID" -ne 0 ]; then
        echo "  ${RED}✗${RST}  Execute: ${CYAN}sudo ncloud $1${RST}"
        exit 1
    fi
}

get_port() {
    if [ -f "$CONFIG_FILE" ]; then
        grep -o '"port"[[:space:]]*:[[:space:]]*[0-9]*' "$CONFIG_FILE" | head -1 | grep -o '[0-9]*' || echo "3100"
    else
        echo "3100"
    fi
}

case "${1:-help}" in
    start)
        check_root start
        echo "  ${CYAN}▸${RST}  Iniciando Ncloud Agent..."
        systemctl start $SERVICE_NAME
        sleep 2
        if systemctl is-active --quiet $SERVICE_NAME; then
            echo "  ${GREEN}✓${RST}  Agent iniciado"
        else
            echo "  ${RED}✗${RST}  Falha ao iniciar"
            echo ""
            echo "  ${YELLOW}⚠${RST}  Verifique os logs: ${CYAN}ncloud logs${RST}"
        fi
        ;;
    stop)
        check_root stop
        echo "  ${CYAN}▸${RST}  Parando Ncloud Agent..."
        systemctl stop $SERVICE_NAME
        echo "  ${GREEN}✓${RST}  Agent parado"
        ;;
    restart)
        check_root restart
        echo "  ${CYAN}▸${RST}  Reiniciando Ncloud Agent..."
        systemctl restart $SERVICE_NAME
        sleep 2
        if systemctl is-active --quiet $SERVICE_NAME; then
            echo "  ${GREEN}✓${RST}  Agent reiniciado"
        else
            echo "  ${RED}✗${RST}  Falha ao reiniciar"
        fi
        ;;
    status|st)
        echo ""
        echo "  ${BOLD}NCLOUD AGENT STATUS${RST}"
        echo ""
        if systemctl is-active --quiet $SERVICE_NAME; then
            echo "  ${GREEN}●${RST}  Servico: ${GREEN}Ativo${RST}"
        else
            echo "  ${RED}○${RST}  Servico: ${RED}Inativo${RST}"
        fi
        if systemctl is-enabled --quiet $SERVICE_NAME 2>/dev/null; then
            echo "  ${GREEN}●${RST}  Autostart: ${GREEN}Habilitado${RST}"
        else
            echo "  ${YELLOW}○${RST}  Autostart: ${YELLOW}Desabilitado${RST}"
        fi
        PORT=$(get_port)
        echo "  ${CYAN}●${RST}  Porta: ${CYAN}${PORT}${RST}"
        PID=$(systemctl show --property MainPID --value $SERVICE_NAME 2>/dev/null)
        if [ "$PID" != "0" ] && [ -n "$PID" ]; then
            echo "  ${CYAN}●${RST}  PID: ${CYAN}$PID${RST}"
        fi
        IP=$(hostname -I 2>/dev/null | awk '{print $1}')
        if [ -n "$IP" ]; then
            echo "  ${CYAN}●${RST}  Acesso: ${CYAN}http://${IP}:${PORT}${RST}"
        fi
        echo ""
        ;;
    logs|log|l)
        echo "  ${CYAN}▸${RST}  Logs em tempo real ${GRAY}(Ctrl+C para sair)${RST}"
        echo ""
        journalctl -u $SERVICE_NAME -f --no-hostname -o cat
        ;;
    menu|m)
        check_root menu
        if [ -f "$INSTALL_DIR/dist/linux/cli.js" ]; then
            node "$INSTALL_DIR/dist/linux/cli.js"
        else
            echo "  ${RED}✗${RST}  CLI nao encontrado"
        fi
        ;;
    version|v|-v|--version)
        if [ -f "$INSTALL_DIR/package.json" ]; then
            VER=$(grep -o '"version"[[:space:]]*:[[:space:]]*"[^"]*"' "$INSTALL_DIR/package.json" | head -1 | cut -d'"' -f4)
            echo "  Ncloud Agent ${CYAN}v${VER}${RST}"
        else
            echo "  ${YELLOW}Versao desconhecida${RST}"
        fi
        ;;
    *)
        echo ""
        echo "  ${BOLD}NCLOUD${RST} - CLI do Ncloud Agent"
        echo ""
        echo "  ${BOLD}COMANDOS:${RST}"
        echo "     ${CYAN}start${RST}      Iniciar o agent"
        echo "     ${CYAN}stop${RST}       Parar o agent"
        echo "     ${CYAN}restart${RST}    Reiniciar o agent"
        echo "     ${CYAN}status${RST}     Ver status do servico"
        echo "     ${CYAN}logs${RST}       Ver logs em tempo real"
        echo "     ${CYAN}menu${RST}       Abrir CLI interativo"
        echo "     ${CYAN}version${RST}    Ver versao instalada"
        echo ""
        echo "  ${BOLD}EXEMPLOS:${RST}"
        echo "     ${GRAY}sudo ncloud start${RST}"
        echo "     ${GRAY}ncloud status${RST}"
        echo "     ${GRAY}ncloud logs${RST}"
        echo ""
        ;;
esac
NCLOUD_CLI
    
    chmod +x /usr/local/bin/ncloud
    ln -sf "$INSTALL_DIR/dist/linux/cli.js" /usr/local/bin/ncloud-agent 2>/dev/null || true
    chmod +x "$INSTALL_DIR/dist/linux/cli.js" 2>/dev/null || true
    
    spinner_stop
    msg_ok "CLI ${CYAN}ncloud${RST} instalado"
    
    # Habilitar e iniciar servico
    spinner_start "Habilitando servico"
    systemctl daemon-reload
    systemctl enable ${SERVICE_NAME} > /dev/null 2>&1
    spinner_stop
    msg_ok "Servico habilitado para iniciar no boot"
    
    spinner_start "Iniciando agent"
    systemctl start ${SERVICE_NAME}
    sleep 3
    spinner_stop
    
    if systemctl is-active --quiet ${SERVICE_NAME}; then
        msg_ok "Agent iniciado com sucesso"
    else
        msg_warn "O agent pode nao ter iniciado corretamente"
        msg_info "Verifique: ${CYAN}ncloud logs${RST}"
    fi
}

show_success() {
    local LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "localhost")
    
    echo ""
    print_line
    echo ""
    echo "${GREEN}"
    cat << 'EOF'
    ╔═══════════════════════════════════════════════════════════════════════════╗
    ║                                                                           ║
    ║              ✓   INSTALACAO CONCLUIDA COM SUCESSO!                        ║
    ║                                                                           ║
    ╚═══════════════════════════════════════════════════════════════════════════╝
EOF
    echo "${RST}"
    
    print_section "Token de Autenticacao" "🔑"
    echo ""
    echo "     ${CYAN}${SAVED_TOKEN}${RST}"
    echo ""
    msg_warn "Guarde este token em local seguro!"
    msg_info "Voce precisara dele para conectar ao Ncloud Dashboard"
    
    print_section "Dados de Conexao" "📡"
    echo ""
    echo "     Host:   ${CYAN}${LOCAL_IP}${RST}"
    echo "     Porta:  ${CYAN}${SAVED_PORT}${RST}"
    echo "     URL:    ${CYAN}http://${LOCAL_IP}:${SAVED_PORT}${RST}"
    
    print_section "Comandos Rapidos" "⚡"
    echo ""
    echo "     ${CYAN}ncloud start${RST}      Iniciar o agent"
    echo "     ${CYAN}ncloud stop${RST}       Parar o agent"
    echo "     ${CYAN}ncloud restart${RST}    Reiniciar o agent"
    echo "     ${CYAN}ncloud status${RST}     Ver status"
    echo "     ${CYAN}ncloud logs${RST}       Ver logs em tempo real"
    echo "     ${CYAN}ncloud menu${RST}       Abrir CLI interativo"
    
    print_section "Proximos Passos" "🚀"
    echo ""
    msg_info "1. Acesse o Ncloud Dashboard"
    msg_info "2. Adicione uma nova conexao com os dados acima"
    msg_info "3. Use ${CYAN}ncloud menu${RST} para detectar ambientes Protheus"
    
    echo ""
    print_line
    echo "  ${GRAY}Documentacao:${RST} ${CYAN}https://docs.neewecloud.com${RST}"
    echo "  ${GRAY}Suporte:${RST}      ${CYAN}suporte@neewe.com.br${RST}"
    print_line
    echo ""
}

# ==============================================================================
# DESINSTALACAO
# ==============================================================================

uninstall() {
    print_header
    
    print_section "Desinstalando Ncloud Agent" "🗑️"
    echo ""
    
    # Parar servico
    if systemctl is-active --quiet ${SERVICE_NAME} 2>/dev/null; then
        spinner_start "Parando servico"
        systemctl stop ${SERVICE_NAME}
        spinner_stop
        msg_ok "Servico parado"
    fi
    
    # Desabilitar servico
    if systemctl is-enabled --quiet ${SERVICE_NAME} 2>/dev/null; then
        spinner_start "Desabilitando servico"
        systemctl disable ${SERVICE_NAME} >/dev/null 2>&1
        spinner_stop
        msg_ok "Servico desabilitado"
    fi
    
    # Remover arquivos
    spinner_start "Removendo arquivos"
    rm -f /etc/systemd/system/${SERVICE_NAME}.service
    rm -f /usr/local/bin/ncloud
    rm -f /usr/local/bin/ncloud-agent
    systemctl daemon-reload
    spinner_stop
    msg_ok "Arquivos de servico removidos"
    
    echo ""
    if confirm "Remover diretorio de instalacao ($INSTALL_DIR)" "y"; then
        rm -rf "$INSTALL_DIR"
        msg_ok "Diretorio de instalacao removido"
    else
        msg_skip "Diretorio de instalacao mantido"
    fi
    
    if confirm "Remover configuracoes ($CONFIG_DIR)" "n"; then
        rm -rf "$CONFIG_DIR"
        msg_ok "Configuracoes removidas"
    else
        msg_skip "Configuracoes mantidas em $CONFIG_DIR"
    fi
    
    if confirm "Remover logs ($LOG_DIR)" "n"; then
        rm -rf "$LOG_DIR"
        msg_ok "Logs removidos"
    else
        msg_skip "Logs mantidos em $LOG_DIR"
    fi
    
    echo ""
    print_line
    echo "  ${GREEN}✓${RST}  ${BOLD}Ncloud Agent desinstalado com sucesso!${RST}"
    print_line
    echo ""
}

# ==============================================================================
# AJUDA
# ==============================================================================

show_help() {
    print_header
    
    print_section "Uso" "📖"
    echo ""
    echo "     curl -fsSL https://get.neewecloud.com/install.sh | sudo bash"
    echo "     curl -fsSL https://get.neewecloud.com/install.sh | sudo bash -s -- ${CYAN}[opcoes]${RST}"
    
    print_section "Opcoes" "⚙️"
    echo ""
    echo "     ${CYAN}--uninstall${RST}    Desinstalar o agent"
    echo "     ${CYAN}--help${RST}         Mostrar esta ajuda"
    
    print_section "Exemplos" "💡"
    echo ""
    echo "     ${GRAY}# Instalacao interativa${RST}"
    echo "     curl -fsSL https://get.neewecloud.com/install.sh | sudo bash"
    echo ""
    echo "     ${GRAY}# Desinstalar${RST}"
    echo "     curl -fsSL https://get.neewecloud.com/install.sh | sudo bash -s -- --uninstall"
    
    echo ""
    print_line
    echo ""
}

# ==============================================================================
# CLEANUP
# ==============================================================================

cleanup() {
    spinner_stop
    echo ""
    echo "  ${YELLOW}⚠${RST}  ${YELLOW}Instalacao interrompida${RST}"
    echo ""
    exit 130
}

trap cleanup SIGINT SIGTERM

# ==============================================================================
# MAIN
# ==============================================================================

main() {
    # Parse argumentos
    while [[ $# -gt 0 ]]; do
        case $1 in
            --uninstall)
                print_header
                print_step 1 1 "Verificando Permissoes"
                check_root
                uninstall
                exit 0
                ;;
            --help|-h)
                show_help
                exit 0
                ;;
            *)
                msg_fail "Opcao desconhecida: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    print_header
    
    print_step 1 5 "Verificando Sistema"
    check_root
    check_os
    
    # Verificar instalacao existente
    if [[ -d "$INSTALL_DIR" ]]; then
        echo ""
        msg_warn "Instalacao existente detectada em ${CYAN}$INSTALL_DIR${RST}"
        if confirm "Deseja reinstalar" "y"; then
            spinner_start "Parando servico existente"
            systemctl stop ${SERVICE_NAME} 2>/dev/null || true
            spinner_stop
            
            spinner_start "Removendo instalacao anterior"
            rm -rf "$INSTALL_DIR"
            spinner_stop
            msg_ok "Instalacao anterior removida"
        else
            msg_info "Instalacao cancelada"
            echo ""
            exit 0
        fi
    fi
    
    # Verificar Node.js
    if ! check_node; then
        echo ""
        if confirm "Node.js 20+ nao encontrado. Instalar automaticamente" "y"; then
            install_node
        else
            msg_fail "Node.js 20+ e necessario para executar o Ncloud Agent"
            exit 1
        fi
    fi
    
    # Instalar
    download_agent
    configure_agent
    create_service
    show_success
}

main "$@"
