# Generated manually

from django.db import migrations


def limpar_dist_km_zero(apps, schema_editor):
    """Converte dist_km=0 para NULL, preservando valores reais maiores que zero."""
    CTeIdentificacao = apps.get_model('transport', 'CTeIdentificacao')
    CTeIdentificacao.objects.filter(dist_km=0).update(dist_km=None)


def reversar_dist_km_zero(apps, schema_editor):
    """Reversão: não restaura zeros, pois não há como distinguir origem."""
    pass


class Migration(migrations.Migration):
    dependencies = [
        ('transport', '0049_ajustes_auditoria_fases_1_a_5'),
    ]

    operations = [
        migrations.RunPython(limpar_dist_km_zero, reversar_dist_km_zero),
    ]
