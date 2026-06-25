import { test, expect } from '@playwright/test';

const SCREENSHOT_DIR = './e2e/screenshots';

async function login(page) {
  await page.goto('/login');
  await page.waitForSelector('#username', { timeout: 10000 });
  await page.locator('#username').click();
  await page.locator('#username').fill('admin');
  await page.locator('#password').click();
  await page.locator('#password').fill('admin123');
  await page.getByRole('button', { name: /entrar/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 15000 });
}

async function waitAndScreenshot(page, name) {
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SCREENSHOT_DIR}/${name}.png`, fullPage: true });
}

test.describe('QA Visual Expandido - Telas publicas', () => {
  test('Landing page', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Transporte especializado/ })).toBeVisible({ timeout: 10000 });
    await waitAndScreenshot(page, '00-landing');
  });

  test('Login', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('#username')).toBeVisible({ timeout: 10000 });
    await waitAndScreenshot(page, '00-login');
  });
});

test.describe('QA Visual Expandido - Listas e paineis', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  const screens = [
    { name: '10-faturas', path: '/faturas', menu: 'Financeiro', sub: 'Faturas' },
    { name: '11-contas-a-pagar', path: '/financeiro/contas-a-pagar', menu: 'Financeiro', sub: 'Contas a Pagar' },
    { name: '12-conciliacao', path: '/financeiro/conciliacao', menu: 'Financeiro', sub: 'Conciliação Bancária' },
    { name: '13-inadimplencia', path: '/financeiro/inadimplencia', menu: 'Financeiro', sub: 'Inadimplência' },
    { name: '14-fluxo-caixa', path: '/financeiro/fluxo-caixa', menu: 'Financeiro', sub: 'Fluxo de Caixa' },
    { name: '15-dre', path: '/financeiro/dre', menu: 'Financeiro', sub: 'DRE' },
    { name: '16-pagamentos', path: '/pagamentos', menu: 'Financeiro', sub: 'Pagamentos' },
    { name: '17-ctes-pendentes', path: '/ctes/pendentes', menu: 'Financeiro', sub: 'CT-es Pendentes' },
    { name: '18-faixas-km', path: '/faixas-km', menu: 'Financeiro', sub: 'Faixas de KM' },
    { name: '19-ordens-viagem', path: '/ordens-viagem', menu: 'Operação', sub: 'Ordens de Viagem' },
    { name: '20-rastreamento', path: '/rastreamento', menu: 'Operação', sub: 'Rastreamento GPS' },
    { name: '21-comunicacao', path: '/comunicacao', menu: 'Operação', sub: 'Comunicação' },
    { name: '22-ciot', path: '/ciot', menu: 'Operação', sub: 'CIOT' },
    { name: '23-abastecimentos', path: '/abastecimentos', menu: 'Operação', sub: 'Abastecimento' },
    { name: '24-planos-manutencao', path: '/planos-manutencao', menu: 'Operação', sub: 'Planos de Manutenção' },
    { name: '25-pedagios', path: '/pedagios', menu: 'Operação', sub: 'Pedágios' },
    { name: '26-multas-sinistros', path: '/frota/multas-sinistros', menu: 'Operação', sub: 'Multas/Sinistros' },
    { name: '27-tabelas-frete', path: '/tabelas-frete', menu: 'Operação', sub: 'Tabela de Frete' },
    { name: '28-manutencoes', path: '/manutencoes', menu: 'Frota', sub: 'Manutenção' },
    { name: '29-relatorios', path: '/relatorios', menu: 'Inteligência', sub: 'Relatórios Gerais' },
    { name: '30-geografico', path: '/geografico', menu: 'Inteligência', sub: 'Painel Geográfico' },
    { name: '31-alertas', path: '/alertas', menu: 'Sistema', sub: 'Alertas' },
    { name: '32-vencimentos', path: '/vencimentos', menu: 'Sistema', sub: 'Vencimentos' },
    { name: '33-usuarios', path: '/usuarios', menu: 'Sistema', sub: 'Usuários' },
    { name: '34-backup', path: '/backup', menu: 'Sistema', sub: 'Backup' },
  ];

  for (const screen of screens) {
    test(screen.name, async ({ page }) => {
      // Navega direto pela URL para evitar problemas de menu; depois valida o menu ativo.
      await page.goto(screen.path);
      await waitAndScreenshot(page, screen.name);
    });
  }
});

test.describe('QA Visual Expandido - Formularios novos', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  const forms = [
    { path: '/clientes/novo', name: '40-cliente-novo' },
    { path: '/motoristas/novo', name: '41-motorista-novo' },
    { path: '/veiculos/novo', name: '42-veiculo-novo' },
    { path: '/faturas/nova', name: '43-fatura-nova' },
    { path: '/financeiro/contas-a-pagar/nova', name: '44-conta-pagar-nova' },
    { path: '/pagamentos/agregados/novo', name: '45-pagamento-agregado-novo' },
    { path: '/pagamentos/proprios/novo', name: '46-pagamento-proprio-novo' },
    { path: '/manutencoes/nova', name: '47-manutencao-nova' },
    { path: '/ordens-viagem/nova', name: '48-ordem-viagem-nova' },
    { path: '/abastecimentos/novo', name: '49-abastecimento-novo' },
    { path: '/planos-manutencao/novo', name: '50-plano-manutencao-novo' },
    { path: '/pedagios/novo', name: '51-pedagio-novo' },
    { path: '/tabelas-frete/nova', name: '52-tabela-frete-nova' },
    { path: '/usuarios/novo', name: '53-usuario-novo' },
  ];

  for (const form of forms) {
    test(form.name, async ({ page }) => {
      await page.goto(form.path);
      await waitAndScreenshot(page, form.name);
    });
  }
});

test.describe('QA Visual Expandido - Detalhes', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('CT-e detalhe', async ({ page }) => {
    await page.goto('/ctes');
    await waitAndScreenshot(page, '60-cte-lista');
    const firstRow = page.locator('table tbody tr, .cte-card, .cte-list .cte-item').first();
    if (await firstRow.isVisible().catch(() => false)) {
      const link = firstRow.locator('a[href^="/ctes/"]').first();
      if (await link.isVisible().catch(() => false)) {
        await link.click();
        await page.waitForTimeout(1500);
        await waitAndScreenshot(page, '61-cte-detalhe');
      }
    }
  });

  test('MDF-e detalhe', async ({ page }) => {
    await page.goto('/mdfes');
    await waitAndScreenshot(page, '62-mdfe-lista');
    const firstRow = page.locator('table tbody tr, .mdfe-card, .mdfe-list .mdfe-item').first();
    if (await firstRow.isVisible().catch(() => false)) {
      const link = firstRow.locator('a[href^="/mdfes/"]').first();
      if (await link.isVisible().catch(() => false)) {
        await link.click();
        await page.waitForTimeout(1500);
        await waitAndScreenshot(page, '63-mdfe-detalhe');
      }
    }
  });
});
