import { test, expect, request as playwrightRequest } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import os from 'os';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:8002';
const LIDIANE_E2E_USERNAME = process.env.LIDIANE_E2E_USERNAME;
const LIDIANE_E2E_PASSWORD = process.env.LIDIANE_E2E_PASSWORD;

function getLidianeCredentials() {
  if (!LIDIANE_E2E_USERNAME || !LIDIANE_E2E_PASSWORD) {
    throw new Error(
      'Defina LIDIANE_E2E_USERNAME e LIDIANE_E2E_PASSWORD para executar este cenário E2E.',
    );
  }

  return {
    username: LIDIANE_E2E_USERNAME,
    password: LIDIANE_E2E_PASSWORD,
  };
}

// ---------- Helpers ----------
async function login(page, username, password) {
  // Login via API para evitar race condition de CSRF/permissões na UI
  const requestContext = await playwrightRequest.newContext({ baseURL: BASE_URL });

  // 1. Obter CSRF token
  const csrfResp = await requestContext.get('/api/auth/csrf/');
  const csrfCookies = await csrfResp.headers()['set-cookie'] || '';
  const csrfMatch = csrfCookies.match(/cte_mdfe_csrftoken=([^;]+)/);
  const csrfToken = csrfMatch ? decodeURIComponent(csrfMatch[1]) : '';

  // 2. Fazer login
  const loginResp = await requestContext.post('/api/auth/login/', {
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': csrfToken,
    },
    data: JSON.stringify({ username, password }),
  });
  if (!loginResp.ok()) {
    throw new Error(`Falha no login de ${username}: ${loginResp.status()} ${await loginResp.text()}`);
  }

  // 3. Copiar todos os cookies para a page
  const cookies = await requestContext.storageState();
  await page.context().addCookies(cookies.cookies);
  await requestContext.dispose();

  // 4. Navegar para dashboard para inicializar o AuthContext com sessão válida
  await page.goto(`${BASE_URL}/dashboard`);
  await page.waitForURL(/\/dashboard/, { timeout: 15000 });
}

async function createTempPdf(filename = 'teste-documento.pdf') {
  const tmpDir = os.tmpdir();
  const filePath = path.join(tmpDir, filename);
  // PDF mínimo válido
  const pdfContent = `%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n>>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \ntrailer\n<<\n/Size 4\n/Root 1 0 R\n>>\nstartxref\n196\n%%EOF\n`;
  fs.writeFileSync(filePath, pdfContent);
  return filePath;
}

function calcDV(numbers, weights) {
  let sum = 0;
  for (let i = 0; i < weights.length; i++) {
    sum += parseInt(numbers[i], 10) * weights[i];
  }
  const mod = sum % 11;
  return mod < 2 ? 0 : 11 - mod;
}

function generateCPF() {
  const base = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10));
  const dv1 = calcDV(base, [10, 9, 8, 7, 6, 5, 4, 3, 2]);
  const withDv1 = [...base, dv1];
  const dv2 = calcDV(withDv1, [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
  return [...base, dv1, dv2].join('');
}

async function dismissUnexpectedPopups(page) {
  page.on('dialog', async dialog => {
    await dialog.accept();
  });
}

// Cria um pagamento agregado pendente via API (admin) e retorna o nome do condutor
async function createPagamentoPendente() {
  const requestContext = await playwrightRequest.newContext({ baseURL: BASE_URL });
  try {
    // CSRF + login admin
    const csrfResp = await requestContext.get('/api/auth/csrf/');
    const csrfCookies = await csrfResp.headers()['set-cookie'] || '';
    const csrfMatch = csrfCookies.match(/cte_mdfe_csrftoken=([^;]+)/);
    const csrfToken = csrfMatch ? decodeURIComponent(csrfMatch[1]) : '';

    const loginResp = await requestContext.post('/api/auth/login/', {
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken },
      data: JSON.stringify({ username: 'admin', password: 'admin123' }),
    });
    if (!loginResp.ok()) throw new Error('Falha no login admin para criar pagamento');

    // Recarrega CSRF token após login (Django pode rotacionar)
    const csrfResp2 = await requestContext.get('/api/auth/csrf/');
    const csrfCookies2 = await csrfResp2.headers()['set-cookie'] || '';
    const csrfMatch2 = csrfCookies2.match(/cte_mdfe_csrftoken=([^;]+)/);
    const csrfToken2 = csrfMatch2 ? decodeURIComponent(csrfMatch2[1]) : csrfToken;

    // Busca CT-e que ainda não tenha pagamento agregado
    const [ctesResp, pagtosResp] = await Promise.all([
      requestContext.get('/api/ctes/'),
      requestContext.get('/api/pagamentos/agregados/'),
    ]);
    const ctesData = await ctesResp.json();
    const pagtosData = await pagtosResp.json();
    const ctesComPagamento = new Set((pagtosData.results || pagtosData || []).map(p => p.cte_id));
    let cteId = null;
    for (const cte of (ctesData.results || ctesData || [])) {
      if (!ctesComPagamento.has(cte.id)) {
        cteId = cte.id;
        break;
      }
    }
    if (!cteId) throw new Error('Nenhum CT-e disponível sem pagamento agregado');

    const uniqueSuffix = Date.now();
    const dataPrevista = getLocalDateString();
    const condutorNome = `TESTE E2E Luanna ${uniqueSuffix}`;

    const createResp = await requestContext.post('/api/pagamentos/agregados/', {
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': csrfToken2,
      },
      data: JSON.stringify({
        cte: cteId,
        placa: 'ABC1234',
        condutor_cpf: generateCPF(),
        condutor_nome: condutorNome,
        valor_frete_total: '1000.00',
        percentual_repasse: '25.00',
        desconto: '0.00',
        data_prevista: dataPrevista,
        status: 'pendente',
      }),
    });
    if (!createResp.ok()) {
      throw new Error(`Erro ao criar pagamento: ${createResp.status()} ${await createResp.text()}`);
    }
    return condutorNome;
  } finally {
    await requestContext.dispose();
  }
}

