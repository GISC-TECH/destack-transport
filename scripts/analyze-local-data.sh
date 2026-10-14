#!/bin/bash
# Analisa o banco local restaurado e imprime contagens de riscos fiscais/financeiros.
# Deve ser executado depois de ./scripts/restore-backup.sh.

set -euo pipefail

CONTAINER="${CONTAINER:-destack_web_local}"

if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
    echo "ERRO: container $CONTAINER não está rodando."
    echo "Inicie o ambiente local antes: docker-compose -f docker-compose.local.yml up -d"
    exit 1
fi

docker exec -i "$CONTAINER" python manage.py shell <<'PY'
from django.db.models import Count, Q
from transport.models import (
    CTeDocumento,
    MDFeDocumento,
    DocumentoEvento,
    PagamentoAgregado,
    PagamentoProprio,
    Veiculo,
    Motorista,
)

def count(label, value):
    print(f"{label}: {value}")

print("=== Inventario geral ===")
count("CT-es", CTeDocumento.objects.count())
count("MDF-es", MDFeDocumento.objects.count())
count("Veiculos", Veiculo.objects.count())
count("Motoristas", Motorista.objects.count())
count("Pagamentos agregados", PagamentoAgregado.objects.count())
count("Pagamentos proprios", PagamentoProprio.objects.count())
count("Eventos genericos", DocumentoEvento.objects.count())

print("\n=== Alertas fiscais ===")
count(
    "CT-es processados sem protocolo autorizado",
    CTeDocumento.objects.filter(processado=True).exclude(protocolo__codigo_status=100).count(),
)
count(
    "CT-es autorizados sem modalidade CIF/FOB",
    CTeDocumento.objects.filter(processado=True, protocolo__codigo_status=100, modalidade__isnull=True).count(),
)
count(
    "Cancelamentos genericos confirmados sem CTeCancelamento",
    DocumentoEvento.objects.filter(
        tipo_documento="CTE",
        tipo_evento="110111",
        confirmado=True,
        cte__cancelamento__isnull=True,
    ).count(),
)

duplicates = (
    DocumentoEvento.objects
    .values("chave_documento", "tipo_evento", "sequencia_evento")
    .annotate(total=Count("id"))
    .filter(total__gt=1)
    .count()
)
count("Grupos de eventos duplicados", duplicates)

print("\n=== Alertas financeiros ===")
count(
    "Pagamentos proprios sem CT-e",
    PagamentoProprio.objects.filter(cte__isnull=True).count(),
)
count(
    "Pagamentos agregados pagos com CT-e nao marcado pago",
    PagamentoAgregado.objects.filter(status="pago", cte__pago=False).count(),
)
count(
    "Pagamentos proprios pagos com CT-e nao marcado pago",
    PagamentoProprio.objects.filter(status="pago", cte__pago=False).count(),
)
count(
    "CT-es marcados pagos com pagamento pendente",
    CTeDocumento.objects.filter(pago=True).filter(
        Q(pagamento_agregado__status="pendente") |
        Q(pagamento_proprio__status="pendente")
    ).distinct().count(),
)
count(
    "CT-es cancelados com pagamento agregado ativo",
    CTeDocumento.objects.filter(
        cancelamento__c_stat=135,
        pagamento_agregado__isnull=False,
    ).count(),
)
count(
    "CT-es cancelados com pagamento proprio ativo",
    CTeDocumento.objects.filter(
        cancelamento__c_stat=135,
        pagamento_proprio__isnull=False,
    ).count(),
)

print("\n=== Base para proximas migracoes ===")
count(
    "Motoristas sem CNH",
    Motorista.objects.filter(Q(cnh__isnull=True) | Q(cnh="")).count(),
)
count(
    "Veiculos sem tipo_proprietario",
    Veiculo.objects.filter(Q(tipo_proprietario__isnull=True) | Q(tipo_proprietario="")).count(),
)
PY
