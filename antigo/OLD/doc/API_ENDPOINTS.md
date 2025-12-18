# 📋 CATÁLOGO COMPLETO DE ENDPOINTS DA API - Sistema de Transporte

**Última atualização:** 26/11/2024
**Versão:** 2.0 - Incluindo Clientes, Motoristas e Compartimentação

## 🔐 Autenticação

**Base URL da API:** `/api/`
**Autenticação:** Todos os endpoints da API requerem autenticação (exceto login/logout)

---

## 1️⃣ AUTENTICAÇÃO E USUÁRIOS

### 1.1 Autenticação Simples
- **POST** `/login/` - Login de usuário
- **GET** `/logout/` - Logout de usuário

### 1.2 Gestão de Usuários
**Base:** `/api/usuarios/`

- **GET** `/api/usuarios/` - Listar usuários (somente admin)
- **GET** `/api/usuarios/{id}/` - Detalhes de um usuário (somente admin)
- **POST** `/api/usuarios/` - Criar novo usuário (somente admin)
- **PUT/PATCH** `/api/usuarios/{id}/` - Atualizar usuário (somente admin)
- **DELETE** `/api/usuarios/{id}/` - Deletar usuário (somente admin)
- **GET** `/api/usuarios/me/` - Obter dados do usuário autenticado
- **PUT/PATCH** `/api/usuarios/me/` - Atualizar perfil do usuário autenticado

### 1.3 API de Usuário Atual
- **GET** `/api/users/me/` - Dados do usuário autenticado
- **PATCH** `/api/users/me/` - Atualizar dados do usuário autenticado

---

## 2️⃣ CT-E (CONHECIMENTO DE TRANSPORTE ELETRÔNICO)

**Base:** `/api/ctes/`

### 2.1 CRUD Básico
- **GET** `/api/ctes/` - Listar CT-es (somente leitura)
- **GET** `/api/ctes/{id}/` - Detalhes de um CT-e

### 2.2 Filtros Disponíveis
Query parameters aceitos no GET `/api/ctes/`:
- `data_inicio` - Data inicial (YYYY-MM-DD)
- `data_fim` - Data final (YYYY-MM-DD)
- `modalidade` - CIF ou FOB
- `emitente_cnpj` - CNPJ do emitente
- `remetente_cnpj` - CNPJ do remetente
- `destinatario_cnpj` - CNPJ do destinatário
- `uf_ini` - UF de início
- `uf_fim` - UF de fim
- `placa` - Placa do veículo
- `processado` - true/false
- `autorizado` - true/false
- `cancelado` - true/false
- `q` - Busca geral (chave, número, razão social)
- `ordering` - Ordenação

### 2.3 Actions Especiais
- **GET** `/api/ctes/export/` - Exportar CT-es para CSV
- **GET** `/api/ctes/{id}/xml/` - Download do XML do CT-e
- **GET** `/api/ctes/{id}/dacte/` - Gerar DACTE (PDF) do CT-e
  - Query param: `download=inline|attachment`
- **POST** `/api/ctes/{id}/reprocessar/` - Reprocessar XML do CT-e
- **GET** `/api/ctes/estatisticas/` - Estatísticas gerais dos CT-es

### 2.4 Painel CT-e
- **GET** `/api/painel/cte/` - Dados do painel de CT-e
  - Query params: `data_inicio`, `data_fim`

---

## 3️⃣ MDF-E (MANIFESTO DE DOCUMENTOS FISCAIS ELETRÔNICO)

**Base:** `/api/mdfes/`

### 3.1 CRUD Básico
- **GET** `/api/mdfes/` - Listar MDF-es (somente leitura)
- **GET** `/api/mdfes/{id}/` - Detalhes de um MDF-e

### 3.2 Filtros Disponíveis
Query parameters aceitos no GET `/api/mdfes/`:
- `data_inicio` - Data inicial (YYYY-MM-DD)
- `data_fim` - Data final (YYYY-MM-DD)
- `emitente_cnpj` - CNPJ do emitente
- `uf_ini` - UF de início
- `uf_fim` - UF de fim
- `placa` - Placa do veículo (tração ou reboque)
- `processado` - true/false
- `autorizado` - true/false
- `cancelado` - true/false
- `encerrado` - true/false
- `q` - Busca geral (chave, número, placa)

### 3.3 Actions Especiais
- **GET** `/api/mdfes/export/` - Exportar MDF-es para CSV
- **GET** `/api/mdfes/{id}/xml/` - Download do XML do MDF-e
- **GET** `/api/mdfes/{id}/damdfe/` - Gerar DAMDFE (PDF) do MDF-e
  - Query param: `download=inline|attachment`
- **POST** `/api/mdfes/{id}/reprocessar/` - Reprocessar XML do MDF-e
- **GET** `/api/mdfes/{id}/documentos/` - Listar documentos vinculados ao MDF-e

### 3.4 Painel MDF-e
- **GET** `/api/painel/mdfe/` - Dados do painel de MDF-e
  - Query params: `data_inicio`, `data_fim`

---

## 4️⃣ UPLOAD DE XMLS

**Base:** `/api/upload/`

### 4.1 Upload Individual
- **POST** `/api/upload/` - Upload de arquivo XML individual
  - **Body (multipart/form-data):**
    - `arquivo_xml` - Arquivo XML principal (obrigatório)
    - `arquivo_xml_retorno` - Arquivo XML de retorno (opcional)

