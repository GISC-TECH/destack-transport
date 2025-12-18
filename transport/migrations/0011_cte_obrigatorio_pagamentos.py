# Generated manually - CT-e obrigatorio para pagamentos

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('transport', '0010_add_data_prevista_to_pagamentoproprio'),
    ]

    operations = [
        # Alterar valor_repassado em PagamentoAgregado - remover editable=False
        migrations.AlterField(
            model_name='pagamentoagregado',
            name='valor_repassado',
            field=models.DecimalField(decimal_places=2, max_digits=12, verbose_name='Valor Repasse (R$)'),
        ),
        # Alterar cte em PagamentoProprio - de ForeignKey para OneToOneField obrigatorio
        migrations.AlterField(
            model_name='pagamentoproprio',
            name='cte',
            field=models.OneToOneField(
                on_delete=django.db.models.deletion.CASCADE,
                related_name='pagamento_proprio',
                to='transport.ctedocumento',
                verbose_name='CT-e Vinculado'
            ),
        ),
        # Alterar valor_total_pagar em PagamentoProprio - remover editable=False
        migrations.AlterField(
            model_name='pagamentoproprio',
            name='valor_total_pagar',
            field=models.DecimalField(decimal_places=2, max_digits=12, verbose_name='Valor Total a Pagar (R$)'),
        ),
    ]
