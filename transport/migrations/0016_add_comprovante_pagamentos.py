# Generated migration for comprovante field in PagamentoAgregado and PagamentoProprio

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('transport', '0015_add_desconto_pagamento_agregado'),
    ]

    operations = [
        migrations.AddField(
            model_name='pagamentoagregado',
            name='comprovante',
            field=models.FileField(
                blank=True,
                help_text='Comprovante de pagamento (PDF, imagem)',
                null=True,
                upload_to='comprovantes/agregados/%Y/%m/',
                verbose_name='Comprovante'
            ),
        ),
        migrations.AddField(
            model_name='pagamentoproprio',
            name='comprovante',
            field=models.FileField(
                blank=True,
                help_text='Comprovante de pagamento (PDF, imagem)',
                null=True,
                upload_to='comprovantes/proprios/%Y/%m/',
                verbose_name='Comprovante'
            ),
        ),
    ]
