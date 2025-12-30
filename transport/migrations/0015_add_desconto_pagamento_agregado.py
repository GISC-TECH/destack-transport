# Generated migration for desconto field in PagamentoAgregado

from decimal import Decimal
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('transport', '0014_add_toxicologico_aso_validade'),
    ]

    operations = [
        migrations.AddField(
            model_name='pagamentoagregado',
            name='desconto',
            field=models.DecimalField(
                decimal_places=2,
                default=Decimal('0.00'),
                help_text='Desconto aplicado sobre o valor a repassar',
                max_digits=12,
                verbose_name='Desconto (R$)'
            ),
        ),
    ]
