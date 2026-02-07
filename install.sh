#!/bin/bash
# ============================================================================
# NCLOUD AGENT - Script de Instalação
# 
# Uso:
#   curl -fsSL https://get.neewecloud.com/install.sh | sudo bash
#
# Copyright (c) 2026 NEEWE - Todos os direitos reservados
# ============================================================================

set -e

# Configuração
GITHUB_REPO="NeeweTec/ncloud-agent"
INSTALL_DIR="/opt/ncloud-agent"
CONFIG_DIR="/etc/ncloud-agent"
SERVICE_NAME="ncloud-agent"
MIN_NODE_VERSION="20"

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m'
BOLD='\033[1m'

# ============================================================================
# FUNÇÕES
# ============================================================================

print_banner() {
    echo -e "${CYAN}"
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║                                                              ║"
    echo "║     ███╗   ██╗ ██████╗██╗      ██████╗ ██╗   ██╗██████╗      ║"
    echo "║     ████╗  ██║██╔════╝██║     ██╔═══██╗██║   ██║██╔══██╗     ║"
    echo "║     ██╔██╗ ██║██║     ██║     ██║   ██║██║   ██║██║  ██║     ║"
    echo "║     ██║╚██╗██║██║     ██║     ██║   ██║██║   ██║██║  ██║     ║"
    echo "║     ██║ ╚████║╚██████╗███████╗╚██████╔╝╚██████╔╝██████╔╝     ║"
    echo "║     ╚═╝  ╚═══╝ ╚═════╝╚══════╝ ╚═════╝  ╚═════╝ ╚═════╝      ║"
    echo "║                                                              ║"
    echo "║              AGENT INSTALLER v1.3.0                          ║"
    echo "║              Protheus Service Manager                        ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

log_info() { echo -e "${BLUE}ℹ${NC}  $1"; }
log_success() { echo -e "${GREEN}✔${NC}  $1"; }
log_warning() { echo -e "${YELLOW}⚠${NC}  $1"; }
log_error() { echo -e "${RED}✖${NC}  $1"; }
log_step() { echo -e "\n${WHITE}${BOLD}▸ $1${NC}"; }

prompt() {
    local message="$1"
    local default="$2"
    echo -ne "${CYAN}?${NC} ${message} [${default}]: "
    read result
    echo "${result:-$default}"
}

confirm() {
    local message="$1"
    local default="${2:-n}"
    if [ "$default" = "y" ]; then
        echo -ne "${CYAN}?${NC} ${message} [Y/n]: "
    else
        echo -ne "${CYAN}?${NC} ${message} [y/N]: "
    fi
    read result
    result="${result:-$default}"
    [[ "$result" =~ ^[Yy]$ ]]
}

check_root() {
    if [ "$EUID" -ne 0 ]; then
        log_error "Este script precisa ser executado como root"
        echo -e "    Execute: ${CYAN}sudo bash${NC} ou ${CYAN}curl ... | sudo bash${NC}"
        exit 1
    fi
}

check_os() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$NAME
        log_info "Sistema: $OS"
    else
        log_error "Sistema operacional não suportado"
        exit 1
    fi
}

check_node() {
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
        if [ "$NODE_VERSION" -ge "$MIN_NODE_VERSION" ]; then
            log_success "Node.js $(node -v) instalado"
            return 0
        fi
    fi
    return 1
}

install_node() {
    log_step "Instalando Node.js 20..."
    
    if command -v apt-get &> /dev/null; then
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
        apt-get install -y nodejs
    elif command -v yum &> /dev/null; then
        curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
        yum install -y nodejs
    elif command -v dnf &> /dev/null; then
        curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
        dnf install -y nodejs
    else
        log_error "Instale Node.js 20+ manualmente: https://nodejs.org"
        exit 1
    fi
    
    log_success "Node.js instalado: $(node -v)"
}

generate_token() {
    openssl rand -hex 32
}

