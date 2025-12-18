#!/usr/bin/env python3
"""
Script de Teste de APIs - Fase 2
Sistema Destack Transportes
"""

import requests
import json
from datetime import datetime

# Configurações
BASE_URL = "http://localhost:8001/app"
USERNAME = "admin"
PASSWORD = "admin123"

# Resultados
results = {
    "timestamp": datetime.now().isoformat(),
    "total_tests": 0,
    "passed": 0,
    "failed": 0,
    "tests": []
}

def test_endpoint(session, method, endpoint, description, expected_status=200, data=None):
    """Testa um endpoint da API"""
    global results
    
    url = f"{BASE_URL}{endpoint}"
    results["total_tests"] += 1
    
    try:
        if method == "GET":
            response = session.get(url)
        elif method == "POST":
            response = session.post(url, json=data)
        elif method == "PUT":
            response = session.put(url, json=data)
        elif method == "DELETE":
            response = session.delete(url)
        
        status_ok = response.status_code == expected_status
        
        test_result = {
            "endpoint": endpoint,
            "method": method,
            "description": description,
            "status_code": response.status_code,
            "expected_status": expected_status,
            "passed": status_ok,
            "response_size": len(response.content),
            "content_type": response.headers.get("Content-Type", "unknown")
        }
        
        # Tentar parsear JSON se possível
        try:
            if "application/json" in response.headers.get("Content-Type", ""):
                json_data = response.json()
                test_result["has_data"] = bool(json_data)
                if isinstance(json_data, dict):
                    test_result["data_keys"] = list(json_data.keys())[:10]  # Primeiras 10 chaves
                elif isinstance(json_data, list):
                    test_result["data_count"] = len(json_data)
        except:
            pass
        
        if status_ok:
            results["passed"] += 1
            print(f"✅ {description}")
        else:
            results["failed"] += 1
            print(f"❌ {description} - Status: {response.status_code}")
        
        results["tests"].append(test_result)
        return response
        
    except Exception as e:
        results["failed"] += 1
        test_result = {
            "endpoint": endpoint,
            "method": method,
            "description": description,
            "passed": False,
            "error": str(e)
        }
        results["tests"].append(test_result)
        print(f"❌ {description} - Erro: {str(e)}")
        return None

