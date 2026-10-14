const { chromium } = require('playwright');

const BASE = 'https://localhost:8443';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('response', async res => {
    if (res.url().includes('/api/perfis/')) {
      const body = await res.text().catch(() => '');
      console.log('RESPONSE:', res.status(), res.url(), body.slice(0, 200));
    }
  });

  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.locator('input[type="text"]').first().fill('admin');
  await page.locator('input[type="password"]').first().fill('admin123');
  await page.locator('button[type="submit"]').first().click();
  await page.waitForURL(`${BASE}/dashboard`, { timeout: 10000 });

  await page.goto(`${BASE}/perfis`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);

  const editButtons = await page.locator('button:has-text("Editar")').all();
  if (editButtons.length > 0) {
    await editButtons[0].click();
    await page.waitForTimeout(1000);
    const checkedBoxes = await page.locator('input[type="checkbox"]:checked').all();
    if (checkedBoxes.length > 0) {
      await checkedBoxes[0].click();
      await page.waitForTimeout(300);
    }
    const saveBtn = await page.locator('button:has-text("Salvar")').first();
    await saveBtn.click();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: '/tmp/perfis_after_save.png' });
  }

  await browser.close();
})();
