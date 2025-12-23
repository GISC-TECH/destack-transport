# Generated manually

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('transport', '0011_cte_obrigatorio_pagamentos'),
    ]

    operations = [
        migrations.AddField(
            model_name='cliente',
            name='email',
            field=models.EmailField(blank=True, max_length=255, null=True, verbose_name='E-mail'),
        ),
        migrations.AddField(
            model_name='cliente',
            name='telefone',
            field=models.CharField(blank=True, max_length=20, null=True, verbose_name='Telefone'),
        ),
    ]