### 4.2 Upload em Lote
- **POST** `/api/upload/batch_upload/` - Upload de múltiplos XMLs
  - **Body (multipart/form-data):**
    - `arquivos_xml` - Lista de arquivos XML

**Tipos de XML suportados:**
- CT-e (procCTe, CTe)
- MDF-e (procMDFe, MDFe)
- Eventos de CT-e (eventoCTe, procEventoCTe, retEventoCTe)
- Eventos de MDF-e (eventoMDFe, procEventoMDFe, retEventoMDFe)
- Cancelamentos (tpEvento 110111 para CT-e, 110111 para MDF-e)
- Encerramentos (tpEvento 110112 para MDF-e)

**Resposta do Upload em Lote:**
```json
{
  "message": "Processamento em lote concluído.",
  "sucesso": 10,
  "erros": 2,
  "ignorados": 1,
  "resultados_detalhados": [
    {
      "arquivo_principal_nome": "cte_12345.xml",
      "chave": "12345678901234567890123456789012345678901234",
      "status": "sucesso",
      "message": "CT-e processado.",
      "id": "uuid-here"
    }
  ]
}
```

---

## 5️⃣ CLIENTES ✨ NOVO

**Base:** `/api/clientes/`

### 5.1 CRUD Completo
- **GET** `/api/clientes/` - Listar clientes
- **GET** `/api/clientes/{id}/` - Detalhes de um cliente
- **POST** `/api/clientes/` - Criar novo cliente
- **PUT/PATCH** `/api/clientes/{id}/` - Atualizar cliente
- **DELETE** `/api/clientes/{id}/` - Deletar cliente

### 5.2 Filtros Disponíveis
Query parameters aceitos no GET `/api/clientes/`:
- `ativo` - true/false
- `tipo_frete` - CIF ou FOB
- `estado` - UF (SP, RJ, MG, etc.)
- `q` - Busca geral (razão social, nome fantasia, CNPJ)

### 5.3 Actions Especiais
- **GET** `/api/clientes/export/` - Exportar clientes para CSV

### 5.4 Modelo de Dados

**Campos principais:**
```json
{
  "id": "uuid",
  "razao_social": "Empresa Exemplo Ltda",
  "nome_fantasia": "Empresa Exemplo",
  "cnpj": "12345678000190",
  "ie": "123456789",
  "logradouro": "Rua Exemplo",
  "numero": "123",
  "complemento": "Sala 1",
  "bairro": "Centro",
  "cidade": "São Paulo",
  "estado": "SP",
  "cep": "01234567",
  "distancia": 150.50,
  "tipo_frete": "CIF",
  "ativo": true,
  "observacoes": "Cliente preferencial",
  "criado_em": "2024-11-26T10:00:00Z",
  "atualizado_em": "2024-11-26T10:00:00Z"
}
```

**Campos computados (read-only):**
- `cnpj_formatado` - CNPJ formatado (00.000.000/0000-00)

**Validações:**
- CNPJ: 14 dígitos obrigatórios
- UF: Validação de 27 estados + DF
- Tipo de frete: CIF ou FOB

---

## 6️⃣ MOTORISTAS ✨ NOVO

**Base:** `/api/motoristas/`

### 6.1 CRUD Completo
- **GET** `/api/motoristas/` - Listar motoristas
- **GET** `/api/motoristas/{id}/` - Detalhes de um motorista
- **POST** `/api/motoristas/` - Criar novo motorista
- **PUT/PATCH** `/api/motoristas/{id}/` - Atualizar motorista
- **DELETE** `/api/motoristas/{id}/` - Deletar motorista

### 6.2 Filtros Disponíveis
Query parameters aceitos no GET `/api/motoristas/`:
- `ativo` - true/false
- `categoria_cnh` - Categoria (A, B, C, D, E, AB, AC, AD, AE)
- `q` - Busca geral (nome, CPF, CNH)

### 6.3 Actions Especiais
- **GET** `/api/motoristas/vencimentos/` - Motoristas com documentos vencendo
  - Query param: `dias` (default: 30)
  - Retorna motoristas com CNH, NR20, NR35 ou MOPP vencendo
- **GET** `/api/motoristas/export/` - Exportar motoristas para CSV

### 6.4 Modelo de Dados

**Campos principais:**
```json
{
  "id": "uuid",
  "nome": "João da Silva",
  "cpf": "12345678901",
  "cnh": "12345678901",
  "categoria_cnh": "D",
  "validade_cnh": "2025-12-31",
  "nr20_validade": "2025-06-30",
  "nr35_validade": "2025-06-30",
  "mopp_validade": "2025-12-31",
  "telefone": "(11) 98765-4321",
  "email": "joao@example.com",
  "logradouro": "Rua Exemplo",
  "numero": "456",
  "complemento": "Apto 10",
  "bairro": "Jardim",
  "cidade": "São Paulo",
  "estado": "SP",
  "cep": "01234567",
  "ativo": true,
  "observacoes": "Motorista experiente",
  "criado_em": "2024-11-26T10:00:00Z",
  "atualizado_em": "2024-11-26T10:00:00Z"
}
```

**Campos computados (read-only):**
- `cpf_formatado` - CPF formatado (000.000.000-00)
- `documentos_vencendo` - Lista de documentos que vencem em 30 dias

