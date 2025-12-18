# Generated manually

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('transport', '0009_add_cte_fields_to_pagamentoproprio'),
    ]

    operations = [
        migrations.AddField(
            model_name='pagamentoproprio',
            name='data_prevista',
            field=models.DateField(blank=True, null=True, verbose_name='Data Prevista Pagamento'),
        ),
    ]
