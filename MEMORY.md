# Memory - Destack Transport

## Último Deploy Realizado
- **Data:** 2026-07-02
- **Versão:** v1.1.11
- **Commit:** 7adfab9
- **Branch:** feat/reskin-verde-prototipo
- **Servidor:** destack-prod (31.97.247.165)
- **Health check:** https://destacktransporte.site/api/health/ -> healthy
- **Backup pré-deploy:** /tmp/prod_destack_db_pre_v1.1.5_20260629_214314.dump (último backup completo)
- **Stash local no servidor:** pre-deploy-v1.1.5-local-changes

### Deploys Anteriores
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
```bash
# Deploy
PROD_SSH=destack-prod VERSION=v1.1.5 ./scripts/deploy-producao.sh

# Health check
ssh destack-prod "curl -sf https://destacktransporte.site/api/health/"
```

## Notas
- Servidor de produção tinha mudanças locais não commitadas; foram stashed antes do deploy.
- Usuários devem fazer hard refresh no navegador após deploys de frontend.