**Validações:**
- CPF: 11 dígitos obrigatórios
- CNH: Obrigatória e única
- Categorias: A, B, C, D, E, AB, AC, AD, AE

### 6.5 Endpoint de Vencimentos

**GET** `/api/motoristas/vencimentos/?dias=30`

**Resposta:**
```json
{
  "dias_alerta": 30,
  "total": 2,
  "motoristas": [
    {
      "id": "uuid",
      "nome": "João da Silva",
      "cpf": "12345678901",
      "documentos_vencendo": [
        {
          "documento": "CNH",
          "validade": "2024-12-15",
          "vencido": false
        },
        {
          "documento": "MOPP",
          "validade": "2024-11-20",
          "vencido": true
        }
      ]
    }
  ]
}
```

---

## 7️⃣ VEÍCULOS (ATUALIZADO) 🔄

**Base:** `/api/veiculos/`

### 7.1 CRUD Completo
- **GET** `/api/veiculos/` - Listar veículos
- **GET** `/api/veiculos/{id}/` - Detalhes de um veículo
- **POST** `/api/veiculos/` - Criar novo veículo
- **PUT/PATCH** `/api/veiculos/{id}/` - Atualizar veículo
- **DELETE** `/api/veiculos/{id}/` - Deletar veículo

### 7.2 Filtros
- `ativo` - true/false
- `tipo_proprietario` - Código do tipo (00=Próprio, 01=Outro a especificar, 02=Agregado)
- `uf` - UF do proprietário
- `q` - Busca geral (placa, renavam, nome, CNPJ/CPF, RNTRC)

### 7.3 Actions
- **GET** `/api/veiculos/export/` - Exportar veículos para CSV
- **GET** `/api/veiculos/{id}/estatisticas/` - Estatísticas do veículo
  - Retorna: Total de manutenções, gastos, CT-es e MDF-es válidos
- **GET** `/api/veiculos/vencimentos/` - ✨ NOVO - Veículos com documentos vencendo
  - Query param: `dias` (default: 30)

### 7.4 Campos de Documentação ✨ NOVOS

**Campos adicionados ao modelo Veículo:**
```json
{
  "id": "uuid",
  "placa": "ABC1234",
  "renavam": "12345678901",
  "tipo_rodado": "TRUCK",
  "tipo_carroceria": "BAU",
  "capacidade_m3": 50.00,
  "civ_validade": "2025-12-31",
  "cipp_validade": "2025-06-30",
  "afericao_validade": "2025-03-31",
  "crlv_validade": "2025-12-31",
  "cronotacografo_validade": "2025-06-30",
  "observacoes": "Veículo em ótimo estado",
  "compartimentos": [...],
  "documentos_vencendo": [...]
}
```

**Campos computados (read-only):**
- `compartimentos` - Lista de compartimentos (bocas) do veículo
- `documentos_vencendo` - Lista de documentos que vencem em 30 dias

### 7.5 Endpoint de Vencimentos ✨ NOVO

**GET** `/api/veiculos/vencimentos/?dias=30`

**Resposta:**
```json
{
  "dias_alerta": 30,
  "total": 3,
  "veiculos": [
    {
      "id": "uuid",
      "placa": "ABC1234",
      "documentos_vencendo": [
        {
          "documento": "CRLV",
          "validade": "2024-12-15",
          "vencido": false
        },
        {
          "documento": "Aferição",
          "validade": "2024-11-20",
          "vencido": true
        }
      ]
    }
  ]
}
```

---

## 8️⃣ COMPARTIMENTAÇÃO DE VEÍCULOS ✨ NOVO

**Base:** `/api/veiculos/{veiculo_id}/compartimentos/`

### 8.1 CRUD Completo (Rotas Aninhadas)
- **GET** `/api/veiculos/{veiculo_id}/compartimentos/` - Listar compartimentos do veículo
- **GET** `/api/veiculos/{veiculo_id}/compartimentos/{id}/` - Detalhes de um compartimento
- **POST** `/api/veiculos/{veiculo_id}/compartimentos/` - Criar compartimento
- **PUT/PATCH** `/api/veiculos/{veiculo_id}/compartimentos/{id}/` - Atualizar compartimento
- **DELETE** `/api/veiculos/{veiculo_id}/compartimentos/{id}/` - Deletar compartimento

### 8.2 Modelo de Dados

**Estrutura de Compartimento (Boca):**
```json
{
  "id": 1,
  "veiculo": "uuid-do-veiculo",
  "numero_boca": 1,
  "capacidade_m3": 5.50
}
```

**Validações:**
- `numero_boca`: Deve estar entre 1 e 9
- `capacidade_m3`: Deve ser maior que zero
- Constraint único: (veiculo, numero_boca)

### 8.3 Exemplo de Uso

**Listar compartimentos de um veículo:**
```
GET /api/veiculos/abc-123-uuid/compartimentos/
```

**Resposta:**
```json
[
  {
    "id": 1,
    "veiculo": "abc-123-uuid",
    "numero_boca": 1,
    "capacidade_m3": 5.50
  },
  {
    "id": 2,
    "veiculo": "abc-123-uuid",
    "numero_boca": 2,
    "capacidade_m3": 5.00
  }
]
```

**Criar novo compartimento:**
```
POST /api/veiculos/abc-123-uuid/compartimentos/

{
  "numero_boca": 3,
  "capacidade_m3": 6.00
}
```

