const { chromium } = require('playwright');
const fs = require('fs');

const BASE = 'https://localhost:8443';
const OUTDIR = '/tmp/mobile_screenshots';
fs.mkdirSync(OUTDIR, { recursive: true });

const routes = [
  { path: '/dashboard', name: 'dashboard' },
  { path: '/ctes', name: 'ctes' },
  { path: '/ctes/pendentes', name: 'ctes_pendentes' },
  { path: '/mdfes', name: 'mdfes' },
  { path: '/clientes', name: 'clientes' },
  { path: '/motoristas', name: 'motoristas' },
  { path: '/veiculos', name: 'veiculos' },
  { path: '/pagamentos', name: 'pagamentos' },
  { path: '/financeiro', name: 'financeiro' },
  { path: '/faturas', name: 'faturas' },
  { path: '/financeiro/contas-a-pagar', name: 'contas_pagar' },
  { path: '/financeiro/fluxo-caixa', name: 'fluxo_caixa' },
  { path: '/financeiro/dre', name: 'dre' },
  { path: '/financeiro/inadimplencia', name: 'inadimplencia' },
  { path: '/financeiro/conciliacao', name: 'conciliacao' },
  { path: '/ordens-viagem', name: 'ordens_viagem' },
  { path: '/manutencoes', name: 'manutencoes' },
  { path: '/upload', name: 'upload' },
  { path: '/relatorios', name: 'relatorios' },
  { path: '/geografico', name: 'geografico' },
  { path: '/comunicacao', name: 'comunicacao' },
  { path: '/ciot', name: 'ciot' },
  { path: '/abastecimentos', name: 'abastecimentos' },
  { path: '/pedagios', name: 'pedagios' },
  { path: '/frota/multas-sinistros', name: 'multas_sinistros' },
  { path: '/tabelas-frete', name: 'tabelas_frete' },
  { path: '/configuracoes', name: 'configuracoes' },
  { path: '/usuarios', name: 'usuarios' },
  { path: '/perfis', name: 'perfis' },
  { path: '/vencimentos', name: 'vencimentos' },
  { path: '/rastreamento', name: 'rastreamento' },
  { path: '/alertas', name: 'alertas' },
  { path: '/backup', name: 'backup' },
  { path: '/faixas-km', name: 'faixas_km' },
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
      const title = await page.locator('h1').first().innerText().catch(() => 'no-h1');
      await page.screenshot({ path: `${OUTDIR}/${route.name}.png`, fullPage: false });
      console.log(`OK: ${route.name} -> ${title}`);
    } catch (err) {
      console.log(`ERRO: ${route.name} - ${err.message}`);
    }
  }

  await browser.close();
})();
