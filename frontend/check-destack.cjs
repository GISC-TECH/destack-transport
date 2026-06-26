const { chromium } = require('playwright');
const fs = require('fs');

const BASE = 'https://destacktransporte.site';
const USER = 'admin';
const PASS = 'admin123';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();

  const errors = [];
  const warnings = [];

  page.on('pageerror', e => errors.push({ type: 'pageerror', message: e.message, stack: e.stack || '' }));
  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    if (type === 'error') errors.push({ type: 'console.error', message: text });
    if (type === 'warning') warnings.push({ type: 'console.warning', message: text });
  });
  page.on('response', async resp => {
    const url = resp.url();
    if (url.includes('/api/') && !resp.ok()) {
      const body = await resp.text().catch(() => '');
      errors.push({ type: 'http', status: resp.status(), url, body: body.slice(0, 200) });
    }
  });

  const result = {
    login: false,
    pages: {},
    errors,
    warnings,
    timestamp: new Date().toISOString(),
  };

  try {
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
    await page.fill('input[name="username"], input[type="text"]', USER);
    await page.fill('input[name="password"], input[type="password"]', PASS);
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle' }),
      page.click('button[type="submit"]')
    ]);
    result.login = page.url().includes('/dashboard') || !page.url().includes('/login');

    const pages = [
      { name: 'dashboard', path: '/dashboard' },
      { name: 'cte', path: '/ctes' },
      { name: 'mdfe', path: '/mdfes' },
      { name: 'clientes', path: '/clientes' },
      { name: 'motoristas', path: '/motoristas' },
      { name: 'veiculos', path: '/veiculos' },
      { name: 'pagamentos', path: '/pagamentos' },
      { name: 'manutencao', path: '/manutencoes' },
      { name: 'financeiro', path: '/financeiro' },
      { name: 'configuracoes', path: '/configuracoes' },
    ];

    for (const p of pages) {
      try {
        await page.goto(`${BASE}${p.path}`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(1500);
        const currentUrl = page.url();
        const title = await page.title().catch(() => '');
        result.pages[p.name] = { ok: currentUrl.includes(p.path.replace(/^\//, '')), url: currentUrl, title };
      } catch (e) {
        result.pages[p.name] = { ok: false, error: e.message };
      }
    }

    // Testa filtros na página de CT-e
    try {
      await page.goto(`${BASE}/ctes`, { waitUntil: 'networkidle' });
      const filterInput = page.locator('input[placeholder*="Número"], input[placeholder*="numero"], input[placeholder*="buscar"]').first();
      if (await filterInput.isVisible().catch(() => false)) {
        await filterInput.fill('999999999');
        await page.waitForTimeout(1500);
        const rows = await page.locator('table tbody tr, .mobile-card').count().catch(() => 0);
        result.pages['cte_filter'] = { ok: true, rows };
      }
    } catch (e) {
      result.pages['cte_filter'] = { ok: false, error: e.message };
    }

    // Testa filtros na página de pagamentos
    try {
      await page.goto(`${BASE}/pagamentos`, { waitUntil: 'networkidle' });
      const searchInput = page.locator('input[placeholder*="Buscar"], input[placeholder*="buscar"]').first();
      if (await searchInput.isVisible().catch(() => false)) {
        await searchInput.fill('xyznonexistent');
        await page.waitForTimeout(1500);
        const rows = await page.locator('table tbody tr, .mobile-card').count().catch(() => 0);
        result.pages['pagamentos_filter'] = { ok: true, rows };
      }
    } catch (e) {
      result.pages['pagamentos_filter'] = { ok: false, error: e.message };
    }

    // Testa responsividade mobile (menu deve existir)
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    const hamburger = page.locator('button.hamburger, .mobile-menu-button, [aria-label*="menu"]').first();
    result.pages['mobile_menu'] = { ok: await hamburger.isVisible().catch(() => false) };

  } catch (e) {
    result.fatal = e.message;
  } finally {
    await browser.close();
  }

  fs.writeFileSync('/tmp/check-destack-result.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
})();