---

## 9️⃣ MANUTENÇÕES DE VEÍCULOS

**Exemplo de resposta de estatísticas:**
```json
{
  "veiculo": {
    "placa": "ABC1234",
    "proprietario": "João Silva",
    "tipo": "Próprio",
    "ativo": true
  },
  "manutencoes": {
    "total": 15,
    "valor_pecas": 5000.00,
    "valor_mao_obra": 3000.00,
    "valor_total": 8000.00,
    "por_status": [
      {"status": "realizada", "total": 12, "valor": 7000.00},
      {"status": "agendada", "total": 3, "valor": 1000.00}
    ]
  },
  "documentos": {
    "total_ctes_validos": 250,
    "total_mdfes_validos": 45
  }
}
```

---

## 6️⃣ MANUTENÇÕES DE VEÍCULOS

**Base:** `/api/manutencoes/`

### 6.1 CRUD Completo
- **GET** `/api/manutencoes/` - Listar manutenções
- **GET** `/api/manutencoes/{id}/` - Detalhes de uma manutenção
- **POST** `/api/manutencoes/` - Criar nova manutenção
- **PUT/PATCH** `/api/manutencoes/{id}/` - Atualizar manutenção
- **DELETE** `/api/manutencoes/{id}/` - Deletar manutenção

### 6.2 Rotas Aninhadas (por veículo)
- **GET** `/api/veiculos/{veiculo_id}/manutencoes/` - Manutenções de um veículo
- **POST** `/api/veiculos/{veiculo_id}/manutencoes/` - Criar manutenção para veículo
- **GET** `/api/veiculos/{veiculo_id}/manutencoes/{id}/` - Detalhes
- **PUT/PATCH** `/api/veiculos/{veiculo_id}/manutencoes/{id}/` - Atualizar
- **DELETE** `/api/veiculos/{veiculo_id}/manutencoes/{id}/` - Deletar

### 6.3 Filtros
- `veiculo` - ID do veículo
- `placa` - Placa do veículo
- `status` - Status da manutenção
- `data_inicio` - Data inicial (YYYY-MM-DD)
- `data_fim` - Data final (YYYY-MM-DD)
- `q` - Busca geral (serviço, oficina, observações, nota fiscal)

### 6.4 Actions
- **GET** `/api/manutencoes/export/` - Exportar manutenções para CSV

### 6.5 Painel de Manutenção
**Base:** `/api/manutencao/painel/`

- **GET** `/api/manutencao/painel/indicadores/` - Indicadores gerais
  - Query params: `data_inicio`, `data_fim`
  - Retorna: total_manutencoes, total_pecas, total_mao_obra, valor_total

- **GET** `/api/manutencao/painel/graficos/` - Dados para gráficos
  - Query params: `data_inicio`, `data_fim`
  - Retorna: por_status, por_veiculo (top 10), por_periodo (mensal)

- **GET** `/api/manutencao/painel/ultimos/` - Últimas manutenções
  - Query params: `limit` (padrão: 10, máx: 50)

- **GET** `/api/manutencao/painel/tendencias/` - Análise de tendências
  - Query params: `meses` (padrão: 12)
  - Retorna: tendencia_valor (comparação períodos), frequencia_por_veiculo

---

## 7️⃣ PAGAMENTOS

### 7.1 Faixas de KM
**Base:** `/api/faixas-km/`

- **GET** `/api/faixas-km/` - Listar faixas
- **GET** `/api/faixas-km/{id}/` - Detalhes de uma faixa
- **POST** `/api/faixas-km/` - Criar faixa
- **PUT/PATCH** `/api/faixas-km/{id}/` - Atualizar faixa
- **DELETE** `/api/faixas-km/{id}/` - Deletar faixa

**Modelo de Faixa:**
```json
{
  "id": 1,
  "min_km": 0,
  "max_km": 5000,
  "valor_pago": 3000.00,
  "descricao": "Faixa básica"
}
```

### 7.2 Pagamentos Agregados
**Base:** `/api/pagamentos/agregados/`

- **GET** `/api/pagamentos/agregados/` - Listar pagamentos
- **GET** `/api/pagamentos/agregados/{id}/` - Detalhes
- **POST** `/api/pagamentos/agregados/` - Criar pagamento
- **PUT/PATCH** `/api/pagamentos/agregados/{id}/` - Atualizar
- **DELETE** `/api/pagamentos/agregados/{id}/` - Deletar

**Filtros:**
- `status` - Status do pagamento (pendente, pago, cancelado)
- `placa` - Placa do veículo
- `data_inicio` - Data inicial (data_prevista)
- `data_fim` - Data final (data_prevista)
- `condutor_cpf` - CPF do condutor
- `q` - Busca pelo nome do condutor

**Actions:**
- **POST** `/api/pagamentos/agregados/gerar/` - Gerar pagamentos em lote
  - **Body:**
    ```json
    {
      "data_inicio": "2024-01-01",
      "data_fim": "2024-01-31",
      "percentual": 25.0,
      "data_prevista": "2024-02-05"
    }
    ```
  - **Resposta:**
    ```json
    {
      "message": "Geração de pagamentos concluída.",
      "criados": 15,
      "erros": 0,
      "avisos": 2,
      "detalhes_erros": [],
      "detalhes_avisos": [
        "CT-e 12345: Sem dados de prestação, ignorado."
      ]
    }
    ```

