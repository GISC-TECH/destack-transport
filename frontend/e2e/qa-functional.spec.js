import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:8002';

// ---------- Geradores de documentos válidos ----------
function calcDV(numbers, weights) {
  let sum = 0;
  for (let i = 0; i < weights.length; i++) {
    sum += parseInt(numbers[i], 10) * weights[i];
  }
  const mod = sum % 11;
  return mod < 2 ? 0 : 11 - mod;
}

function generateCNPJ() {
  const base = Array.from({ length: 8 }, () => Math.floor(Math.random() * 10));
  base.push(0, 0, 0, 1);
  const dv1 = calcDV(base, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const withDv1 = [...base, dv1];
  const dv2 = calcDV(withDv1, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return [...base, dv1, dv2].join('');
}

function generateCPF() {
  const base = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10));
  const dv1 = calcDV(base, [10, 9, 8, 7, 6, 5, 4, 3, 2]);
  const withDv1 = [...base, dv1];
  const dv2 = calcDV(withDv1, [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
  return [...base, dv1, dv2].join('');
}

function formatCNPJ(cnpj) {
  return cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
}

function formatCPF(cpf) {
  return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

// ---------- Helpers ----------
async function login(page, username = 'admin', password = 'admin123') {
  await page.goto(`${BASE_URL}/login`);
  await page.waitForSelector('#username', { timeout: 10000 });
  await page.locator('#username').fill(username);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: /entrar/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 15000 });
}

// ---------- Testes ----------
test.describe('Autenticação', () => {
  test('deve redirecionar usuário não autenticado para login', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForURL(/\/login/, { timeout: 10000 });
    await expect(page.locator('#username')).toBeVisible();
  });

  test('deve mostrar erro com credenciais inválidas', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.locator('#username').fill('admin');
    await page.locator('#password').fill('senhaerrada');
    await page.getByRole('button', { name: /entrar/i }).click();
    await expect(page.locator('text=/usuário ou senha incorretos|credenciais|inválidas/i')).toBeVisible({ timeout: 10000 });
  });

  test('deve fazer login e logout com sucesso', async ({ page }) => {
    await login(page);
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();

    // Abre menu do usuário e clica em Sair
    const logoutBtn = page.locator('aside.sidebar').getByRole('button', { name: /sair/i });
    await logoutBtn.scrollIntoViewIfNeeded();
    await logoutBtn.click();
    await page.waitForURL(/\/login/, { timeout: 10000 });
    await expect(page.locator('#username')).toBeVisible();
  });
});

test.describe('CRUD - Clientes', () => {
  test.beforeEach(async ({ page }) => await login(page));

  test('deve criar um novo cliente', async ({ page }) => {
    const cnpj = generateCNPJ();
    const nome = `Cliente Teste ${Date.now()}`;

    await page.goto(`${BASE_URL}/clientes/novo`);
    await page.waitForSelector('input[name="razao_social"]', { timeout: 10000 });

    await page.locator('input[name="razao_social"]').fill(nome);
    await page.locator('input[name="cnpj"]').fill(formatCNPJ(cnpj));
    await page.locator('input[name="email"]').fill(`teste${Date.now()}@exemplo.com`);
    await page.locator('input[name="telefone"]').fill('11999999999');
    await page.locator('input[name="cidade"]').fill('São Paulo');
    await page.locator('select[name="estado"]').selectOption('SP');

    await page.getByRole('button', { name: /salvar|cadastrar/i }).click();

    await page.waitForURL(/\/clientes/, { timeout: 15000 });

    // Filtra pelo nome recém-criado para garantir visibilidade independente da paginação
    await page.locator('input[placeholder*="Buscar"]').fill(nome);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1500);

    const rows = page.locator('table tbody tr, .cliente-card');
    await expect(rows.filter({ hasText: nome }).first()).toBeVisible({ timeout: 10000 });
  });
});

