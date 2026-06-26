const { chromium } = require('playwright');

const BASE = 'https://destacktransporte.site';
const USER = 'admin';
const PASS = 'admin123';

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.fill('input[name="username"], input[type="text"]', USER);
  await page.fill('input[name="password"], input[type="password"]', PASS);
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle' }),
    page.click('button[type="submit"]')
  ]);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();
  const errors = [];

  page.on('pageerror', async e => {
    errors.push({ type: 'pageerror', message: e.message, stack: e.stack || '', url: page.url() });
  });
  page.on('console', async msg => {
    if (msg.type() === 'error') {
      errors.push({ type: 'console.error', message: msg.text(), url: page.url() });
    }
  });
  page.on('response', async resp => {
    const url = resp.url();
    if (url.includes('/api/') && !resp.ok()) {
      const body = await resp.text().catch(() => '');
      errors.push({ type: 'api_error', status: resp.status(), url: url.slice(0, 200), body: body.slice(0, 200) });
    }
  });

  await login(page);

  const pages = [
    '/dashboard', '/ctes', '/ctes/pendentes', '/mdfes', '/clientes', '/clientes/novo',
    '/motoristas', '/motoristas/novo', '/veiculos', '/veiculos/novo',
    '/pagamentos', '/pagamentos/agregados/novo', '/pagamentos/proprios/novo',
    '/manutencoes', '/manutencoes/nova', '/ordens-viagem', '/ordens-viagem/nova',
    '/abastecimentos', '/abastecimentos/novo', '/pedagios', '/pedagios/novo',
    '/planos-manutencao', '/frota/multas-sinistros', '/tabelas-frete', '/tabelas-frete/nova',
    '/financeiro', '/faturas', '/faturas/nova', '/financeiro/contas-a-pagar',
    '/financeiro/contas-a-pagar/nova', '/financeiro/conciliacao', '/financeiro/inadimplencia',
    '/financeiro/fluxo-caixa', '/financeiro/dre', '/relatorios', '/configuracoes',
    '/usuarios', '/usuarios/novo', '/backup', '/alertas', '/upload', '/vencimentos',
    '/geografico', '/rastreamento', '/comunicacao', '/ciot', '/faixas-km',
  ];

  const result = {
    login: !page.url().includes('/login'),
    pages: [],
    errors,
  };

  for (const path of pages) {
    try {
      await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1200);
      result.pages.push({ path, ok: page.url().includes(path.replace(/^\//, '').replace(/\/$/, '')), url: page.url() });
    } catch (e) {
      result.pages.push({ path, ok: false, error: e.message });
    }
  }

  await browser.close();
  console.log(JSON.stringify(result, null, 2));
})();