- **GET** `/api/pagamentos/agregados/export/` - Exportar para CSV

### 7.3 Pagamentos Próprios
**Base:** `/api/pagamentos/proprios/`

- **GET** `/api/pagamentos/proprios/` - Listar pagamentos
- **GET** `/api/pagamentos/proprios/{id}/` - Detalhes
- **POST** `/api/pagamentos/proprios/` - Criar pagamento
- **PUT/PATCH** `/api/pagamentos/proprios/{id}/` - Atualizar
- **DELETE** `/api/pagamentos/proprios/{id}/` - Deletar

**Filtros:**
- `status` - Status do pagamento
- `veiculo` - ID do veículo
- `placa` - Placa do veículo
- `periodo` - Período (AAAA-MM ou AAAA-MM-1Q ou AAAA-MM-2Q)

**Actions:**
- **POST** `/api/pagamentos/proprios/calcular_km/` - Calcular KM e valor base
  - **Body:**
    ```json
    {
      "veiculo_id": 1,
      "periodo": "2024-01",
      "km_total": 5000  // opcional, se não fornecido calcula automaticamente
    }
    ```
  - **Resposta:**
    ```json
    {
      "km_total": 5000,
      "fonte_km": "Manual",  // ou "Automático (baseado nos CT-es)"
      "veiculo": {"id": "1", "placa": "ABC1234"},
      "periodo": "2024-01",
      "faixa_aplicada": {
        "id": 2,
        "min_km": 5000,
        "max_km": 10000,
        "valor": 3500.00
      },
      "valor_base": 3500.00
    }
    ```

- **POST** `/api/pagamentos/proprios/gerar/` - Gerar pagamentos em lote
  - **Body:**
    ```json
    {
      "periodo": "2024-01",
      "veiculos": "todos",  // ou lista de IDs: [1, 2, 3]
      "km_padrao": 5000     // opcional
    }
    ```
  - **Resposta:**
    ```json
    {
      "message": "Geração de pagamentos concluída.",
      "criados": 10,
      "ignorados": 2,
      "erros": 0,
      "resultados_detalhados": [
        {
          "veiculo": "ABC1234",
          "status": "criado",
          "km_total": 5000,
          "valor_base": 3500.00
        }
      ]
    }
    ```

- **GET** `/api/pagamentos/proprios/export/` - Exportar para CSV

---

## 8️⃣ DASHBOARDS E PAINÉIS

### 8.1 Dashboard Geral
- **GET** `/api/dashboard/` - Dados consolidados do dashboard
  - **Query params:**
    - `periodo` - mes, trimestre, ano (padrão: mes)
    - `data_inicio` - YYYY-MM-DD (opcional)
    - `data_fim` - YYYY-MM-DD (opcional)

  - **Resposta:**
    ```json
    {
      "filtros": {
        "periodo": "mes",
        "data_inicio": "2024-01-01",
        "data_fim": "2024-01-31"
      },
      "cards": {
        "total_ctes": 150,
        "total_mdfes": 30,
        "valor_total_fretes": 450000.00,
        "valor_cif": 300000.00,
        "valor_fob": 150000.00
      },
      "grafico_cif_fob": [
        {"data": "01/01/2024", "cif": 10000, "fob": 5000, "total": 15000}
      ],
      "grafico_metas": [...],
      "ultimos_lancamentos": {
        "ctes": [...],
        "mdfes": [...]
      }
    }
    ```

### 8.2 Painel Financeiro
- **GET** `/api/painel/financeiro/` - Dados do painel financeiro
  - Query params: `periodo`, `data_inicio`, `data_fim`

- **GET** `/api/financeiro/mensal/` - Dados financeiros mensais
  - **Query params:**
    - `mes` - AAAA-MM
    - OU `data_inicio` / `data_fim` - YYYY-MM-DD

- **GET** `/api/financeiro/detalhe/` - Detalhes financeiros por agrupamento
  - **Query params (obrigatórios):**
    - `data_inicio` - YYYY-MM-DD
    - `data_fim` - YYYY-MM-DD
    - `group` - cliente, veiculo, origem, destino

  - **Resposta:**
    ```json
    [
      {
        "id": "12345678000190",
        "label": "Cliente Exemplo Ltda",
        "faturamento_total": 50000.00,
        "qtd_ctes": 25,
        "valor_medio": 2000.00
      }
    ]
    ```

### 8.3 Painel Geográfico
- **GET** `/api/painel/geografico/` - Dados geográficos (origens, destinos, rotas)
  - Query params: `data_inicio`, `data_fim`

  - **Resposta:**
    ```json
    {
      "filtros": {...},
      "top_origens": [
        {
          "municipio": "São Paulo",
          "uf": "SP",
          "codigo": "3550308",
          "total": 50,
          "valor": 150000.00
        }
      ],
      "top_destinos": [...],
      "rotas_frequentes": [
        {
          "origem": {"municipio": "São Paulo", "uf": "SP", "codigo": "3550308"},
          "destino": {"municipio": "Rio de Janeiro", "uf": "RJ", "codigo": "3304557"},
          "total": 25,
          "valor": 75000.00,
          "km_total": 12500
        }
      ],
      "rotas": [
        {"uf_ini": "SP", "uf_fim": "RJ", "contagem": 100, "valor": 300000.00}
      ]
    }
    ```

