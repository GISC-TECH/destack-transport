# Generated manually

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('transport', '0013_increase_numero_field_size'),
    ]

    operations = [
        migrations.AddField(
            model_name='motorista',
            name='toxicologico_validade',
            field=models.DateField(
                blank=True,
                null=True,
                verbose_name='Exame Toxicológico - Validade',
                help_text='Exame toxicológico obrigatório para motoristas profissionais'
            ),
        ),
        migrations.AddField(
            model_name='motorista',
            name='aso_validade',
            field=models.DateField(
                blank=True,
                null=True,
                verbose_name='ASO - Validade',
                help_text='Atestado de Saúde Ocupacional'
            ),
        ),
    ]
