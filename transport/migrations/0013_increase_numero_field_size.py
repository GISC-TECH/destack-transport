# Generated manually

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('transport', '0012_add_email_telefone_cliente'),
    ]

    operations = [
        migrations.AlterField(
            model_name='endereco',
            name='numero',
            field=models.CharField(blank=True, max_length=60, null=True),
        ),
    ]
