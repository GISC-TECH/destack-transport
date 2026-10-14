const { chromium } = require('playwright');
const fs = require('fs');

const BASE = 'https://localhost:8443';
const OUTDIR = '/tmp/mobile_correcoes';
fs.mkdirSync(OUTDIR, { recursive: true });

const routes = [
  { path: '/mdfes', name: 'mdfes' },
  { path: '/financeiro', name: 'financeiro' },
  { path: '/financeiro/dre', name: 'dre' },
  { path: '/financeiro/fluxo-caixa', name: 'fluxo_caixa' },
  { path: '/financeiro/inadimplencia', name: 'inadimplencia' },
  { path: '/alertas', name: 'alertas' },
  { path: '/vencimentos', name: 'vencimentos' },
  { path: '/comunicacao', name: 'comunicacao' },
  { path: '/pagamentos', name: 'pagamentos' },
  { path: '/pedagios', name: 'pedagios' },
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.locator('input[type="text"]').first().fill('admin');
  await page.locator('input[type="password"]').first().fill('admin123');
  await page.locator('button[type="submit"]').first().click();
  await page.waitForURL(`${BASE}/dashboard`, { timeout: 10000 });

  for (const route of routes) {
    try {
      await page.goto(`${BASE}${route.path}`, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(2500);
      await page.screenshot({ path: `${OUTDIR}/${route.name}.png`, fullPage: false });
      console.log(`OK: ${route.name}`);
    } catch (err) {
      console.log(`ERRO: ${route.name} - ${err.message}`);
    }
  }

  await browser.close();
})();
