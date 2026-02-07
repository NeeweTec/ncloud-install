<p align="center">
  <img src="https://raw.githubusercontent.com/NeeweTec/ncloud-install/main/assets/logo.svg" alt="Ncloud" width="120" />
</p>

<h1 align="center">Ncloud Agent</h1>

<p align="center">
  <strong>Gerenciamento inteligente de serviços TOTVS Protheus</strong>
</p>

<p align="center">
  <a href="https://get.neewecloud.com"><img src="https://img.shields.io/badge/version-1.3.0-blue?style=flat-square" alt="Version"></a>
  <a href="#"><img src="https://img.shields.io/badge/platform-linux-success?style=flat-square" alt="Platform"></a>
  <a href="#"><img src="https://img.shields.io/badge/node-%3E%3D20-brightgreen?style=flat-square" alt="Node"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-proprietary-lightgrey?style=flat-square" alt="License"></a>
</p>

<p align="center">
  <a href="https://docs.neewecloud.com">Documentação</a> •
  <a href="#instalação">Instalação</a> •
  <a href="#comandos">Comandos</a> •
  <a href="mailto:suporte@neewe.com.br">Suporte</a>
</p>

---

## Instalação

Um único comando para instalar e configurar:

```bash
curl -fsSL https://get.neewecloud.com/install.sh | sudo bash
```

O wizard interativo irá guiá-lo pela configuração inicial.

## Comandos

Após a instalação, use o CLI `ncloud` para gerenciar o agent:

```bash
ncloud start      # Iniciar
ncloud stop       # Parar
ncloud restart    # Reiniciar
ncloud status     # Ver status
ncloud logs       # Logs em tempo real
ncloud menu       # CLI interativo
```

> **Nota**: Comandos que alteram o serviço requerem `sudo`

## Funcionalidades

- **Auto-discovery** — Detecta automaticamente ambientes Protheus
- **Monitoramento** — Status em tempo real de serviços e processos
- **Webhooks** — Notificações automáticas de eventos
- **API REST** — Integração com sistemas externos
- **Segurança** — Autenticação via token, comunicação criptografada

## Requisitos

| Requisito | Especificação |
|-----------|---------------|
| Sistema | Ubuntu 20+, Debian 11+, CentOS 8+, RHEL 8+, Amazon Linux 2 |
| Node.js | 20 ou superior (instalado automaticamente) |
| Permissão | Root (sudo) |

## Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│                     Ncloud Dashboard                         │
│                   (Interface Web/App)                        │
└─────────────────────┬───────────────────────────────────────┘
                      │ HTTPS
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                     Ncloud Agent                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │   REST API   │  │   Monitor    │  │   Webhooks   │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
└─────────────────────┬───────────────────────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
   ┌─────────┐  ┌─────────┐  ┌─────────┐
   │AppServer│  │ DBAccess│  │ License │
   └─────────┘  └─────────┘  └─────────┘
```

## Desinstalar

```bash
curl -fsSL https://get.neewecloud.com/install.sh | sudo bash -s -- --uninstall
```

Ou usando o CLI:

```bash
sudo ncloud uninstall
```

## Suporte

- **Documentação**: [docs.neewecloud.com](https://docs.neewecloud.com)
- **Email**: [suporte@neewe.com.br](mailto:suporte@neewe.com.br)
- **Issues**: [GitHub Issues](https://github.com/NeeweTec/ncloud-agent/issues)

---

<p align="center">
  <sub>Built with ❤️ by <a href="https://neewe.com.br">NEEWE</a></sub>
</p>