test.describe('CRUD - Motoristas', () => {
  test.beforeEach(async ({ page }) => await login(page));

  test('deve criar um novo motorista', async ({ page }) => {
    const cpf = generateCPF();
    const nome = `Motorista Teste ${Date.now()}`;

    await page.goto(`${BASE_URL}/motoristas/novo`);
    await page.waitForSelector('input[name="nome"]', { timeout: 10000 });

    await page.locator('input[name="nome"]').fill(nome);
    await page.locator('input[name="cpf"]').fill(formatCPF(cpf));
    await page.locator('input[name="cnh"]').fill(String(Math.floor(10000000000 + Math.random() * 89999999999)));
    await page.locator('input[name="telefone"]').fill('11988888888');

    await page.getByRole('button', { name: /salvar|cadastrar/i }).click();

    await page.waitForURL(/\/motoristas/, { timeout: 15000 });

    // Busca pelo nome recém-criado para garantir visibilidade
    await page.locator('input[placeholder*="Buscar"]').fill(nome);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1500);

    await expect(page.getByText(nome).first()).toBeVisible({ timeout: 10000 });
  });
});

test.describe('CRUD - Veículos', () => {
  test.beforeEach(async ({ page }) => await login(page));

  test('deve criar um novo veículo', async ({ page }) => {
    const placa = `AAA${Math.floor(1000 + Math.random() * 8999)}`;

    await page.goto(`${BASE_URL}/veiculos/novo`);
    await page.waitForSelector('input[name="placa"]', { timeout: 10000 });

    await page.locator('input[name="placa"]').fill(placa);
    await page.locator('input[name="renavam"]').fill('123456789');
    await page.locator('input[name="tipo_rodado"]').fill('01');
    await page.locator('input[name="tipo_carroceria"]').fill('00');
    await page.locator('input[name="tara"]').fill('5000');
    await page.locator('input[name="capacidade_kg"]').fill('20000');
    await page.locator('input[name="capacidade_m3"]').fill('50');

    await page.getByRole('button', { name: /salvar|cadastrar/i }).click();

    await page.waitForURL(/\/veiculos/, { timeout: 15000 });

    // Busca pela placa recém-criada para garantir visibilidade
    await page.locator('input[placeholder*="Buscar"]').fill(placa);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1500);

    await expect(page.getByRole('cell', { name: placa, exact: true })).toBeVisible({ timeout: 10000 });
  });
});

