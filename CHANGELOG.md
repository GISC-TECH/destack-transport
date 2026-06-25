# Changelog - Destack Transportes

Todas as alterações notáveis neste projeto serão documentadas neste arquivo.

## [2026-02-25] - Atualização de Segurança e Manutenção

### Alterado
- **Segurança:** Atualizada senha de acesso ao EGS Sistemas
  - Senha anterior: destack123
  - Nova senha: destack789
  - Container scraper recriado com nova configuração
- **Infraestrutura:** Rebuild completo do container scraper
  - Atualizado Chrome para versão 145
  - Atualizado ChromeDriver para versão compatível
  - Todas as dependências Python atualizadas

### Adicionado
- Healthcheck no container scraper para auto-restart
- Documentação atualizada no CLAUDE.md
- Backup automatizado do docker-compose.yml antes de alterações

## [2026-02-22] - Correção de Acesso EGS

### Corrigido
- Resolvido problema de acesso ao perfil DESTACK no EGS Sistemas
- Perfil estava bloqueado, liberado pelo suporte EGS
- Robô voltou a operar normalmente

### Dados
- 895 registros de CT-e processados
- 908 arquivos XML baixados

## [2026-02-20] - Manutenção Preventiva

### Adicionado
- Monitoramento de logs do scraper
- Configuração de healthcheck Docker

### Dados
- Container funcionando estável há 3 semanas

---

**Nota:** Para atualizar a senha do EGS, editar o arquivo  na raiz do projeto e alterar a variável , depois executar .