### 8.4 Alertas
- **GET** `/api/alertas/pagamentos/` - Alertas de pagamentos pendentes
  - **Query params:**
    - `dias` - Número de dias para alertar (padrão: 7)

  - **Resposta:**
    ```json
    {
      "agregados_pendentes": [...],
      "proprios_pendentes": [...],
      "dias_alerta": 7
    }
    ```

### 8.5 Alertas do Sistema
**Base:** `/api/alertas/sistema/`

- **GET** `/api/alertas/sistema/` - Listar alertas
- **DELETE** `/api/alertas/sistema/{id}/` - Deletar alerta específico
- **POST** `/api/alertas/sistema/limpar_todos/` - Limpar todos os alertas

---

## 9️⃣ CONFIGURAÇÕES

### 9.1 Parâmetros do Sistema
**Base:** `/api/configuracoes/parametros/`

- **GET** `/api/configuracoes/parametros/` - Listar parâmetros
- **GET** `/api/configuracoes/parametros/{id}/` - Detalhes
- **POST** `/api/configuracoes/parametros/` - Criar (somente admin)
- **PUT/PATCH** `/api/configuracoes/parametros/{id}/` - Atualizar (somente admin)
- **DELETE** `/api/configuracoes/parametros/{id}/` - Deletar (somente admin)

**Filtros:**
- `grupo` - Grupo do parâmetro
- `editavel` - true/false

**Actions:**
- **GET** `/api/configuracoes/parametros/valores/` - Valores simplificados
  - Query params: `grupo` (opcional)
  - **Resposta:**
    ```json
    {
      "NOME_PARAM1": "valor tipado",
      "NOME_PARAM2": 123,
      "NOME_PARAM3": true
    }
    ```

- **POST** `/api/configuracoes/parametros/atualizar-multiplos/` - Atualizar múltiplos (somente admin)
  - **Body:**
    ```json
    {
      "parametros": {
        "NOME_PARAM1": "novo_valor",
        "NOME_PARAM2": 456
      }
    }
    ```
  - **Resposta:**
    ```json
    {
      "message": "Atualização concluída. 2 atualizados, 0 com erro.",
      "atualizados": [
        {
          "nome": "NOME_PARAM1",
          "valor": "novo_valor",
          "valor_tipado": "novo_valor"
        }
      ],
      "erros": []
    }
    ```

### 9.2 Configuração da Empresa
**Base:** `/api/configuracoes/empresa/`

- **GET** `/api/configuracoes/empresa/` - Obter configuração da empresa
- **POST** `/api/configuracoes/empresa/` - Criar/atualizar configuração (somente admin)

**Modelo:**
```json
{
  "id": 1,
  "nome_fantasia": "Transportadora XYZ",
  "razao_social": "XYZ Transportes Ltda",
  "cnpj": "12345678000190",
  "ie": "123456789",
  "logradouro": "Rua Exemplo",
  "numero": "123",
  "complemento": "Sala 1",
  "bairro": "Centro",
  "cidade": "São Paulo",
  "uf": "SP",
  "cep": "01234567",
  "telefone": "(11) 1234-5678",
  "email": "contato@xyz.com.br"
}
```

---

## 🔟 BACKUP E RESTAURAÇÃO

**Base:** `/api/backup/`
**Permissões:** Somente administradores

### 10.1 Gestão de Backups
- **GET** `/api/backup/` - Listar backups registrados
  - **Resposta:**
    ```json
    [
      {
        "id": 1,
        "nome_arquivo": "backup_db_20240115_143022.sql",
        "tamanho_bytes": 15728640,
        "md5_hash": "a1b2c3d4e5f6...",
        "data_hora": "2024-01-15T14:30:22Z",
        "usuario": "admin",
        "status": "completo",
        "detalhes": null
      }
    ]
    ```

- **POST** `/api/backup/gerar/` - Gerar novo backup
  - Retorna FileResponse com o arquivo de backup para download imediato
  - Headers de resposta incluem:
    - `X-Backup-ID` - ID do registro criado
    - `X-Backup-Status` - Status do backup

- **GET** `/api/backup/{id}/download/` - Baixar backup existente
  - Retorna FileResponse com o arquivo de backup

- **POST** `/api/backup/restaurar/` - Restaurar backup (funcionalidade simulada)
  - **Body (multipart/form-data):**
    - `arquivo_backup` - Arquivo .sql do backup
  - **Resposta (202 Accepted):**
    ```json
    {
      "message": "Arquivo de backup recebido com sucesso. A restauração do banco de dados deve ser realizada manualmente...",
      "arquivo_recebido": "backup_db_20240115_143022.sql",
      "tamanho_bytes": 15728640,
      "local_temporario": "/tmp/backup_restore_xyz/backup_db_20240115_143022.sql"
    }
    ```

**Bancos de dados suportados:**
- SQLite3
- PostgreSQL
- Outros podem ser implementados

---

## 1️⃣1️⃣ RELATÓRIOS

**Base:** `/api/relatorios/`

### 11.1 Geração de Relatórios
- **GET** `/api/relatorios/` - Gerar relatório