download_release() {
    log_step "Baixando última versão..."
    
    # Obter URL da última release
    local release_url="https://api.github.com/repos/${GITHUB_REPO}/releases/latest"
    local download_url=$(curl -s "$release_url" | grep "browser_download_url.*linux.*tar.gz\"" | head -1 | cut -d'"' -f4)
    
    if [ -z "$download_url" ]; then
        log_warning "Release não encontrada no GitHub"
        log_info "Clonando repositório diretamente..."
        install_from_source
        return
    fi
    
    log_info "Baixando: $download_url"
    curl -fsSL "$download_url" -o /tmp/ncloud-agent.tar.gz
    
    mkdir -p "$INSTALL_DIR"
    tar -xzf /tmp/ncloud-agent.tar.gz -C "$INSTALL_DIR" --strip-components=1
    rm -f /tmp/ncloud-agent.tar.gz
    
    # Instalar dependências
    cd "$INSTALL_DIR"
    npm install --production --ignore-scripts 2>/dev/null || true
    cd - > /dev/null
    
    log_success "Instalado em $INSTALL_DIR"
}

install_from_source() {
    log_step "Instalando do código fonte..."
    
    # Clonar repositório
    rm -rf /tmp/ncloud-agent-src
    git clone --depth 1 "https://github.com/${GITHUB_REPO}.git" /tmp/ncloud-agent-src
    
    cd /tmp/ncloud-agent-src
    
    # Instalar dependências e compilar
    npm install
    npm run build:daemon
    
    # Copiar para diretório de instalação
    mkdir -p "$INSTALL_DIR"
    cp -r dist "$INSTALL_DIR/"
    cp package.json "$INSTALL_DIR/"
    
    # Instalar dependências de produção
    cd "$INSTALL_DIR"
    npm install --production --ignore-scripts
    
    # Limpar
    rm -rf /tmp/ncloud-agent-src
    cd - > /dev/null
    
    log_success "Instalado do código fonte em $INSTALL_DIR"
}

create_config() {
    log_step "Configurando..."
    
    mkdir -p "$CONFIG_DIR"
    
    # Wizard
    echo
    echo -e "${WHITE}${BOLD}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${WHITE}${BOLD}                    CONFIGURAÇÃO DO AGENT                       ${NC}"
    echo -e "${WHITE}${BOLD}═══════════════════════════════════════════════════════════════${NC}"
    echo
    
    # Gerar token
    TOKEN=$(generate_token)
    log_info "Token de autenticação gerado automaticamente"
    
    # Porta
    PORT=$(prompt "Porta da API" "3100")
    
    # Diretórios de scan
    echo
    log_info "Diretórios padrão para buscar Protheus:"
    echo -e "    ${CYAN}/totvs, /opt/totvs, /home/totvs${NC}"
    
    CUSTOM_PATHS=""
    if confirm "Adicionar diretórios customizados?" "n"; then
        CUSTOM_PATHS=$(prompt "Diretórios adicionais (separados por vírgula)" "")
    fi
    
    # Montar array de paths
    SCAN_PATHS='["/totvs", "/opt/totvs", "/home/totvs"'
    if [ -n "$CUSTOM_PATHS" ]; then
        IFS=',' read -ra CUSTOM_ARRAY <<< "$CUSTOM_PATHS"
        for path in "${CUSTOM_ARRAY[@]}"; do
            path=$(echo "$path" | xargs)  # trim
            SCAN_PATHS+=", \"$path\""
        done
    fi
    SCAN_PATHS+=']'
    
    # Webhook (opcional)
    WEBHOOK_CONFIG=""
    echo
    if confirm "Configurar webhook para notificações?" "n"; then
        WEBHOOK_URL=$(prompt "URL do webhook" "")
        WEBHOOK_SECRET=$(prompt "Secret do webhook (opcional, Enter para pular)" "")
        
        if [ -n "$WEBHOOK_URL" ]; then
            WEBHOOK_ID=$(openssl rand -hex 8)
            WEBHOOK_CONFIG=",
  \"webhooks\": [
    {
      \"id\": \"wh-${WEBHOOK_ID}\",
      \"name\": \"Webhook Principal\",
      \"url\": \"${WEBHOOK_URL}\",
      \"secret\": \"${WEBHOOK_SECRET}\",
      \"events\": [\"service:started\", \"service:stopped\", \"service:crashed\"],
      \"enabled\": true,
      \"retryCount\": 3,
      \"retryDelayMs\": 5000,
      \"timeoutMs\": 10000,
      \"createdAt\": \"$(date -Iseconds)\",
      \"updatedAt\": \"$(date -Iseconds)\"
    }
  ]"
        fi
    fi
    
    # Criar config.json
    cat > "$CONFIG_DIR/config.json" << EOF
{
  "server": {
    "port": ${PORT},
    "host": "0.0.0.0"
  },
  "auth": {
    "token": "$TOKEN"
  },
  "environments": [],
  "instances": [],
  "scanPaths": ${SCAN_PATHS},
  "autoStart": true${WEBHOOK_CONFIG:-,
  "webhooks": []}
}
EOF
    
    chmod 600 "$CONFIG_DIR/config.json"
    log_success "Configuração salva em $CONFIG_DIR/config.json"
}

