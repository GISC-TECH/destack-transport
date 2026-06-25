import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:8002';
const API_URL = process.env.PLAYWRIGHT_API_URL || 'http://localhost:8001/api';

// ---------- Helpers de documentos ----------
function calcDV(numbers, weights) {
  let sum = 0;
  for (let i = 0; i < weights.length; i++) sum += parseInt(numbers[i], 10) * weights[i];
  const mod = sum % 11;
  return mod < 2 ? 0 : 11 - mod;
}
function generateCNPJ() {
  const base = [...Array.from({ length: 8 }, () => Math.floor(Math.random() * 10)), 0, 0, 0, 1];
  const dv1 = calcDV(base, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const dv2 = calcDV([...base, dv1], [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return [...base, dv1, dv2].join('');
}
function formatCNPJ(cnpj) { return cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5'); }

// ---------- Autenticação ----------
async function login(page, username = 'admin', password = 'admin123') {
  await page.goto(`${BASE_URL}/login`);
  await page.waitForSelector('#username', { timeout: 10000 });
  await page.locator('#username').fill(username);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: /entrar/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 15000 });
}

async function apiGetViaPage(page, endpoint) {
  return page.evaluate(async ({ apiUrl, endpoint }) => {
    const res = await fetch(`${apiUrl}${endpoint}`, {
      credentials: 'include',
      headers: { Accept: 'application/json' }
    });
    if (!res.ok) return { results: [] };
    return res.json();
  }, { apiUrl: API_URL, endpoint });
}

// ---------- Testes ----------
test.describe('CRUD Expandido', () => {
  test.beforeEach(async ({ page }) => await login(page));

  test('deve editar um cliente existente', async ({ page }) => {
    await page.goto(`${BASE_URL}/clientes`);
    await page.waitForTimeout(1500);

    // Clica no primeiro botão de editar
    const editBtn = page.locator('table tbody tr, .cliente-card').first().locator('a[href*="/clientes/editar/"], button').filter({ hasText: /editar/i }).first();
    if (await editBtn.isVisible().catch(() => false)) {
      await editBtn.click();
      await page.waitForSelector('input[name="razao_social"]', { timeout: 10000 });

      const novoNome = `Cliente Editado ${Date.now()}`;
      await page.locator('input[name="razao_social"]').fill(novoNome);
      await page.getByRole('button', { name: /salvar|atualizar/i }).click();

      await page.waitForURL(/\/clientes/, { timeout: 15000 });
      await expect(page.getByText(novoNome).first()).toBeVisible({ timeout: 10000 });
    } else {
      test.skip();
    }
  });

  test('deve criar e excluir um cliente', async ({ page }) => {
    const cnpj = generateCNPJ();
    const nome = `Cliente Excluir ${Date.now()}`;

    await page.goto(`${BASE_URL}/clientes/novo`);
    await page.waitForSelector('input[name="razao_social"]', { timeout: 10000 });
    await page.locator('input[name="razao_social"]').fill(nome);
    await page.locator('input[name="cnpj"]').fill(formatCNPJ(cnpj));
    await page.locator('select[name="estado"]').selectOption('SP');
    await page.locator('form button[type="submit"]').click();

    await page.waitForURL(/\/clientes/, { timeout: 15000 });

    // Busca e exclui
    await page.locator('input[placeholder*="Buscar"]').fill(nome);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1500);

    const row = page.locator('table tbody tr, .cliente-card').filter({ hasText: nome }).first();
    const deleteBtn = row.locator('button').filter({ hasText: /excluir/i }).first();
    if (await deleteBtn.isVisible().catch(() => false)) {
      page.on('dialog', dialog => dialog.accept());
      await deleteBtn.click();
      await page.waitForTimeout(2000);
      await expect(page.locator('table tbody tr, .cliente-card').filter({ hasText: nome })).toHaveCount(0, { timeout: 10000 });
    }
  });

  test('deve criar uma fatura com item manual', async ({ page }) => {
    const clientes = await apiGetViaPage(page, '/clientes/?ativo=true&limit=1');
    const cliente = (clientes.results || clientes || [])[0];
    expect(cliente).toBeTruthy();

    await page.goto(`${BASE_URL}/faturas/nova`);
    await page.waitForSelector('select[name="cliente"]', { timeout: 10000 });

    await page.locator('select[name="cliente"]').selectOption(String(cliente.id));
    await page.locator('input[name="numero"]').fill(`FAT-${Date.now()}`);
    await page.locator('input[name="data_vencimento"]').fill('2030-12-31');

    await page.getByRole('button', { name: /adicionar item/i }).click();
    await page.waitForTimeout(500);

    const descricao = `Serviço de transporte ${Date.now()}`;
    await page.locator('.item-row input[type="text"]').first().fill(descricao);
    await page.locator('.item-row input[type="number"]').first().fill('2500.00');

    await page.locator('form button[type="submit"]').click();

    await page.waitForURL(/\/faturas/, { timeout: 15000 });
  });

  test('deve criar um pagamento agregado', async ({ page }) => {
    const [motoristasRes, veiculosRes] = await Promise.all([
      apiGetViaPage(page, '/motoristas/?ativo=true&limit=1'),
      apiGetViaPage(page, '/veiculos/?ativo=true&limit=1')
    ]);
    const motorista = (motoristasRes.results || motoristasRes || [])[0];
    const veiculo = (veiculosRes.results || veiculosRes || [])[0];
    expect(motorista).toBeTruthy();
    expect(veiculo).toBeTruthy();

    await page.goto(`${BASE_URL}/pagamentos/agregados/novo`);
    await page.waitForSelector('input[placeholder*="placa"]', { timeout: 10000 });

    // Busca e seleciona veículo
    await page.locator('input[placeholder*="placa"]').fill(veiculo.placa.substring(0, 3));
    await page.waitForTimeout(800);
    await page.locator('.veiculo-search-item').first().click();

    // Busca e seleciona condutor
    await page.locator('input[placeholder*="motorista"]').fill(motorista.nome.substring(0, 4));
    await page.waitForTimeout(800);
    await page.locator('.condutor-search-item').first().click();

    await page.locator('input[name="valor_frete_total"]').fill('3000.00');
    await page.locator('input[name="percentual_repasse"]').fill('25');
    await page.locator('input[name="data_prevista"]').fill('2030-12-31');

    await page.locator('button:has-text("Criar Pagamento")').click();

    await page.waitForURL(/\/pagamentos/, { timeout: 15000 });
  });

  test('deve criar uma ordem de viagem', async ({ page }) => {
    const [veiculosRes, motoristasRes, clientesRes] = await Promise.all([
      apiGetViaPage(page, '/veiculos/?ativo=true&limit=1'),
      apiGetViaPage(page, '/motoristas/?ativo=true&limit=1'),
      apiGetViaPage(page, '/clientes/?ativo=true&limit=1')
    ]);
    const veiculo = (veiculosRes.results || veiculosRes || [])[0];
    const motorista = (motoristasRes.results || motoristasRes || [])[0];
    const cliente = (clientesRes.results || clientesRes || [])[0];
    expect(veiculo).toBeTruthy();
    expect(motorista).toBeTruthy();

    await page.goto(`${BASE_URL}/ordens-viagem/nova`);
    await page.waitForSelector('select[name="veiculo"]', { timeout: 10000 });

    await page.locator('select[name="veiculo"]').selectOption(String(veiculo.id));
    if (motorista) await page.locator('select[name="motorista"]').selectOption(String(motorista.id));
    if (cliente) await page.locator('select[name="cliente"]').selectOption(String(cliente.id));
    await page.locator('input[name="origem_cidade"]').fill('São Paulo');
    await page.locator('input[name="origem_uf"]').fill('SP');
    await page.locator('input[name="destino_cidade"]').fill('Rio de Janeiro');
    await page.locator('input[name="destino_uf"]').fill('RJ');

    await page.locator('form button[type="submit"]').click();

    await page.waitForURL(/\/ordens-viagem/, { timeout: 15000 });

    // Busca pela placa para garantir visibilidade
    await page.locator('input[placeholder*="Buscar"]').fill(veiculo.placa);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1500);

    await expect(page.locator('table tbody tr, .ordem-card').filter({ hasText: veiculo.placa }).first()).toBeVisible({ timeout: 10000 });
  });

  test('deve criar um abastecimento', async ({ page }) => {
    const veiculosRes = await apiGetViaPage(page, '/veiculos/?ativo=true&limit=1');
    const veiculo = (veiculosRes.results || veiculosRes || [])[0];
    expect(veiculo).toBeTruthy();

    await page.goto(`${BASE_URL}/abastecimentos/novo`);
    await page.waitForSelector('select[name="veiculo"]', { timeout: 10000 });

    await page.locator('select[name="veiculo"]').selectOption(String(veiculo.id));
    await page.locator('input[name="data"]').fill('2030-06-15');
    await page.locator('input[name="litros"]').fill('100');
    await page.locator('input[name="valor_total"]').fill('600.00');
    await page.locator('input[name="hodometro"]').fill('50000');

    await page.locator('form button[type="submit"]').click();

    await page.waitForURL(/\/abastecimentos/, { timeout: 15000 });
    await expect(page.locator('.toast, [role="alert"]').filter({ hasText: /sucesso/i }).first()).toBeVisible({ timeout: 10000 });
  });

  test('deve criar um pedágio', async ({ page }) => {
    const veiculosRes = await apiGetViaPage(page, '/veiculos/?ativo=true&limit=1');
    const veiculo = (veiculosRes.results || veiculosRes || [])[0];
    expect(veiculo).toBeTruthy();

    await page.goto(`${BASE_URL}/pedagios/novo`);
    await page.waitForSelector('select[name="veiculo"]', { timeout: 10000 });

    await page.locator('select[name="veiculo"]').selectOption(String(veiculo.id));
    await page.locator('input[name="data"]').fill('2030-06-15');
    await page.locator('input[name="praca"]').fill(`Praça Teste ${Date.now()}`);
    await page.locator('input[name="valor"]').fill('15.50');
    await page.locator('input[name="km"]').fill('100');

    await page.locator('form button[type="submit"]').click();

    await page.waitForURL(/\/pedagios/, { timeout: 15000 });
    await expect(page.locator('.toast, [role="alert"]').filter({ hasText: /sucesso/i }).first()).toBeVisible({ timeout: 10000 });
  });

  test('deve criar um plano de manutenção', async ({ page }) => {
    const veiculosRes = await apiGetViaPage(page, '/veiculos/?ativo=true&limit=1');
    const veiculo = (veiculosRes.results || veiculosRes || [])[0];
    expect(veiculo).toBeTruthy();

    await page.goto(`${BASE_URL}/planos-manutencao/novo`);
    await page.waitForSelector('select[name="veiculo"]', { timeout: 10000 });

    await page.locator('select[name="veiculo"]').selectOption(String(veiculo.id));
    await page.locator('input[name="descricao"]').fill(`Plano teste ${Date.now()}`);
    await page.locator('input[name="intervalo_km"]').fill('10000');
    await page.locator('input[name="intervalo_dias"]').fill('180');

    await page.locator('form button[type="submit"]').click();

    await page.waitForURL(/\/planos-manutencao/, { timeout: 15000 });
    await expect(page.locator('.toast, [role="alert"]').filter({ hasText: /sucesso/i }).first()).toBeVisible({ timeout: 10000 });
  });

  test('deve criar uma tabela de frete', async ({ page }) => {
    await page.goto(`${BASE_URL}/tabelas-frete/nova`);
    await page.waitForSelector('input[name="origem_cidade"]', { timeout: 10000 });

    const origem = `São Paulo ${Date.now()}`;
    await page.locator('input[name="origem_uf"]').fill('SP');
    await page.locator('input[name="origem_cidade"]').fill(origem);
    await page.locator('input[name="destino_uf"]').fill('RJ');
    await page.locator('input[name="destino_cidade"]').fill(`Rio de Janeiro ${Date.now()}`);
    await page.locator('input[name="valor_por_km"]').fill('5.50');
    await page.locator('input[name="valor_minimo"]').fill('500.00');
    await page.locator('input[name="vigencia_inicio"]').fill('2030-01-01');

    await page.getByRole('button', { name: /criar tabela/i }).click();

    await page.waitForURL(/\/tabelas-frete/, { timeout: 15000 });
  });
});