**Query Parameters:**
- `tipo` - Tipo de relatório (obrigatório)
  - `faturamento` - Faturamento agregado por mês
  - `veiculos` - Cadastro de veículos
  - `ctes` - Relatório de CT-es
  - `mdfes` - Relatório de MDF-es
  - `pagamentos` - Relatório de pagamentos
  - `km_rodado` - KM rodado por veículo
  - `manutencoes` - Relatório de manutenções

- `formato` - Formato de saída (padrão: csv)
  - `csv` - Arquivo CSV (UTF-8 com BOM)
  - `json` - Dados em JSON
  - `xlsx` - Planilha Excel
  - `pdf` - Documento PDF

- `filtros` - JSON com filtros específicos (opcional)

**Filtros Comuns (podem ser passados diretamente como query params):**
- `data_inicio` - YYYY-MM-DD
- `data_fim` - YYYY-MM-DD
- `placa` - Placa do veículo
- `chave` - Chave do documento
- `numero` - Número do documento
- `emitente` - Nome do emitente
- `modalidade` - Modalidade (CIF/FOB)
- `status` - Status
- `processado` - true/false
- `encerrado` - true/false (para MDF-es)

**Filtros Específicos por Tipo:**

#### Relatório de Faturamento
- Retorna faturamento agregado por mês

#### Relatório de Veículos
- `ativo` - true/false

#### Relatório de CT-es
Campos retornados:
- chave, numero, data_emissao, emitente, remetente, destinatario
- valor_total, modalidade, processado, placa, km_distancia

#### Relatório de MDF-es
Campos retornados:
- chave, numero, data_emissao, emitente, uf_inicio, uf_fim
- placa_tracao, condutor, qtd_ctes, valor_carga, peso_carga
- encerrado, data_encerramento, processado

#### Relatório de Pagamentos
- `tipo` - agregado, proprio, todos

Campos retornados:
- tipo, id, cte_numero, placa, condutor, cpf_condutor
- valor_frete, percentual_repasse, valor_repassado
- status, data_prevista, data_pagamento, observacoes
- periodo, km_total (para próprios)

#### Relatório de KM Rodado
Campos retornados:
- placa, km_ctes, km_manutencoes, qtd_ctes, qtd_manutencoes
- ultima_manutencao, km_total_estimado
- veiculo_ativo, proprietario

#### Relatório de Manutenções
Campos conforme serializer de manutenção

**Exemplos de Uso:**
```
# CT-es em CSV
GET /api/relatorios/?tipo=ctes&formato=csv&data_inicio=2024-01-01&data_fim=2024-01-31

# Faturamento em Excel
GET /api/relatorios/?tipo=faturamento&formato=xlsx&data_inicio=2024-01-01&data_fim=2024-12-31

# Pagamentos agregados pendentes em PDF
GET /api/relatorios/?tipo=pagamentos&formato=pdf&status=pendente&tipo=agregado

# MDF-es encerrados em JSON
GET /api/relatorios/?tipo=mdfes&formato=json&encerrado=true&data_inicio=2024-01-01

# KM rodado de um veículo específico
GET /api/relatorios/?tipo=km_rodado&formato=csv&placa=ABC1234&data_inicio=2024-01-01&data_fim=2024-12-31
```

**Limitações:**
- CT-es e MDF-es: máximo 1000 registros por relatório
- Pagamentos: máximo 500 registros por tipo

---

## 1️⃣2️⃣ DOCUMENTAÇÃO DA API

### 12.1 Swagger/OpenAPI
- **GET** `/api/swagger/` - Interface Swagger UI interativa
- **GET** `/api/swagger.json` - Esquema OpenAPI em JSON
- **GET** `/api/swagger.yaml` - Esquema OpenAPI em YAML
- **GET** `/api/redoc/` - Interface ReDoc (documentação alternativa)

**Características:**
- Documentação interativa com possibilidade de testar endpoints
- Autenticação necessária para acessar
- Esquemas completos de request/response
- Exemplos de uso

---

## 1️⃣3️⃣ HEALTH CHECK

- **GET** `/health/` - Health check simples (sem autenticação)
  - Retorna: `{"status": "ok"}`

- **GET** `/api/health/` - Health check detalhado da API
  - Retorna informações sobre o sistema

---

## 1️⃣4️⃣ PÁGINAS HTML (Interface Web)

**Base:** `/app/`
**Autenticação:** Requer login

- **GET** `/app/` ou `/app/dashboard/` - Dashboard principal
- **GET** `/app/cte/` - Painel de CT-e
- **GET** `/app/mdfe/` - Painel de MDF-e
- **GET** `/app/upload/` - Upload de XMLs
- **GET** `/app/financeiro/` - Painel financeiro
- **GET** `/app/geografico/` - Painel geográfico
- **GET** `/app/manutencao/` - Gestão de manutenções
- **GET** `/app/configuracoes/` - Configurações do sistema
- **GET** `/app/backup/` - Backup e restauração
- **GET** `/app/relatorios/` - Geração de relatórios
- **GET** `/app/alertas/` - Alertas do sistema
- **GET** `/app/pagamentos/` - Gestão de pagamentos

---

## 📊 RESUMO POR MÓDULO

