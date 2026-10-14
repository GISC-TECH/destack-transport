# Plano de Correção - Ajustes Mínimos do Frontend

## Objetivo
Aplicar ajustes mínimos, seguros e de baixo risco em todas as telas do sistema para melhorar:
1. Acessibilidade básica
2. Limpeza de CSS morto
3. Ajustes visuais finos (espaçamentos, cores hardcoded, touch targets)

## Estratégia
- Foco em **micro-ajustes** que não alteram arquitetura nem lógica de negócio
- Agrupar por fases para facilitar testes regressivos
- Manter compatibilidade com desktop e mobile
- Cada fase gera um commit separado para rollback seguro

---

## FASE 1 - Acessibilidade Básica (Prioridade Alta)

### 1.1 Associar label a input/select/textarea via `htmlFor` + `id`
Telas com formulários onde label não tem htmlFor e input não tem id:
- `frontend/src/components/Clientes/ClienteForm.jsx`
- `frontend/src/components/Motoristas/MotoristaForm.jsx`
- `frontend/src/components/Veiculos/VeiculoForm.jsx`
- `frontend/src/components/Financeiro/FaturaForm.jsx`
- `frontend/src/components/Financeiro/ContaPagarForm.jsx`
- `frontend/src/components/Pagamentos/PagamentoAgregadoForm.jsx`
- `frontend/src/components/Pagamentos/PagamentoProprioForm.jsx`
- `frontend/src/components/OrdensViagem/OrdemViagemForm.jsx`
- `frontend/src/components/Abastecimento/AbastecimentoForm.jsx`
- `frontend/src/components/Pedagio/PedagioForm.jsx`
- `frontend/src/components/TabelaFrete/TabelaFreteForm.jsx`
- `frontend/src/components/Manutencao/ManutencaoForm.jsx`
- `frontend/src/components/PlanosManutencao/PlanoManutencaoForm.jsx`
- `frontend/src/components/Usuarios/UsuarioForm.jsx`

**Ação padrão:**
```jsx
<label htmlFor="campoNome">Nome</label>
<input id="campoNome" name="nome" ... />
```

### 1.2 Adicionar `aria-label` em botões ícone-only
Componentes com botões sem texto:
- `frontend/src/components/Pagamentos/PagamentosList.jsx` (ícones de baixar, reverter, excluir, converter, comprovante, whatsapp, notificar)
- `frontend/src/components/CTe/CTeList.jsx` (ícones de ações)
- `frontend/src/components/MDFe/MDFeList.jsx`
- `frontend/src/components/Veiculos/VeiculosList.jsx`
- `frontend/src/components/Manutencao/ManutencaoList.jsx`
- `frontend/src/components/Financeiro/FaturasList.jsx`
- `frontend/src/components/Financeiro/ContasPagarList.jsx`
- `frontend/src/components/Common/DateFilter.jsx` (botões de período, aplicar)
- `frontend/src/components/Common/Modal.jsx` (botão fechar)
- `frontend/src/components/Common/Sidebar.jsx` (botão toggle)
- `frontend/src/components/Common/Navbar.jsx` (botões de notificação/perfil)

**Ação padrão:**
```jsx
<button aria-label="Baixar pagamento" title="Baixar pagamento">...</button>
```

### 1.3 Adicionar `role="alert"` e `aria-live` em mensagens de erro/sucesso
- `frontend/src/components/Common/Toast.jsx` (se existir) ou todas as mensagens inline
- `frontend/src/components/Relatorios/Relatorios.jsx` (errorMessage, successMessage)
- `frontend/src/components/Auth/Login.jsx` (mensagem de erro)
- `frontend/src/components/Comunicacao/ComunicacaoPanel.jsx`
- Todos os formulários com mensagem de erro inline

**Ação padrão:**
```jsx
<div className={styles.errorMessage} role="alert" aria-live="polite">...</div>
```

