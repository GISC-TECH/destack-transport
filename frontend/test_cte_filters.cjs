const { chromium } = require('playwright');

const BASE = 'https://localhost:8443';

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.locator('input[type="text"]').first().fill('admin');
  await page.locator('input[type="password"]').first().fill('admin123');
  await page.locator('button[type="submit"]').first().click();
  await page.waitForURL(`${BASE}/dashboard`, { timeout: 10000 });
}

async function screenshot(page, name, viewport) {
  await page.setViewportSize(viewport);
  await page.goto(`${BASE}/ctes`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `/tmp/${name}.png`, fullPage: false });
  console.log(`Screenshot salvo: /tmp/${name}.png (${viewport.width}x${viewport.height})`);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  await login(page);

  await screenshot(page, 'cte_desktop', { width: 1280, height: 800 });
  await screenshot(page, 'cte_tablet', { width: 768, height: 1024 });
  await screenshot(page, 'cte_mobile', { width: 390, height: 844 });

  await browser.close();
})();
