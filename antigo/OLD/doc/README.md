# 📚 Documentação do Sistema de Transporte

Bem-vindo à documentação completa do Sistema de Gestão de CT-e e MDF-e!

## 📖 Índice de Documentação

### 🎯 Guias de Início Rápido

- **[QUICK_START.md](./QUICK_START.md)** - Guia rápido para começar a usar o sistema
- **[README_LOCAL.md](./README_LOCAL.md)** - Configuração do ambiente de desenvolvimento local
- **[README_DOCKER.md](./README_DOCKER.md)** - Execução do sistema com Docker
- **[README_API_OLD.md](./README_API_OLD.md)** - Documentação antiga da API (referência)

### 🔌 Documentação da API

- **[API_ENDPOINTS.md](./API_ENDPOINTS.md)** - **✨ ATUALIZADO!** Catálogo completo de todos os endpoints da API
  - ~115+ endpoints documentados (incluindo novos módulos)
  - Exemplos de uso
  - Códigos de resposta
  - Filtros disponíveis
  - Modelos de dados

- **[AJUSTES_BACKEND_FRONTEND.md](./AJUSTES_BACKEND_FRONTEND.md)** - **✨ NOVO!** Guia de ajustes do backend para integração com frontend
  - Configuração de CORS
  - Autenticação e segurança
  - Checklist de validação
  - Exemplos de código

- **[FRONTEND_QUICKSTART.md](./FRONTEND_QUICKSTART.md)** - **✨ NOVO!** Guia rápido para desenvolvedores frontend
  - Setup em 5 minutos (React/Vue/Angular)
  - Serviço de API pronto para uso
  - Componentes de exemplo
  - Troubleshooting

- **[PLANO_IMPLEMENTACAO_NOVOS_CADASTROS.md](./PLANO_IMPLEMENTACAO_NOVOS_CADASTROS.md)** - Plano de implementação completo
  - 9 fases detalhadas
  - Código de referência
  - Validações e regras de negócio

- **[IMPLEMENTACAO_CONCLUIDA.md](./IMPLEMENTACAO_CONCLUIDA.md)** - Relatório de implementação
  - Estatísticas completas
  - Alterações realizadas
  - Checklist de validação

### 🛠️ Guias de Operação

- **[MANAGEMENT_GUIDE.md](./MANAGEMENT_GUIDE.md)** - Guia de gerenciamento e administração do sistema
- **[README_RESTAURACAO.md](./README_RESTAURACAO.md)** - Procedimentos de backup e restauração
- **[SUBDOMAINS_GUIDE.md](./SUBDOMAINS_GUIDE.md)** - Configuração de subdomínios

### 📥 Guias de Download e Deploy

- **[CHECKLIST_DOWNLOAD.md](./CHECKLIST_DOWNLOAD.md)** - Checklist para download e configuração
- **[INSTRUÇÕES_DOWNLOAD.txt](./INSTRUÇÕES_DOWNLOAD.txt)** - Instruções detalhadas de download
- **[MUDANCA_VPS.txt](./MUDANCA_VPS.txt)** - Procedimentos para mudança de servidor VPS

### 📦 Outros Arquivos

- **[requirements.txt](./requirements.txt)** - Dependências Python do projeto
- **[Novo(a) Documento de Texto.txt](./Novo(a) Documento de Texto.txt)** - Documento auxiliar

---

## 🚀 Começando

Se você é novo no sistema, recomendamos seguir esta ordem:

1. **Desenvolvedores:**
   - Leia o [QUICK_START.md](./QUICK_START.md)
   - Configure o ambiente com [README_LOCAL.md](./README_LOCAL.md)
   - Consulte a [API_ENDPOINTS.md](./API_ENDPOINTS.md) para desenvolvimento

2. **Administradores:**
   - Consulte o [MANAGEMENT_GUIDE.md](./MANAGEMENT_GUIDE.md)
   - Configure backups seguindo [README_RESTAURACAO.md](./README_RESTAURACAO.md)
   - Para deploy, veja [README_DOCKER.md](./README_DOCKER.md)

3. **Usuários da API:**
   - A documentação completa está em [API_ENDPOINTS.md](./API_ENDPOINTS.md)
   - Também disponível em Swagger em `/api/swagger/` quando o sistema estiver rodando

---

## 📊 Estrutura do Sistema

### Módulos Principais

1. **CT-e (Conhecimento de Transporte Eletrônico)**
   - Upload de XMLs
   - Processamento automático
   - Geração de DACTE
   - Consultas e relatórios

2. **MDF-e (Manifesto de Documentos Fiscais Eletrônico)**
   - Upload de XMLs
   - Processamento automático
   - Geração de DAMDFE
   - Vinculação com CT-es

3. **Clientes** ✨ NOVO
   - Cadastro completo de clientes
   - Validação de CNPJ
   - Filtros por UF, tipo de frete
   - Exportação CSV

4. **Motoristas** ✨ NOVO
   - Cadastro de motoristas
   - Validação de CNH e CPF
   - Sistema de alertas de vencimento de documentos
   - Exportação CSV

5. **Gestão de Veículos** ⚡ ATUALIZADO
   - Cadastro de veículos próprios e agregados
   - Compartimentação de veículos (bocas)
   - Documentação com alertas de vencimento
   - Manutenções
   - Histórico de uso

6. **Pagamentos**
   - Pagamentos a motoristas agregados
   - Pagamentos a motoristas próprios
   - Faixas de KM
   - Geração automática em lote

7. **Dashboards e Relatórios**
   - Dashboard geral
   - Painel financeiro
   - Painel geográfico
   - Relatórios em CSV, Excel, PDF

8. **Configurações e Backup**
   - Parâmetros do sistema
   - Configuração da empresa
   - Backup e restauração

---

## 🔧 Tecnologias Utilizadas

- **Backend:** Django 5.2 + Django REST Framework
- **Banco de Dados:** SQLite (dev) / PostgreSQL (prod)
- **Processamento XML:** xmltodict
- **Geração de PDF:** reportlab
- **Documentação API:** drf-yasg (Swagger/OpenAPI)
- **Container:** Docker

---

## 📞 Suporte

Para dúvidas ou problemas:

1. Consulte a documentação relevante acima
2. Verifique a documentação interativa em `/api/swagger/`
3. Entre em contato com a equipe de desenvolvimento

---

## 🔄 Atualizações

**Última atualização:** 26/11/2025

**Novidades na Versão 2.0:**
- ✨ **3 Novos Módulos:** Clientes, Motoristas, Compartimentação de Veículos
- 🔧 **CORS Configurado:** Backend pronto para integração com frontend
- 📚 **21 Novos Endpoints:** Total de ~115+ endpoints disponíveis
- 📖 **Documentação Frontend:** Guia completo para desenvolvedores React/Vue/Angular
- 🎯 **Sistema de Alertas:** Vencimento automático de documentos
- 📊 **Exportação CSV:** Clientes, Motoristas e Veículos
- 🔐 **Validações Robustas:** CNPJ, CPF, CNH, UF
- 📝 **API_ENDPOINTS.md Atualizado:** Versão 2.0 com todos os novos recursos

---

## 📝 Contribuindo

Ao adicionar nova documentação:

1. Coloque o arquivo nesta pasta `doc/`
2. Use formato Markdown (.md) quando possível
3. Atualize este README.md com o link para o novo documento
4. Mantenha a estrutura organizada por categoria

---

**Sistema de Gestão de CT-e e MDF-e**
© 2024 - Todos os direitos reservados
