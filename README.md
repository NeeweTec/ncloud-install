# Ncloud Agent - Instalação

Script de instalação do Ncloud Agent para servidores Linux.

## Instalação Rápida

```bash
curl -fsSL https://get.neewecloud.com/install.sh | sudo bash
```

## O que o Script Faz

1. ✅ Verifica requisitos do sistema (root, OS)
2. ✅ Instala Node.js 20+ automaticamente (se necessário)
3. ✅ Baixa a última versão do Ncloud Agent
4. ✅ Executa wizard de configuração interativo
5. ✅ Cria serviço systemd
6. ✅ Inicia o agent automaticamente

## Requisitos

- **Sistema Operacional**: Linux (Ubuntu, Debian, CentOS, RHEL, Amazon Linux)
- **Arquitetura**: x64 ou arm64
- **Permissões**: Root (sudo)
- **Rede**: Acesso à internet para download

## Desinstalar

```bash
curl -fsSL https://get.neewecloud.com/install.sh | sudo bash -s -- --uninstall
```

## Comandos Úteis

```bash
# Gerenciar serviço
sudo systemctl start ncloud-agent    # Iniciar
sudo systemctl stop ncloud-agent     # Parar
sudo systemctl restart ncloud-agent  # Reiniciar
sudo systemctl status ncloud-agent   # Ver status

# Ver logs
sudo journalctl -u ncloud-agent -f   # Logs em tempo real

# CLI interativo
sudo ncloud-agent                    # Abrir menu
```

## Documentação

- **Docs**: https://docs.neewecloud.com
- **Suporte**: suporte@neewe.com.br

## Licença

Copyright © 2026 NEEWE - Todos os direitos reservados.