create_service() {
    log_step "Criando serviço systemd..."
    
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

# Logs
StandardOutput=journal
StandardError=journal
SyslogIdentifier=ncloud-agent

[Install]
WantedBy=multi-user.target
EOF
    
    # Criar link simbólico para CLI
    ln -sf "$INSTALL_DIR/dist/linux/cli.js" /usr/local/bin/ncloud-agent 2>/dev/null || true
    chmod +x "$INSTALL_DIR/dist/linux/cli.js" 2>/dev/null || true
    
    systemctl daemon-reload
    systemctl enable ${SERVICE_NAME} > /dev/null 2>&1
    log_success "Serviço criado e habilitado"
}

show_result() {
    # Detectar IP
    LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "localhost")
    
    echo
    echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                                                              ║${NC}"
    echo -e "${GREEN}║          ✔  INSTALAÇÃO CONCLUÍDA COM SUCESSO!                ║${NC}"
    echo -e "${GREEN}║                                                              ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo
    echo -e "${WHITE}${BOLD}🔑 TOKEN DE AUTENTICAÇÃO${NC}"
    echo -e "┌──────────────────────────────────────────────────────────────┐"
    echo -e "│ ${CYAN}$TOKEN${NC} │"
    echo -e "└──────────────────────────────────────────────────────────────┘"
    echo
    echo -e "${YELLOW}⚠  IMPORTANTE: Guarde este token em local seguro!${NC}"
    echo -e "${YELLOW}   Você precisará dele para conectar ao Ncloud Dashboard.${NC}"
    echo
    echo -e "${WHITE}${BOLD}📡 DADOS DE CONEXÃO${NC}"
    echo -e "┌──────────────────────────────────────────────────────────────┐"
    echo -e "│ Host:   ${CYAN}${LOCAL_IP}${NC}                                           │"
    echo -e "│ Porta:  ${CYAN}${PORT}${NC}                                               │"
    echo -e "│ Token:  ${CYAN}${TOKEN:0:20}...${NC}                          │"
    echo -e "└──────────────────────────────────────────────────────────────┘"
    echo
    echo -e "${WHITE}${BOLD}📋 COMANDOS ÚTEIS${NC}"
    echo
    echo -e "   ${WHITE}Gerenciar serviço:${NC}"
    echo -e "   ${CYAN}sudo systemctl start ncloud-agent${NC}    # Iniciar"
    echo -e "   ${CYAN}sudo systemctl stop ncloud-agent${NC}     # Parar"
    echo -e "   ${CYAN}sudo systemctl restart ncloud-agent${NC}  # Reiniciar"
    echo -e "   ${CYAN}sudo systemctl status ncloud-agent${NC}   # Ver status"
    echo
    echo -e "   ${WHITE}Ver logs:${NC}"
    echo -e "   ${CYAN}sudo journalctl -u ncloud-agent -f${NC}   # Logs em tempo real"
    echo
    echo -e "   ${WHITE}CLI interativo:${NC}"
    echo -e "   ${CYAN}sudo ncloud-agent${NC}                    # Abrir menu"
    echo
    echo -e "${WHITE}${BOLD}🌐 PRÓXIMOS PASSOS${NC}"
    echo
    echo -e "   1. Acesse o Ncloud Dashboard"
    echo -e "   2. Adicione uma nova conexão com os dados acima"
    echo -e "   3. Use a CLI para detectar ambientes Protheus:"
    echo -e "      ${CYAN}sudo ncloud-agent${NC}"
    echo
    echo -e "${WHITE}${BOLD}📚 Documentação:${NC} https://docs.neewecloud.com"
    echo -e "${WHITE}${BOLD}💬 Suporte:${NC}      suporte@neewe.com.br"
    echo
}