### 1.4 Garantir foco visível em botões/links
- Verificar `:focus-visible` em todos os `.module.css` de botões
- Adicionar outline padrão se ausente
- Prioridade: `Button.module.css`, `Sidebar.module.css`, `Navbar.module.css`

### 1.5 Headings hierárquicos
- Garantir que cada página tenha apenas um `<h1>`
- Corrigir pulos de heading (ex: h1 → h3) sem h2
- Telas: Dashboard, Relatórios, Configuracoes, todos os formulários

---

## FASE 2 - Limpeza de CSS Morto (Prioridade Média-Alta)

### 2.1 Remover classes não utilizadas
Verificar e remover de cada `.module.css` as classes que não são referenciadas no `.jsx` correspondente.

**Arquivos com CSS morto identificado:**
- `frontend/src/components/Pagamentos/PagamentosList.module.css` (`.mobileActionBtn.delete`, `.excluir`, `.whatsapp`, `.convert` se não usadas)
- `frontend/src/components/Relatorios/Relatorios.module.css` (regras antigas de `.dateFilter` flat que podem ter sido substituídas)
- `frontend/src/components/Financeiro/Financeiro.module.css` (classes de cards antigos)
- `frontend/src/components/CTe/CTeShared.module.css` (estilos não referenciados)
- `frontend/src/components/Clientes/Clientes.module.css`
- `frontend/src/components/Veiculos/Veiculos.module.css`
- `frontend/src/components/Common/TableContainer.module.css` (classes duplicadas)

### 2.2 Remover imports não utilizados
- `frontend/src/components/Auth/ProtectedRoute.jsx` (se houver)
- Todos os componentes que importam `useState`/`useEffect` sem usar
- Imports de ícones não utilizados

### 2.3 Remover comentários de código morto
- Blocos comentados em `frontend/src/services/api.js`
- CSS comentado em vários `.module.css`
- Console.log de debug em produção

### 2.4 Remover bibliotecas/dependências não utilizadas
- Verificar `frontend/package.json` por libs não usadas
- Verificar imports de `tokens.module.css` onde não usam tokens

---

## FASE 3 - Ajustes Visuais Finos (Prioridade Média)

### 3.1 Touch targets mínimos 44x44px
Botões e ícones muito pequenos em mobile:
- Ícones de ação nas listas (atualmente ~16px com padding pequeno)
- Botões de período no DateFilter
- Botões do mobileActionBtn
- Botões de fechar modal
- Botões da Sidebar mobile

**Ação padrão:**
```css
.actionBtn {
  min-width: 44px;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
}
```

### 3.2 Cores hardcoded → variáveis CSS
- `frontend/src/components/CTe/CTeShared.module.css` (cores diretas)
- `frontend/src/components/Financeiro/Financeiro.module.css`
- `frontend/src/components/Veiculos/Veiculos.module.css`
- `frontend/src/components/Relatorios/Relatorios.module.css`
- `frontend/src/components/Dashboard/Dashboard.module.css`

**Ação padrão:**
```css
/* antes */
color: #28a745;
background: #fff3cd;

/* depois */
color: var(--success-color);
background: var(--warning-light);
```

### 3.3 Espaçamentos inconsistentes
Padronizar gaps/paddings para usar variáveis CSS (`--space-*`):
- `gap: 22px` → `gap: var(--space-5)`
- `padding: 18px` → `padding: var(--space-4)`
- `margin: 12px` → `margin: var(--space-3)`

**Arquivos prioritários:**
- `frontend/src/components/Relatorios/Relatorios.module.css`
- `frontend/src/components/Pagamentos/PagamentosList.module.css`
- `frontend/src/components/Financeiro/Financeiro.module.css`
- `frontend/src/components/Manutencao/Manutencao.module.css`

### 3.4 Fontes consistentes
- Verificar tamanhos de fonte hardcoded (ex: `font-size: 12px`, `14px`)
- Padronizar para `var(--text-xs)`, `var(--text-sm)`, etc.
- Garantir `line-height` adequado