test.describe('Validações de formulário', () => {
  test.beforeEach(async ({ page }) => await login(page));

  test('deve bloquear envio de cliente sem CNPJ e razão social', async ({ page }) => {
    await page.goto(`${BASE_URL}/clientes/novo`);
    await page.waitForSelector('input[name="razao_social"]', { timeout: 10000 });

    await page.locator('input[name="razao_social"]').fill('');
    await page.locator('input[name="cnpj"]').fill('');

    const submitBtn = page.getByRole('button', { name: /salvar|cadastrar/i });
    await submitBtn.click();

    // HTML5 required deve impedir submit; permanece na página
    await expect(page).toHaveURL(/\/clientes\/novo/, { timeout: 3000 });
  });
});

test.describe('Upload em lote', () => {
  test.beforeEach(async ({ page }) => await login(page));

  test('deve fazer upload de múltiplos XMLs', async ({ page }) => {
    const xmlContent = (numero) => `<?xml version="1.0" encoding="UTF-8"?>
<cteProc xmlns="http://www.portalfiscal.inf.br/cte" versao="3.00">
  <CTe>
    <infCte Id="CTe3521071234567800019057001000000${numero}1234567890" versao="3.00">
      <ide>
        <cUF>35</cUF><cCT>12345678</cCT><CFOP>5352</CFOP><natOp>Transporte</natOp>
        <mod>57</mod><serie>1</serie><nCT>${numero}</nCT>
        <dhEmi>2021-07-01T10:00:00-03:00</dhEmi>
        <tpImp>1</tpImp><tpEmis>1</tpEmis><cDV>0</cDV><tpAmb>2</tpAmb>
        <tpCTe>0</tpCTe><procEmi>0</procEmi><verProc>1.0</verProc>
        <cMunEnv>3550308</cMunEnv><xMunEnv>Sao Paulo</xMunEnv><UFEnv>SP</UFEnv>
        <modal>01</modal><tpServ>0</tpServ>
        <cMunIni>3550308</cMunIni><xMunIni>Sao Paulo</xMunIni><UFIni>SP</UFIni>
        <cMunFim>3304557</cMunFim><xMunFim>Rio de Janeiro</xMunFim><UFFim>RJ</UFFim>
        <retira>1</retira><toma3><toma>0</toma></toma3>
      </ide>
      <emit><CNPJ>12345678000190</CNPJ><xNome>Emitente QA</xNome>
        <enderEmit><xLgr>Rua A</xLgr><nro>100</nro><xBairro>Centro</xBairro><cMun>3550308</cMun><xMun>Sao Paulo</xMun><UF>SP</UF><CEP>01001000</CEP></enderEmit>
      </emit>
      <rem><CNPJ>12345678000190</CNPJ><xNome>Remetente QA</xNome>
        <enderReme><xLgr>Rua R</xLgr><nro>10</nro><xBairro>Centro</xBairro><cMun>3550308</cMun><xMun>Sao Paulo</xMun><UF>SP</UF><CEP>01001000</CEP></enderReme>
      </rem>
      <dest><CNPJ>98765432000190</CNPJ><xNome>Destinatario QA</xNome>
        <enderDest><xLgr>Rua D</xLgr><nro>20</nro><xBairro>Centro</xBairro><cMun>3304557</cMun><xMun>Rio de Janeiro</xMun><UF>RJ</UF><CEP>20040002</CEP></enderDest>
      </dest>
      <vPrest><vTPrest>1500.00</vTPrest><vRec>1500.00</vRec></vPrest>
      <imp><ICMS><ICMS00><CST>00</CST><vBC>1500.00</vBC><pICMS>12.00</pICMS><vICMS>180.00</vICMS></ICMS00></ICMS></imp>
      <infCTeNorm><infCarga><vCarga>1500.00</vCarga><proPred>Carga Teste</proPred><infQ><cUnid>01</cUnid><tpMed>Peso</tpMed><qCarga>1000.0000</qCarga></infQ></infCarga></infCTeNorm>
    </infCte>
  </CTe>
  <protCTe><infProt><tpAmb>2</tpAmb><verAplic>1.0</verAplic><chCTe>3521071234567800019057001000000${numero}1234567890</chCTe><dhRecbto>2021-07-01T10:05:00-03:00</dhRecbto><nProt>123456789012345</nProt><digVal>ABC123==</digVal><cStat>100</cStat><xMotivo>Autorizado</xMotivo></infProt></protCTe>
</cteProc>`;

    const tmpDir = path.join(process.cwd(), 'e2e', 'tmp');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

    const files = [];
    for (let i = 1; i <= 2; i++) {
      const filePath = path.join(tmpDir, `cte_lote_${i}_${Date.now()}.xml`);
      fs.writeFileSync(filePath, xmlContent(String(100 + i).padStart(3, '0')));
      files.push(filePath);
    }

    await page.goto(`${BASE_URL}/upload`);
    await page.waitForSelector('.upload-dropzone', { timeout: 10000 });
    await page.locator('input[type="file"]').setInputFiles(files);

    await page.waitForTimeout(2000);
    await page.getByRole('button', { name: /enviar em lote/i }).click();

    await page.waitForTimeout(3000);
    const result = page.locator('.results-section, .result-item').first();
    await expect(result).toBeVisible({ timeout: 15000 });

    files.forEach(f => fs.unlinkSync(f));
  });
});

test.describe('Responsividade', () => {
  test('deve exibir navegação inferior em mobile', async ({ page }) => {
    await login(page);
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForTimeout(1000);

    // Em mobile a sidebar é substituída por bottom navigation
    const bottomNav = page.locator('.bottom-nav').first();
    await expect(bottomNav).toBeVisible();

    // Clica no menu de cadastros na bottom nav
    const cadastrosItem = bottomNav.locator('.bottom-nav-item').filter({ hasText: /cadastros/i }).first();
    if (await cadastrosItem.isVisible().catch(() => false)) {
      await cadastrosItem.click();
      await page.waitForTimeout(500);
      await expect(page.locator('.bottom-sheet').first()).toBeVisible();
    }
  });
});