uninstall() {
    print_banner
    log_step "Desinstalando Ncloud Agent..."
    
    # Parar serviço
    if systemctl is-active --quiet ${SERVICE_NAME} 2>/dev/null; then
        systemctl stop ${SERVICE_NAME}
        log_info "Serviço parado"
    fi
    
    # Desabilitar serviço
    if systemctl is-enabled --quiet ${SERVICE_NAME} 2>/dev/null; then
        systemctl disable ${SERVICE_NAME}
        log_info "Serviço desabilitado"
    fi
    
    # Remover arquivos
    rm -f /etc/systemd/system/${SERVICE_NAME}.service
    rm -f /usr/local/bin/ncloud-agent
    systemctl daemon-reload
    
    if confirm "Remover diretório de instalação ($INSTALL_DIR)?" "y"; then
        rm -rf "$INSTALL_DIR"
        log_info "Diretório de instalação removido"
    fi
    
    if confirm "Remover configurações ($CONFIG_DIR)?" "n"; then
        rm -rf "$CONFIG_DIR"
        log_info "Configurações removidas"
    else
        log_info "Configurações mantidas em $CONFIG_DIR"
    fi
    
    echo
    log_success "Ncloud Agent desinstalado com sucesso!"
    echo
}

show_help() {
    echo "Ncloud Agent - Script de Instalação"
    echo
    echo "Uso:"
    echo "  curl -fsSL https://get.neewecloud.com/install.sh | sudo bash"
    echo "  curl -fsSL https://get.neewecloud.com/install.sh | sudo bash -s -- [opções]"
    echo
    echo "Opções:"
    echo "  --uninstall     Desinstalar o agent"
    echo "  --help          Mostrar esta ajuda"
    echo
    echo "Exemplos:"
    echo "  # Instalação interativa"
    echo "  curl -fsSL https://get.neewecloud.com/install.sh | sudo bash"
    echo
    echo "  # Desinstalar"
    echo "  curl -fsSL https://get.neewecloud.com/install.sh | sudo bash -s -- --uninstall"
    echo
}

# ============================================================================
# MAIN
# ============================================================================

main() {
    # Parse argumentos
    while [[ $# -gt 0 ]]; do
        case $1 in
            --uninstall)
                check_root
                uninstall
                exit 0
                ;;
            --help|-h)
                show_help
                exit 0
                ;;
            *)
                log_error "Opção desconhecida: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    print_banner
    check_root
    check_os
    
    # Verificar git
    if ! command -v git &> /dev/null; then
        log_info "Instalando git..."
        if command -v apt-get &> /dev/null; then
            apt-get update && apt-get install -y git
        elif command -v yum &> /dev/null; then
            yum install -y git
        fi
    fi
    
    # Node.js
    if ! check_node; then
        if confirm "Node.js 20+ não encontrado. Instalar automaticamente?" "y"; then
            install_node
        else
            log_error "Node.js 20+ é necessário para executar o Ncloud Agent"
            exit 1
        fi
    fi
    
    # Verificar instalação existente
    if [ -d "$INSTALL_DIR" ]; then
        echo
        log_warning "Instalação existente detectada em $INSTALL_DIR"
        if confirm "Deseja reinstalar?" "y"; then
            systemctl stop ${SERVICE_NAME} 2>/dev/null || true
            rm -rf "$INSTALL_DIR"
        else
            log_info "Instalação cancelada"
            exit 0
        fi
    fi
    
    # Instalar
    download_release
    create_config
    create_service
    
    # Iniciar serviço
    log_step "Iniciando serviço..."
    systemctl start ${SERVICE_NAME}
    sleep 3
    
    if systemctl is-active --quiet ${SERVICE_NAME}; then
        log_success "Serviço iniciado com sucesso!"
    else
        log_warning "O serviço pode não ter iniciado corretamente"
        log_info "Verifique os logs: sudo journalctl -u ncloud-agent -n 50"
    fi
    
    # Mostrar resultado
    show_result
}

main "$@"