### 3.5 Bordas e sombras consistentes
- Substituir `border-radius` hardcoded por `var(--radius-sm)`, `var(--radius-md)`, `var(--radius-lg)`
- Substituir `box-shadow` hardcoded por `var(--shadow-sm)`, `var(--shadow-md)`

### 3.6 Loading states e empty states
- Garantir que todos os componentes tenham estado de carregamento consistente
- Verificar mensagens de empty state centralizadas e com ícone

---

## FASE 4 - Correções Específicas por Tela (Prioridade Média)

### 4.1 Dashboard
- Verificar gráficos com altura mínima em mobile
- Cards de KPI com ícones alinhados
- Verificar `toFixed` sem safe check nos valores

### 4.2 CT-e / MDF-e
- Garantir que ações da tabela não quebrem em telas médias
- Verificar campos de data com `font-size: 16px` para evitar zoom no iOS

### 4.3 Financeiro
- FaturasList: botões de ação com espaçamento adequado
- ContasPagarList: status badges com cores consistentes
- ConciliacaoBancaria: tabela de transações com scroll horizontal
- DRE/FluxoCaixa: valores formatados e alinhados à direita

### 4.4 Pagamentos
- Ajustar botão de "Reverter Baixa" para não confundir com ações primárias
- Melhorar modal de confirmação
- Verificar mobile action buttons com largura adequada

### 4.5 Relatórios
- Manter DateFilter flat com bons espaçamentos
- Garantir que os filtros específicos não quebrem em telas pequenas
- Botão "Gerar Relatório" com largura total em mobile

### 4.6 Configurações / Usuários / Perfis
- Verificar permissões e switches acessíveis
- Labels dos switches com `htmlFor`

### 4.7 Componentes comuns
- `Common/Modal.jsx`: foco ao abrir, botão fechar com aria-label
- `Common/DateFilter.jsx`: inputs com label visível ou aria-label
- `Common/Button.jsx`: focus visible consistente
- `Common/Sidebar.jsx`: contraste dos itens ativos
- `Common/Navbar.jsx`: dropdown acessível via teclado

---

## FASE 5 - Padronização de Variáveis CSS (Prioridade Baixa-Média)

### 5.1 Criar/auditar variáveis faltantes
Verificar se todas as cores usadas nos componentes existem em:
- `frontend/src/index.css` ou `frontend/src/styles/variables.css`

### 5.2 Substituir hexadecimais por variáveis
- Mapear cores hardcoded e criar variáveis se necessário
- Prioridade para cores de status (info, success, warning, danger)

---

## Critérios de Aceitação

1. **Lint:** `npm run lint` sem erros
2. **Build:** `npm run build` sem erros
3. **Check Django:** `python manage.py check` sem erros
4. **Testes:** `python manage.py test transport.tests` passando
5. **Testes visuais manuais:**
   - Navegar em todas as telas em desktop (1920px, 1366px)
   - Navegar em todas as telas em tablet (768px)
   - Navegar em todas as telas em mobile (375px)
   - Verificar com Lighthouse acessibilidade (mínimo 85)

---

## Estimativa
- Fase 1 (Acessibilidade): 2-3 horas
- Fase 2 (CSS morto): 1-2 horas
- Fase 3 (Ajustes visuais): 2-3 horas
- Fase 4 (Correções específicas): 2-3 horas
- Fase 5 (Padronização de variáveis): 1-2 horas
- Testes e deploy: 1 hora

**Total estimado:** 9-12 horas de trabalho

---

## Sugestão de Execução
Executar em **5 deploys separados** (um por fase), exceto Fase 5 que pode ser combinada com Fase 3:
1. v1.1.9 - Acessibilidade básica
2. v1.1.10 - Limpeza de CSS morto
3. v1.1.11 - Ajustes visuais finos + variáveis CSS
4. v1.1.12 - Correções específicas por tela
5. v1.1.13 - Testes finais, Lighthouse e ajustes pós-teste