def main():
    print("=" * 60)
    print("FASE 2: VALIDAÇÃO DE INTEGRAÇÕES BACKEND")
    print("Sistema Destack Transportes")
    print("=" * 60)
    print()
    
    # Criar sessão
    session = requests.Session()
    
    # 1. AUTENTICAÇÃO
    print("1. TESTANDO AUTENTICAÇÃO")
    print("-" * 60)
    
    # Login
    login_data = {
        "username": USERNAME,
        "password": PASSWORD
    }
    response = session.post(f"{BASE_URL}/login/", data=login_data)
    
    if response.status_code in [200, 302]:  # 302 = redirect após login
        print("✅ Login realizado com sucesso")
        results["authentication"] = "SUCCESS"
    else:
        print(f"❌ Falha no login - Status: {response.status_code}")
        results["authentication"] = "FAILED"
        return
    
    print()
    
    # 2. ENDPOINTS DE DASHBOARD
    print("2. TESTANDO DASHBOARD")
    print("-" * 60)
    
    test_endpoint(session, "GET", "/api/dashboard/", "Dashboard - Dados gerais")
    test_endpoint(session, "GET", "/api/dashboard/cte/", "Dashboard - Painel CT-e")
    test_endpoint(session, "GET", "/api/dashboard/mdfe/", "Dashboard - Painel MDF-e")
    test_endpoint(session, "GET", "/api/dashboard/financeiro/", "Dashboard - Painel Financeiro")
    test_endpoint(session, "GET", "/api/dashboard/geografico/", "Dashboard - Painel Geográfico")
    
    print()
    
    # 3. ENDPOINTS DE CADASTROS
    print("3. TESTANDO CADASTROS")
    print("-" * 60)
    
    test_endpoint(session, "GET", "/api/clientes/", "Clientes - Listagem")
    test_endpoint(session, "GET", "/api/motoristas/", "Motoristas - Listagem")
    test_endpoint(session, "GET", "/api/veiculos/", "Veículos - Listagem")
    
    print()
    
    # 4. ENDPOINTS OPERACIONAIS
    print("4. TESTANDO OPERACIONAL")
    print("-" * 60)
    
    test_endpoint(session, "GET", "/api/ctes/", "CT-e - Listagem")
    test_endpoint(session, "GET", "/api/mdfes/", "MDF-e - Listagem")
    
    print()
    
    # 5. ENDPOINTS FINANCEIROS
    print("5. TESTANDO FINANCEIRO")
    print("-" * 60)
    
    test_endpoint(session, "GET", "/api/dashboard/financeiro/mensal/", "Financeiro - Dados mensais")
    test_endpoint(session, "GET", "/api/pagamentos/agregados/", "Pagamentos - Agregados")
    test_endpoint(session, "GET", "/api/pagamentos/proprios/", "Pagamentos - Próprios")
    test_endpoint(session, "GET", "/api/faixas-km/", "Faixas KM - Listagem")
    
    print()
    
    # 6. ENDPOINTS DE GESTÃO
    print("6. TESTANDO GESTÃO")
    print("-" * 60)
    
    test_endpoint(session, "GET", "/api/manutencao/painel/", "Manutenção - Painel")
    test_endpoint(session, "GET", "/api/veiculos/1/manutencoes/", "Manutenção - Por veículo", expected_status=[200, 404])
    
    print()
    
    # 7. ENDPOINTS DE SISTEMA
    print("7. TESTANDO SISTEMA")
    print("-" * 60)
    
    test_endpoint(session, "GET", "/api/alertas/pagamentos/", "Alertas - Pagamentos pendentes")
    test_endpoint(session, "GET", "/api/alertas/sistema/", "Alertas - Sistema")
    test_endpoint(session, "GET", "/api/configuracoes/empresa/", "Configurações - Empresa")
    test_endpoint(session, "GET", "/api/configuracoes/parametros/", "Configurações - Parâmetros")
    
    print()
    
    # 8. RESUMO
    print("=" * 60)
    print("RESUMO DOS TESTES")
    print("=" * 60)
    print(f"Total de testes: {results['total_tests']}")
    print(f"✅ Passou: {results['passed']}")
    print(f"❌ Falhou: {results['failed']}")
    print(f"Taxa de sucesso: {(results['passed']/results['total_tests']*100):.1f}%")
    print()
    
    # Salvar resultados em JSON
    with open("resultados_fase2.json", "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    
    print("✅ Resultados salvos em: resultados_fase2.json")
    print()
    
    # Gerar relatório markdown
    generate_markdown_report()

def generate_markdown_report():
    """Gera relatório em Markdown"""
    
    report = f"""# Relatorio de Testes de API - Fase 2
## Sistema Destack Transportes

**Data:** {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}  
**Total de Testes:** {results['total_tests']}  
**Aprovados:** {results['passed']}  
**Reprovados:** {results['failed']}  
**Taxa de Sucesso:** {(results['passed']/results['total_tests']*100):.1f}%

---

## Autenticacao

Status: **{results.get('authentication', 'UNKNOWN')}**

---

## Resultados por Endpoint

"""
    
    for test in results['tests']:
        status_icon = "✅" if test['passed'] else "❌"
        report += f"\n### {status_icon} {test['description']}\n\n"
        report += f"- **Endpoint:** `{test['method']} {test['endpoint']}`\n"
        report += f"- **Status Code:** {test['status_code']} (esperado: {test['expected_status']})\n"
        
        if 'content_type' in test:
            report += f"- **Content-Type:** {test['content_type']}\n"
        
        if 'response_size' in test:
            report += f"- **Tamanho da Resposta:** {test['response_size']} bytes\n"
        
        if 'has_data' in test:
            report += f"- **Tem Dados:** {'Sim' if test['has_data'] else 'Nao'}\n"
        
        if 'data_count' in test:
            report += f"- **Quantidade de Itens:** {test['data_count']}\n"
        
        if 'data_keys' in test:
            report += f"- **Chaves Retornadas:** {', '.join(test['data_keys'])}\n"
        
        if 'error' in test:
            report += f"- **Erro:** {test['error']}\n"
        
        report += "\n"
    
    report += """---

## Conclusao

"""
    
    if results['failed'] == 0:
        report += "✅ **Todos os testes passaram!** O backend esta funcionando corretamente.\n"
    else:
        report += f"⚠️ **{results['failed']} teste(s) falharam.** Revisar endpoints com problemas.\n"
    
    with open("relatorio_fase2_api.md", "w", encoding="utf-8") as f:
        f.write(report)
    
    print("✅ Relatório Markdown salvo em: relatorio_fase2_api.md")

if __name__ == "__main__":
    main()
