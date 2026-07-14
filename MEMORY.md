# Memory - Destack Transport

## Infraestrutura Atual (Contabo)
- **Servidor:** Contabo VPS 207.180.255.150
- **Domínio:** https://destacktransporte.com
- **Domínio WWW:** https://www.destacktransporte.com
- **Reverse Proxy:** Traefik v3.6.11 (Let's Encrypt automático)
- **Stack:** PostgreSQL 17, Redis 7, Django, React, Celery
- **Caminho no servidor:** /root/apps/destack
- **Compose:** docker-compose.contabo.yml
- **Health check:** https://destacktransporte.com/api/health/ -> healthy

## Último Deploy Realizado
- **Data:** 2026-07-14
- **Versão:** v1.1.12
- **Commit:** 3bfe9cb
- **Branch:** feat/reskin-verde-prototipo
- **Servidor anterior:** destack-prod (31.97.247.165) — inacessível
- **Backup usado na migração:** backups/daily/20260703_020000.dump

### Deploys Anteriores
- **v1.1.11** (7adfab9): Correção de redirecionamento da landing page
- **v1.1.10** (5ca41df): Fases 2 a 5 - CSS morto, ajustes visuais e variáveis CSS
- **v1.1.9** (cadc06b): Fase 1 de acessibilidade
- **v1.1.8** (d4e36db): Auditoria e correções de responsividade mobile
- **v1.1.7** (7def2d6): Reversão de baixa em pagamentos agregados/próprios
- **v1.1.6** (63d3868): Ajustes finos de responsividade nos filtros de relatórios
- **v1.1.5** (b55d9c7): Melhorias nos relatórios - filtros específicos, campos completos, responsividade mobile

## Melhorias Aplicadas (v1.1.5)

### Relatórios
- Card de filtros ajustado para mobile usando `DateFilter variant="flat"`
- Filtros específicos por tipo de relatório adicionados na UI
- Campos completados/padronizados nos relatórios:
  - CT-e: chave, série, UF/município origem/destino, dist_km, valor_recebido, valor_cif, valor_fob, tipo_cte, cfop, natureza operação, placa, status
  - MDF-e: chave, série, dh_ini_viagem, qtd NF-e, peso carga, unidade, modal, renavam, status
  - Pagamentos: coluna valor_total_pagar padronizada, cte_chave, desconto, dados do condutor
  - Motoristas: telefone, email, cidade/UF, dados bancários/pix, validades NR20/NR35/MOPP/Toxicológico/ASO

### Migração para Contabo (2026-07-08)
- Servidor antigo (31.97.247.165) ficou inacessível via SSH
- Código fonte enviado para `/root/apps/destack` no Contabo (207.180.255.150)
- Criado `docker-compose.contabo.yml` adaptado para rede `traefik-proxy`
- Banco PostgreSQL 17 restaurado a partir de `backups/daily/20260703_020000.dump`
- Domínios configurados no Cloudflare: `destacktransporte.com` e `www.destacktransporte.com`
- SSL/TLS via Let's Encrypt + Cloudflare
- Health check público OK: https://destacktransporte.com/api/health/

### Coleta de XMLs via Scraper Local (2026-07-09)
- Scraper no Contabo bloqueado pelo EGS Sistemas (IP estrangeiro)
- Scraper local (Mac, IP brasileiro) configurado para enviar XMLs direto para API da Contabo
- Credenciais EGS atualizadas no `.env.local`
- Execução do `daily_download.py` local:
  - **85 XMLs novos enviados e processados com sucesso** (CT-e e MDF-e)
  - **2.425 XMLs ignorados** (já existiam no banco)
  - **2 falhas** (XML fora do leiaute oficial)
- Container scraper no Contabo permanece parado; coletas devem ser feitas localmente até resolver o bloqueio de IP

### Permite Upload de Comprovante na Edição de Pagamentos (v1.1.12)
- Remove restrição `!isEditing` do campo de comprovante em `PagamentoAgregadoForm`
- Remove restrição `!isEditing` do campo de comprovante em `PagamentoProprioForm`
- Ajusta label de CT-e de "Opcional" para "Obrigatório" no formulário agregado
- Usuários do grupo Financeiro podem agora adicionar/complementar o comprovante tanto na criação quanto na edição do pagamento

### Correção de Redirecionamento da Landing Page (v1.1.11)
- Corrigido redirecionamento indevido para `/login?expired=1` ao acessar a landing page (`/`)
- Evento `auth:session-expired` agora só redireciona quando o usuário está em rotas protegidas
- Landing page (`/`) e página de login (`/login`) permanecem acessíveis mesmo com sessão expirada

### Fases 2 a 5 - CSS Morto, Ajustes Visuais e Variáveis CSS (v1.1.10)
- Removidas classes CSS mortas em CTeShared, MDFe, Financeiro, Dashboard, VeiculosList, MotoristasList, ClientesList
- Aplicados touch targets mínimos 44×44px em botões e ícones mobile (Button, DateFilter, Sidebar, Navbar, PagamentosList, Relatorios)
- Padronizadas cores, espaçamentos, fontes e bordas com variáveis CSS globais
- Corrigidos safe checks em `.toFixed()` do Dashboard e MDFeList
- Botão "Reverter Baixa" ajustado para não parecer ação primária (outline)
- Modal com foco automático ao abrir
- ~1.249 linhas removidas, ~497 inseridas

### Fase 1 de Acessibilidade (v1.1.9)
- Associados labels e inputs via `htmlFor` + `id` em todos os formulários principais
- Adicionados `aria-label` e `title` em botões ícone-only (CT-e, MDF-e, Pagamentos, etc.)
- Adicionados `role="alert"` e `aria-live="polite"` em mensagens de erro/sucesso
- Melhorado `focus-visible` em Button, Sidebar, Navbar e DateFilter
- Corrigida hierarquia de headings nas páginas principais
- Cards de seleção de relatório agora são focáveis e acessíveis via teclado

### Auditoria e Correções de Responsividade (v1.1.8)
- Auditoria visual de todas as telas do frontend
- Corrigidas telas que ficavam em branco no mobile (tabelas escondidas sem cards alternativos):
  - Planos de Manutenção, Backup, Multas/Sinistros, Ordens de Viagem, Abastecimentos, Pedágios
- Corrigido uso de tokens inexistentes (`infoLight`, `warningLight`, `successLight`) em ícones de KPI
- Corrigida classe global inexistente `ml-2` em Pagamentos Pendentes
- Adicionados safe checks em `DRE.jsx` e `Inadimplencia.jsx`
- Corrigidos wrappers `desktopOnly`/`mobileOnly` inexistentes no CIOT

### Reversão de Baixa em Pagamentos (v1.1.7)
- Adicionados endpoints:
  - `POST /api/pagamentos/agregados/{id}/reverter-baixa/`
  - `POST /api/pagamentos/proprios/{id}/reverter-baixa/`
- Reverte status de `pago` para `pendente`
- Limpa `data_pagamento` e remove o comprovante vinculado
- Sincroniza `CTeDocumento.pago` ao reverter
- Botão de reverter baixa disponível na lista de pagamentos (desktop e mobile)

### Ajustes Finos de Responsividade (v1.1.6)
- Reduzido espaçamento entre campos do DateFilter flat
- Inputs e selects dos filtros agora ocupam 100% da largura no mobile
- Padding do card de filtros otimizado para telas pequenas
- Font-size dos inputs ajustada para evitar zoom automático no iOS

### Testes Aprovados
- `npm run lint` e `npm run build` (frontend)
- `python manage.py check` (backend)
- `python manage.py test transport.tests.test_relatorios` (4/4 passaram)

## Comandos Úteis

### Deploy na Contabo
```bash
ssh root@207.180.255.150
cd /root/apps/destack
docker compose -f docker-compose.contabo.yml up -d --build
docker compose -f docker-compose.contabo.yml exec -T web python manage.py migrate --noinput
docker compose -f docker-compose.contabo.yml exec -T web python manage.py collectstatic --noinput
```

### Health check
```bash
curl -sf https://destacktransporte.com/api/health/
```

### Coleta de XMLs local (IP brasileiro → Contabo)
```bash
cd /Users/italocosta/workspace/projects/destack-transport

# Ultimos 7 dias
docker compose -f docker-compose.local.yml run --rm \
  -e DESTACK_API_URL=https://destacktransporte.com/api \
  scraper python daily_download.py

# Range de datas (ex: 01/07/2026 a 09/07/2026)
docker compose -f docker-compose.local.yml run --rm \
  -e DESTACK_API_URL=https://destacktransporte.com/api \
  -v /Users/italocosta/workspace/projects/destack-transport/scraper/download_date_range.py:/app/download_date_range.py \
  scraper python download_date_range.py 01/07/2026 09/07/2026
```

### Totais atuais no banco (Contabo)
```text
CT-e:  7.122
MDF-e: 4.544
CT-e julho/2026:  42
MDFe julho/2026:  22
```

## Notas
- Servidor antigo (31.97.247.165) tinha mudanças locais não commitadas; foram stashed antes da migração.
- Scraper no Contabo está parado porque o EGS Sistemas bloqueia IP estrangeiro; coletas devem ser feitas localmente.
- Container scraper no Contabo pode ser ativado se o EGS liberar o IP 207.180.255.150 ou se for configurado proxy/VPN brasileiro.
- Usuários devem fazer hard refresh no navegador após deploys de frontend.
