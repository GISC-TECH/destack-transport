# Generated manually

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('transport', '0008_alterar_arquivo_xml_evento_para_textfield'),
    ]

    operations = [
        migrations.AlterModelOptions(
            name='pagamentoproprio',
            options={'ordering': ['-periodo', 'veiculo__placa'], 'verbose_name': 'Pagamento Próprio', 'verbose_name_plural': 'Pagamentos Próprios'},
        ),
        migrations.AlterUniqueTogether(
            name='pagamentoproprio',
            unique_together=set(),
        ),
        migrations.AddField(
            model_name='pagamentoproprio',
            name='cte',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='pagamentos_proprios', to='transport.ctedocumento', verbose_name='CT-e Vinculado'),
        ),
        migrations.AddField(
            model_name='pagamentoproprio',
            name='cte_numero',
            field=models.CharField(blank=True, max_length=20, null=True, verbose_name='Número do CT-e'),
        ),
        migrations.AddField(
            model_name='pagamentoproprio',
            name='motorista_cpf',
            field=models.CharField(blank=True, max_length=14, null=True, verbose_name='CPF do Motorista'),
        ),
        migrations.AddField(
            model_name='pagamentoproprio',
            name='motorista_nome',
            field=models.CharField(blank=True, max_length=255, null=True, verbose_name='Nome do Motorista'),
        ),
    ]
