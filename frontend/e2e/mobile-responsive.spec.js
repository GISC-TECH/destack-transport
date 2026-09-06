import { test, expect } from '@playwright/test';

async function login(page) {
  await page.goto('/login');
  await page.locator('#username').fill('admin');
  await page.locator('#password').fill('admin123');
  await page.getByRole('button', { name: /entrar/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 15000 });
}

async function expectNoHorizontalOverflow(page) {
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
  }));
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport);
}

test('login permite exibir e ocultar a senha', async ({ page }) => {
  await page.goto('/login');
  const password = page.locator('#password');
  await password.fill('admin123');

  const toggle = page.getByRole('button', { name: /mostrar senha/i });
  await expect(toggle).toBeVisible();
  await toggle.click();
  await expect(password).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: /ocultar senha/i }).click();
  await expect(password).toHaveAttribute('type', 'password');
});

test('dashboard exibe navegacao inferior sem estouro horizontal', async ({ page }) => {
  await login(page);
  await expect(page.getByRole('navigation', { name: 'Navegacao inferior' })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test('backup cabe na tela e oferece alvos de toque adequados', async ({ page }) => {
  await login(page);
  await page.goto('/backup');
  await expect(page.getByRole('heading', { name: 'Gerenciamento de Backup' })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  const actions = page.getByRole('button', { name: /Gerar Novo Backup/i })
    .or(page.getByText('Conferir Arquivo SQL', { exact: true }))
    .or(page.getByRole('link', { name: /Baixar|Indisponivel/i }));
  const count = await actions.count();
  expect(count).toBeGreaterThan(0);
  for (let index = 0; index < count; index += 1) {
    const box = await actions.nth(index).boundingBox();
    expect(box?.height || 0).toBeGreaterThanOrEqual(44);
  }
});