| Módulo | Endpoints | Funcionalidades Principais |
|--------|-----------|---------------------------|
| **Autenticação** | 8 | Login, logout, gestão de usuários |
| **CT-e** | 7 | CRUD, exportação, XML, DACTE, estatísticas |
| **MDF-e** | 7 | CRUD, exportação, XML, DAMDFE, documentos |
| **Upload** | 2 | Upload individual e em lote de XMLs |
| **Clientes** | 3 | CRUD, filtros, exportação CSV |
| **Motoristas** | 5 | CRUD, vencimentos de documentos, exportação CSV |
| **Veículos** | 8 | CRUD, vencimentos, estatísticas, compartimentação |
| **Compartimentação** | 5 | CRUD de bocas/compartimentos de veículos |
| **Manutenções** | 15 | CRUD, painel, indicadores, tendências |
| **Pagamentos** | 17 | Faixas KM, agregados, próprios, geração em lote |
| **Dashboards** | 10 | Dashboard geral, financeiro, geográfico, alertas |
| **Configurações** | 8 | Parâmetros, empresa |
| **Backup** | 4 | Gerar, listar, baixar, restaurar |
| **Relatórios** | 1 | 7 tipos × 4 formatos = 28 variações |
| **Documentação** | 4 | Swagger, ReDoc, JSON, YAML |
| **Health** | 2 | Health checks |
| **Páginas HTML** | 13 | Interface web completa |

**TOTAL: ~115+ endpoints da API**

---

## 🔑 CÓDIGOS DE STATUS HTTP

### Sucesso (2xx)
- **200 OK** - Requisição bem-sucedida
- **201 Created** - Recurso criado com sucesso
- **202 Accepted** - Requisição aceita para processamento
- **204 No Content** - Sucesso sem conteúdo de retorno
- **207 Multi-Status** - Múltiplos status (usado em upload em lote)

### Erros do Cliente (4xx)
- **400 Bad Request** - Requisição inválida ou parâmetros incorretos
- **401 Unauthorized** - Não autenticado (sem login)
- **403 Forbidden** - Sem permissão para acessar o recurso
- **404 Not Found** - Recurso não encontrado
- **405 Method Not Allowed** - Método HTTP não permitido
- **422 Unprocessable Entity** - Entidade não processável (erro de validação)

### Erros do Servidor (5xx)
- **500 Internal Server Error** - Erro interno do servidor
- **501 Not Implemented** - Funcionalidade não implementada

---

## 🔐 AUTENTICAÇÃO E PERMISSÕES

### Níveis de Acesso

1. **Público (sem autenticação)**
   - `/health/`
   - `/login/`
   - `/` (landing page)

2. **Autenticado (qualquer usuário logado)**
   - Leitura de todos os recursos
   - CRUD de recursos não-administrativos
   - Atualização do próprio perfil

3. **Admin (is_staff ou is_superuser)**
   - Gestão de usuários
   - Configurações do sistema
   - Parâmetros do sistema
   - Backups
   - Todas as operações de escrita em configurações

### Método de Autenticação
- **Session-based authentication** (Django padrão)
- Cookie de sessão após login bem-sucedido
- CSRF protection ativo

---

## 📝 FORMATOS DE DATA/HORA

- **Datas:** `YYYY-MM-DD` (ISO 8601)
  - Exemplo: `2024-01-15`

- **Data/Hora:** `YYYY-MM-DDTHH:MM:SS` ou `YYYY-MM-DDTHH:MM:SSZ`
  - Exemplo: `2024-01-15T14:30:22Z`

- **Período (pagamentos próprios):** `AAAA-MM` ou `AAAA-MM-XQ`
  - Exemplo: `2024-01` (mês completo)
  - Exemplo: `2024-01-1Q` (primeira quinzena)
  - Exemplo: `2024-01-2Q` (segunda quinzena)

---

## 💾 LIMITES E PAGINAÇÃO

- **Exportações CSV:** Máximo 10.000 registros (CT-es)
- **Relatórios de CT-es/MDF-es:** Máximo 1.000 registros
- **Relatórios de Pagamentos:** Máximo 500 registros por tipo
- **Paginação:** Configurável via Django REST Framework (não explicitamente documentado nas views, mas pode estar ativo)

---

## 🎨 CONVENÇÕES DE NOMENCLATURA

### URLs
- Sempre em minúsculas
- Usar hífen (-) para separar palavras
- Plurais para coleções: `/api/ctes/`, `/api/veiculos/`
- Singular para recursos únicos: `/api/configuracoes/empresa/`

### Parâmetros
- snake_case para query parameters e campos JSON
- Exemplos: `data_inicio`, `condutor_cpf`, `valor_total`

### Campos Booleanos
- Aceitar: `true`, `false`, `1`, `0`, `sim`, `não` (case-insensitive)
- Retornar sempre: `true` ou `false`

---

## 🚀 MELHORIAS FUTURAS IDENTIFICADAS

Com base na análise do código, estas funcionalidades estão parcialmente implementadas ou marcadas para implementação:

1. **DACTE/DAMDFE PDF:** Implementado com reportlab
2. **Geração de Relatórios:** Totalmente implementado (7 tipos, 4 formatos)
3. **Backup/Restauração:** Geração implementada, restauração simulada
4. **Webhooks/Notificações:** Não identificado
5. **API de Busca Avançada:** Filtros básicos implementados
6. **Rate Limiting:** Não identificado
7. **Versionamento de API:** Não implementado
8. **Cache:** Não explicitamente configurado nas views

---

**Documento gerado em:** 2025-01-26
**Versão do Sistema:** Django 5.2 + DRF
**Última atualização:** Análise completa do código-fonte
