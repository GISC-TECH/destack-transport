# Memory - Destack Transport

## Último Deploy Realizado
- **Data:** 2026-06-30
- **Versão:** v1.1.8
- **Commit:** d4e36db
- **Branch:** feat/reskin-verde-prototipo
- **Servidor:** destack-prod (31.97.247.165)
- **Health check:** https://destacktransporte.site/api/health/ -> healthy
- **Backup pré-deploy:** /tmp/prod_destack_db_pre_v1.1.5_20260629_214314.dump (último backup completo)
- **Stash local no servidor:** pre-deploy-v1.1.5-local-changes

### Deploys Anteriores
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