// ---------- 1. Aba Sistema + criação de usuários (Lidiane) ----------
test.describe('Aba Sistema - Lidiane', () => {
  test('deve exibir menu Sistema, submenu Usuários e botão Novo Usuário', async ({ page }) => {
    test.skip(
      !LIDIANE_E2E_USERNAME || !LIDIANE_E2E_PASSWORD,
      'Credenciais E2E da Lidiane nao configuradas.',
    );
    await dismissUnexpectedPopups(page);
    const credentials = getLidianeCredentials();
    await login(page, credentials.username, credentials.password);

    // Verifica se chegou ao dashboard
    await expect(page.locator('text=/dashboard/i').first()).toBeVisible({ timeout: 10000 });

    // Aguarda o AuthContext carregar permissões e re-renderizar o menu
    await page.waitForTimeout(2000);

    // Usa seletor mais robusto para a sidebar (CSS Modules não mantêm nome literal)
    const sidebar = page.locator('aside[aria-label="Menu principal"]');
    await expect(sidebar).toBeVisible({ timeout: 10000 });

    // Se o menu Sistema não estiver visível, rola a sidebar para garantir
    const sistemaMenu = sidebar.getByRole('menuitem', { name: 'Sistema' });
    try {
      await expect(sistemaMenu).toBeVisible({ timeout: 5000 });
    } catch {
      // Tenta rolar a nav da sidebar até o final
      await sidebar.locator('nav').evaluate(el => el.scrollTop = el.scrollHeight);
      await expect(sistemaMenu).toBeVisible({ timeout: 5000 });
    }

    // Clica em Sistema para abrir submenu
    await sistemaMenu.click();

    // Usuários deve aparecer
    const usuariosLink = sidebar.getByRole('menuitem', { name: 'Usuários' });
    await expect(usuariosLink).toBeVisible({ timeout: 10000 });

    // Navega para usuários
    await usuariosLink.click();
    await page.waitForURL(/\/usuarios/, { timeout: 15000 });

    // Título da página
    await expect(page.getByRole('heading', { name: /Gerenciamento de Usuários/i })).toBeVisible({ timeout: 10000 });

    // Botão Novo Usuário deve estar visível
    await expect(page.getByRole('button', { name: /Novo Usuário/i })).toBeVisible({ timeout: 10000 });
  });
});

