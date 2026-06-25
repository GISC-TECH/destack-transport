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

async function navigateTo(page, menuLabel, subItemLabel) {
  const menuButton = page.locator('aside.sidebar').getByRole('menuitem', { name: new RegExp(menuLabel, 'i') }).first();
  await menuButton.click();
  if (subItemLabel) {
    await page.locator('aside.sidebar').getByRole('menuitem', { name: subItemLabel, exact: true }).click();
  }
}

async function waitAndScreenshot(page, name) {
  await page.waitForLoadState('networkidle');
  // Pequena espera para renderização de gráficos e listas
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${SCREENSHOT_DIR}/${name}.png`, fullPage: true });
}

test.describe('QA Visual - Telas principais', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('Dashboard', async ({ page }) => {
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
    await expect(page.locator('aside.sidebar').getByRole('menuitem', { name: 'Dashboard' })).toBeVisible({ timeout: 10000 });
    await waitAndScreenshot(page, '01-dashboard');
  });

  test('CT-e', async ({ page }) => {
    await navigateTo(page, 'Documentos', 'CT-e');
    await expect(page).toHaveURL(/\/ctes/, { timeout: 15000 });
    await waitAndScreenshot(page, '02-cte');
  });

  test('MDF-e', async ({ page }) => {
    await navigateTo(page, 'Documentos', 'MDF-e');
    await expect(page).toHaveURL(/\/mdfes/, { timeout: 15000 });
    await waitAndScreenshot(page, '03-mdfe');
  });

  test('Upload XML', async ({ page }) => {
    await navigateTo(page, 'Documentos', 'Upload XML');
    await expect(page).toHaveURL(/\/upload/, { timeout: 15000 });
    await waitAndScreenshot(page, '04-upload');
  });

  test('Clientes', async ({ page }) => {
    await navigateTo(page, 'Cadastros', 'Clientes');
    await expect(page).toHaveURL(/\/clientes/, { timeout: 15000 });
    await waitAndScreenshot(page, '05-clientes');
  });

  test('Motoristas', async ({ page }) => {
    await navigateTo(page, 'Cadastros', 'Motoristas');
    await expect(page).toHaveURL(/\/motoristas/, { timeout: 15000 });
    await waitAndScreenshot(page, '06-motoristas');
  });

  test('Veículos', async ({ page }) => {
    await navigateTo(page, 'Cadastros', 'Veículos');
    await expect(page).toHaveURL(/\/veiculos/, { timeout: 15000 });
    await waitAndScreenshot(page, '07-veiculos');
  });

  test('Painel Financeiro', async ({ page }) => {
    await navigateTo(page, 'Financeiro', 'Painel Financeiro');
    await expect(page).toHaveURL(/\/financeiro$/, { timeout: 15000 });
    await waitAndScreenshot(page, '08-financeiro');
  });

  test('Configurações', async ({ page }) => {
    await navigateTo(page, 'Sistema', 'Configurações');
    await expect(page).toHaveURL(/\/configuracoes/, { timeout: 15000 });
    await waitAndScreenshot(page, '09-configuracoes');
  });
});
