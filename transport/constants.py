# transport/constants.py
"""
Constantes de negócio utilizadas no módulo transport.

Este arquivo centraliza valores padrão e constantes que são usados
em múltiplos lugares do código para facilitar manutenção.
"""

from decimal import Decimal

# Percentual padrão de repasse para pagamentos agregados (25%)
# Usado quando não é especificado um percentual na geração de pagamentos em lote
DEFAULT_PAYMENT_PERCENTAGE = Decimal('25.0')

# Número de dias padrão para alertas de documentos vencendo
DEFAULT_EXPIRATION_ALERT_DAYS = 30

# Limite máximo de registros para exportação CSV
MAX_EXPORT_RECORDS = 10000
