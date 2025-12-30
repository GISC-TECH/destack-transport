# Generated migration for comprovante_pagamento field in CTeDocumento

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('transport', '0016_add_comprovante_pagamentos'),
    ]

    operations = [
        migrations.AddField(
            model_name='ctedocumento',
            name='comprovante_pagamento',
            field=models.FileField(
                blank=True,
                help_text='Comprovante de pagamento (PDF, imagem)',
                null=True,
                upload_to='comprovantes/ctes/%Y/%m/',
                verbose_name='Comprovante de Pagamento'
            ),
        ),
    ]
