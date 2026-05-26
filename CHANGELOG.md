# Changelog - Destack Transportes

Todas as alterações notáveis deste projeto serão documentadas neste arquivo.

## [2026-02-25] - Atualização de Segurança e Manutenção

### Alterado
- **Segurança:** credenciais de acesso ao EGS Sistemas atualizadas no ambiente de produção, sem versionar senhas no repositório.
- **Infraestrutura:** rebuild completo do container scraper.
- **Dependências:** Chrome e ChromeDriver atualizados para versões compatíveis.

### Adicionado
- Healthcheck no container scraper para auto-restart.
- Documentação operacional atualizada no `scraper/CLAUDE.md`.
- Backup local do `docker-compose.yml` antes das alterações de produção.

## [2026-02-22] - Correção de Acesso EGS

### Corrigido
- Resolvido problema de acesso ao perfil DESTACK no EGS Sistemas.
- Perfil liberado pelo suporte EGS.
- Robô voltou a operar normalmente.

### Dados
- 895 registros de CT-e processados.
- 908 arquivos XML baixados.

## [2026-02-20] - Manutenção Preventiva

### Adicionado
- Monitoramento de logs do scraper.
- Configuração de healthcheck Docker.

---

**Nota:** para atualizar credenciais do EGS, ajuste o arquivo `.env` no servidor e reinicie o serviço do scraper.