// ---------- 2. Bug da data de anexos ----------
test.describe('Data de anexos - motorista', () => {
  test('deve salvar e editar a data de validade sem deslocamento', async ({ page }) => {
    await dismissUnexpectedPopups(page);
    await login(page, 'admin', 'admin123');

    // Cria motorista temporário para não poluir dados reais
    const uniqueSuffix = Date.now();
    await page.goto(`${BASE_URL}/motoristas/novo`);
    await page.waitForSelector('input#nome', { timeout: 10000 });
    await page.locator('input#nome').fill(`Teste Data Anexo ${uniqueSuffix}`);
    await page.locator('input#cpf').fill('529.982.247-25');
    await page.locator('input#cnh').fill(`123456789${String(uniqueSuffix).slice(-1)}`);
    await page.locator('select#categoria_cnh').selectOption('E');
    await page.getByRole('button', { name: /cadastrar|salvar/i }).click();
    await page.waitForURL(/\/motoristas/, { timeout: 15000 });

    // Busca o motorista criado via query string (filtro 'q')
    const searchTerm = `Teste Data Anexo ${uniqueSuffix}`;
    await page.goto(`${BASE_URL}/motoristas?q=${encodeURIComponent(searchTerm)}`);
    await page.waitForSelector('table tbody tr', { timeout: 15000 });

    // Clica em editar
    const editButton = page.locator('table tbody tr:first-child button[aria-label^="Editar"], table tbody tr:first-child button[title="Editar"]').first();
    await expect(editButton).toBeVisible({ timeout: 10000 });
    await editButton.click();
    await page.waitForURL(/\/motoristas\/editar\/\d+/, { timeout: 15000 });

    // Aguarda componente de documentos
    await page.waitForSelector('text=/Documentos Anexos/i', { timeout: 10000 });

    // Clica em Novo Documento
    await page.getByRole('button', { name: /\+ Novo Documento/i }).click();

    // Preenche dados
    await page.locator('select#upload_tipo').selectOption('outro');
    await page.locator('input#upload_nome').fill(`Doc Teste ${uniqueSuffix}`);
    await page.locator('input#upload_validade').fill('2026-12-25');

    // Seleciona arquivo
    const pdfPath = await createTempPdf(`teste-${uniqueSuffix}.pdf`);
    await page.locator('input#upload_arquivo').setInputFiles(pdfPath);

    // Envia
    await page.getByRole('button', { name: /Enviar Documento/i }).click();

    // Aguarda aparecer na lista
    await expect(page.locator('text=Doc Teste').first()).toBeVisible({ timeout: 15000 });

    // Verifica data exibida
    const validadeCell = page.locator('td[data-label="Validade"]').first();
    await expect(validadeCell).toContainText('25/12/2026', { timeout: 10000 });

    // Edita a data
    await page.locator('button[aria-label="Editar"]').first().click();
    await page.waitForSelector('input#edit_validade', { timeout: 10000 });
    await page.locator('input#edit_validade').fill('2027-01-10');
    await page.getByRole('button', { name: /Salvar/i }).click();

    // Aguarda modal fechar e recarregar
    await page.waitForSelector('input#edit_validade', { state: 'hidden', timeout: 10000 });
    await page.waitForTimeout(1000);

    // Verifica nova data
    await expect(page.locator('td[data-label="Validade"]').first()).toContainText('10/01/2027', { timeout: 10000 });

    // Limpa arquivo temporário
    try { fs.unlinkSync(pdfPath); } catch { /* Limpeza best-effort do arquivo temporário. */ }
  });
});

// ---------- 3. LUANNAVICTORIA inserindo comprovantes ----------
test.describe('LUANNAVICTORIA - comprovante de pagamento', () => {
  test('deve conseguir baixar pagamento com comprovante', async ({ page }) => {
    await dismissUnexpectedPopups(page);

    // Cria pagamento pendente como admin via API
    const condutorNome = await createPagamentoPendente();

    // Senha temporária definida externamente pelo shell Django
    const tempPassword = process.env.LUANNA_TEMP_PASSWORD || 'Temp@123456';
    await login(page, 'LUANNAVICTORIA', tempPassword);

    // Vai para pagamentos
    await page.goto(`${BASE_URL}/pagamentos`);
    await page.waitForURL(/\/pagamentos/, { timeout: 15000 });

    // Aguarda carregar (empty state ou tabela)
    await page.waitForSelector(`text=/Nenhum pagamento encontrado|${condutorNome}/`, { timeout: 15000 });

    // Procura a linha do pagamento de teste e clica em Baixar
    const linhaTeste = page.locator('tr', { hasText: condutorNome }).first();
    await expect(linhaTeste).toBeVisible({ timeout: 10000 });
    const baixarBtn = linhaTeste.locator('button[aria-label="Baixar pagamento"], button[title="Baixar Pagamento"]').first();
    await expect(baixarBtn).toBeVisible({ timeout: 10000 });
    await baixarBtn.click();

    // Modal de baixa
    await page.waitForSelector('text=/Baixar Pagamento/i', { timeout: 10000 });

    // Seleciona data
    await page.locator('input#data_baixa').fill(getLocalDateString());

    // Anexa comprovante
    const uniqueSuffix = Date.now();
    const pdfPath = await createTempPdf(`comprovante-${uniqueSuffix}.pdf`);
    await page.locator('input#comprovante_baixa').setInputFiles(pdfPath);

    // Confirma baixa
    await page.getByRole('button', { name: /Confirmar Baixa/i }).click();

    // Aguarda sucesso
    await expect(page.locator('text=/Pagamento baixado com sucesso/i')).toBeVisible({ timeout: 15000 });

    // Limpa arquivo temporário
    try { fs.unlinkSync(pdfPath); } catch { /* Limpeza best-effort do arquivo temporário. */ }
  });
});

function getLocalDateString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
