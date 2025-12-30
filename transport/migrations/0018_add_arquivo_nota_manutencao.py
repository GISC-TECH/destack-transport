# Generated migration for arquivo_nota field in ManutencaoVeiculo

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('transport', '0017_add_comprovante_cte'),
    ]

    operations = [
        migrations.AddField(
            model_name='manutencaoveiculo',
            name='arquivo_nota',
            field=models.FileField(
                blank=True,
                help_text='Arquivo da nota fiscal (PDF, imagem)',
                null=True,
                upload_to='manutencoes/notas/%Y/%m/',
                verbose_name='Arquivo Nota Fiscal'
            ),
        ),
    ]
