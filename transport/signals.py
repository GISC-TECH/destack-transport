"""
Signals do app transport para manter consistencia entre modelos.
"""
import hashlib
import logging

from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from transport.models import CTeDocumento, MDFeDocumento, PagamentoAgregado, PagamentoProprio
from transport.services.pagamento_service import (
    sincronizar_status_pagamento_agregado,
    sincronizar_status_pagamento_proprio,
)

logger = logging.getLogger(__name__)


@receiver(post_save, sender=PagamentoAgregado)
def sync_pagamento_agregado_status(sender, instance, **kwargs):
    """Sincroniza CTeDocumento.pago quando PagamentoAgregado e alterado."""
    sincronizar_status_pagamento_agregado(instance)


@receiver(post_save, sender=PagamentoProprio)
def sync_pagamento_proprio_status(sender, instance, **kwargs):
    """Sincroniza CTeDocumento.pago quando PagamentoProprio e alterado."""
    sincronizar_status_pagamento_proprio(instance)


def _calcular_checksum_xml(texto_xml):
    """Retorna o SHA-256 hexadecimal de um conteudo XML."""
    if not texto_xml:
        return None
    return hashlib.sha256(texto_xml.encode("utf-8")).hexdigest()


@receiver(post_save, sender=CTeDocumento)
def gerar_checksum_cte(sender, instance, **kwargs):
    """Gera o checksum automaticamente a partir do xml_original quando ainda nao preenchido."""
    if instance.xml_original and not instance.checksum:
        checksum = _calcular_checksum_xml(instance.xml_original)
        if checksum and checksum != instance.checksum:
            CTeDocumento.objects.filter(pk=instance.pk).update(checksum=checksum)


@receiver(post_save, sender=MDFeDocumento)
def gerar_checksum_mdfe(sender, instance, **kwargs):
    """Gera o checksum automaticamente a partir do xml_original quando ainda nao preenchido."""
    if instance.xml_original and not instance.checksum:
        checksum = _calcular_checksum_xml(instance.xml_original)
        if checksum and checksum != instance.checksum:
            MDFeDocumento.objects.filter(pk=instance.pk).update(checksum=checksum)


def _invalidar_cache_dashboards():
    """Remove entradas de cache dos dashboards do Redis."""
    try:
        # Import local evita ciclos entre transport.views e transport.signals
        from transport.views.dashboard_views import invalidar_cache_dashboards
        invalidar_cache_dashboards()
    except Exception as exc:
        logger.debug("Falha ao invalidar cache de dashboards: %s", exc)


# Modelos que, ao serem alterados, devem invalidar cache dos dashboards
_DASHBOARD_CACHE_MODELS = [
    CTeDocumento,
    MDFeDocumento,
    PagamentoAgregado,
    PagamentoProprio,
]


for _model in _DASHBOARD_CACHE_MODELS:
    post_save.connect(
        lambda sender, instance, **kwargs: _invalidar_cache_dashboards(),
        sender=_model,
        dispatch_uid=f"invalidar_dashboard_cache_post_save_{_model._meta.label}",
    )
    post_delete.connect(
        lambda sender, instance, **kwargs: _invalidar_cache_dashboards(),
        sender=_model,
        dispatch_uid=f"invalidar_dashboard_cache_post_delete_{_model._meta.label}",
    )