test.describe('CRUD - Contas a Pagar', () => {
  test.beforeEach(async ({ page }) => await login(page));

  test('deve criar uma nova conta a pagar', async ({ page }) => {
    const descricao = `Conta Teste ${Date.now()}`;

    await page.goto(`${BASE_URL}/financeiro/contas-a-pagar/nova`);
    await page.waitForSelector('input[name="descricao"]', { timeout: 10000 });

    await page.locator('input[name="descricao"]').fill(descricao);
    await page.locator('input[name="valor"]').fill('1500.00');
    await page.locator('input[name="data_vencimento"]').fill('2030-12-31');
    await page.locator('select[name="status"]').selectOption('pendente');

    await page.getByRole('button', { name: /salvar|criar|cadastrar/i }).click();

    await page.waitForURL(/\/financeiro\/contas-a-pagar/, { timeout: 15000 });
    await expect(page.locator('text=' + descricao)).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Upload de XML', () => {
  test.beforeEach(async ({ page }) => await login(page));

  test('deve fazer upload de um XML de CT-e', async ({ page }) => {
    const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<cteProc xmlns="http://www.portalfiscal.inf.br/cte" versao="3.00">
  <CTe>
    <infCte Id="CTe35210712345678000190570010000001231234567890" versao="3.00">
      <ide>
        <cUF>35</cUF>
        <cCT>12345678</cCT>
        <CFOP>5352</CFOP>
        <natOp>Transporte de Cargas</natOp>
        <mod>57</mod>
        <serie>1</serie>
        <nCT>123</nCT>
        <dhEmi>2021-07-01T10:00:00-03:00</dhEmi>
        <tpImp>1</tpImp>
        <tpEmis>1</tpEmis>
        <cDV>0</cDV>
        <tpAmb>2</tpAmb>
        <tpCTe>0</tpCTe>
        <procEmi>0</procEmi>
        <verProc>1.0</verProc>
        <cMunEnv>3550308</cMunEnv>
        <xMunEnv>Sao Paulo</xMunEnv>
        <UFEnv>SP</UFEnv>
        <modal>01</modal>
        <tpServ>0</tpServ>
        <cMunIni>3550308</cMunIni>
        <xMunIni>Sao Paulo</xMunIni>
        <UFIni>SP</UFIni>
        <cMunFim>3304557</cMunFim>
        <xMunFim>Rio de Janeiro</xMunFim>
        <UFFim>RJ</UFFim>
        <retira>1</retira>
        <toma3>
          <toma>0</toma>
        </toma3>
      </ide>
      <compl>
        <xCaracAd>TESTE</xCaracAd>
      </compl>
      <emit>
        <CNPJ>12345678000190</CNPJ>
        <xNome>Emitente Teste QA</xNome>
        <xFant>Emitente QA</xFant>
        <enderEmit>
          <xLgr>Rua Teste</xLgr>
          <nro>100</nro>
          <xBairro>Centro</xBairro>
          <cMun>3550308</cMun>
          <xMun>Sao Paulo</xMun>
          <UF>SP</UF>
          <CEP>01001000</CEP>
        </enderEmit>
      </emit>
      <rem>
        <CNPJ>12345678000190</CNPJ>
        <xNome>Remetente Teste QA</xNome>
        <enderReme>
          <xLgr>Rua Remetente</xLgr>
          <nro>10</nro>
          <xBairro>Centro</xBairro>
          <cMun>3550308</cMun>
          <xMun>Sao Paulo</xMun>
          <UF>SP</UF>
          <CEP>01001000</CEP>
        </enderReme>
      </rem>
      <dest>
        <CNPJ>98765432000190</CNPJ>
        <xNome>Destinatario Teste QA</xNome>
        <enderDest>
          <xLgr>Rua Destino</xLgr>
          <nro>20</nro>
          <xBairro>Centro</xBairro>
          <cMun>3304557</cMun>
          <xMun>Rio de Janeiro</xMun>
          <UF>RJ</UF>
          <CEP>20040002</CEP>
        </enderDest>
      </dest>
      <vPrest>
        <vTPrest>1500.00</vTPrest>
        <vRec>1500.00</vRec>
      </vPrest>
      <imp>
        <ICMS>
          <ICMS00>
            <CST>00</CST>
            <vBC>1500.00</vBC>
            <pICMS>12.00</pICMS>
            <vICMS>180.00</vICMS>
          </ICMS00>
        </ICMS>
      </imp>
      <infCTeNorm>
        <infCarga>
          <vCarga>1500.00</vCarga>
          <proPred>Carga Teste</proPred>
          <infQ>
            <cUnid>01</cUnid>
            <tpMed>Peso</tpMed>
            <qCarga>1000.0000</qCarga>
          </infQ>
        </infCarga>
      </infCTeNorm>
    </infCte>
  </CTe>
  <protCTe>
    <infProt>
      <tpAmb>2</tpAmb>
      <verAplic>1.0</verAplic>
      <chCTe>35210712345678000190570010000001231234567890</chCTe>
      <dhRecbto>2021-07-01T10:05:00-03:00</dhRecbto>
      <nProt>123456789012345</nProt>
      <digVal>ABC123==</digVal>
      <cStat>100</cStat>
      <xMotivo>Autorizado o uso do CT-e</xMotivo>
    </infProt>
  </protCTe>
</cteProc>`;

    const tmpDir = path.join(process.cwd(), 'e2e', 'tmp');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    const filePath = path.join(tmpDir, `cte_test_${Date.now()}.xml`);
    fs.writeFileSync(filePath, xmlContent);

    await page.goto(`${BASE_URL}/upload`);
    await page.waitForSelector('.upload-dropzone', { timeout: 10000 });

    await page.locator('input[type="file"]').setInputFiles(filePath);

    // Aguarda processamento (pode haver toast ou mudança de status)
    await page.waitForTimeout(3000);

    const successToast = page.locator('.toast, [role="alert"]').filter({ hasText: /sucesso|processado|enviado/i }).first();
    const cteCard = page.locator('text=/CT-e|123|processado/i').first();

    await expect(successToast.or(cteCard)).toBeVisible({ timeout: 15000 });

    fs.unlinkSync(filePath);
  });
});
