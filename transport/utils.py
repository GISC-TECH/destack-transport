import csv
from io import StringIO

from django.http import HttpResponse
from rest_framework.response import Response
from rest_framework import status


def formatar_valor_br(valor):
    """
    Formata um valor numérico para o padrão brasileiro (vírgula como separador decimal).
    Exemplos: 1500.00 -> "1500,00", 1234.5 -> "1234,50"
    """
    if valor is None or valor == '' or valor == '-':
        return valor

    try:
        # Converte para float se for string
        if isinstance(valor, str):
            # Se já contém vírgula, retorna como está
            if ',' in valor and '.' not in valor:
                return valor
            valor = float(valor.replace(',', '.'))

        # Formata com 2 casas decimais e troca ponto por vírgula
        return f"{valor:.2f}".replace('.', ',')
    except (ValueError, TypeError):
        return str(valor) if valor else ''


def formatar_dados_br(dados):
    """
    Formata todos os campos numéricos de uma lista de dicts para o padrão brasileiro.
    Identifica campos que contêm valores monetários/numéricos pelo nome ou conteúdo.
    """
    if not dados or not isinstance(dados, list):
        return dados

    # Campos que tipicamente contêm valores monetários
    campos_monetarios = [
        'valor', 'custo', 'total', 'preco', 'frete', 'icms', 'pedagio',
        'valor_total', 'valor_frete', 'valor_icms', 'valor_pedagio',
        'valor_peca', 'valor_mao_obra', 'valor_receber', 'valor_pago',
        'valor_cte', 'valor_servico', 'valor_prestacao', 'valor_carga',
        'receita', 'despesa', 'lucro', 'saldo', 'comissao', 'desconto',
        'km_total', 'quilometragem', 'km', 'peso', 'peso_carga',
        'percentual', 'valor_faixakm', 'valor_unitario'
    ]

    dados_formatados = []
    for item in dados:
        if not isinstance(item, dict):
            dados_formatados.append(item)
            continue

        item_formatado = {}
        for chave, valor in item.items():
            # Verifica se é um campo monetário/numérico
            chave_lower = chave.lower()
            eh_monetario = any(campo in chave_lower for campo in campos_monetarios)

            # Também formata se for um número float
            if eh_monetario or isinstance(valor, float):
                item_formatado[chave] = formatar_valor_br(valor)
            else:
                item_formatado[chave] = valor

        dados_formatados.append(item_formatado)

    return dados_formatados


def csv_response(queryset, serializer_class, filename):
    """Return CSV as an :class:`HttpResponse` for the given queryset."""
    if not queryset.exists():
        return Response({"error": "Não há dados para gerar o relatório CSV."},
                       status=status.HTTP_404_NOT_FOUND)

    serializer = serializer_class(queryset, many=True)
    data = serializer.data

    if not data:
        return Response({"error": "Não há dados serializados para gerar o relatório CSV."},
                       status=status.HTTP_404_NOT_FOUND)

    # Formata valores numéricos para o padrão brasileiro (vírgula)
    data_formatada = formatar_dados_br(data)

    field_names = list(data_formatada[0].keys())
    output = StringIO()
    # Usa ponto-e-vírgula como delimitador para melhor compatibilidade com Excel BR
    writer = csv.DictWriter(output, fieldnames=field_names, delimiter=';')
    writer.writeheader()
    writer.writerows(data_formatada)

    response = HttpResponse(output.getvalue(), content_type='text/csv; charset=utf-8')
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    return response
