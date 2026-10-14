# Generated manually: recria Fatura para Contas a Receber e adiciona FaturaItem.

import datetime
import django.db.models.deletion
import uuid
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('transport', '0033_contas_a_pagar'),
    ]

    operations = [
        # Remove o vínculo de TransacaoBancaria para permitir recriar Fatura.
        migrations.RemoveField(
            model_name='transacaobancaria',
            name='fatura',
        ),
        # Remove o modelo Fatura antigo (tabela vazia em ambientes existentes).
        migrations.DeleteModel(
            name='Fatura',
        ),
        # Recria Fatura com a estrutura de Contas a Receber.
        migrations.CreateModel(
            name='Fatura',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('numero', models.CharField(db_index=True, max_length=30, unique=True, verbose_name='Número')),
                ('data_emissao', models.DateField(default=datetime.date.today, verbose_name='Data de Emissão')),
                ('data_vencimento', models.DateField(verbose_name='Data de Vencimento')),
                ('status', models.CharField(choices=[('rascunho', 'Rascunho'), ('enviada', 'Enviada'), ('paga', 'Paga'), ('atrasada', 'Atrasada'), ('cancelada', 'Cancelada')], db_index=True, default='rascunho', max_length=20, verbose_name='Status')),
                ('valor_total', models.DecimalField(decimal_places=2, default=0.0, max_digits=15, verbose_name='Valor Total')),
                ('observacao', models.TextField(blank=True, null=True, verbose_name='Observação')),
                ('criado_em', models.DateTimeField(auto_now_add=True)),
                ('atualizado_em', models.DateTimeField(auto_now=True)),
                ('cliente', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='faturas', to='transport.cliente', verbose_name='Cliente')),
            ],
            options={
                'verbose_name': 'Fatura',
                'verbose_name_plural': 'Faturas',
                'db_table': 'fatura',
                'ordering': ['-data_emissao', '-criado_em'],
            },
        ),
        # Cria o modelo de itens de fatura.
        migrations.CreateModel(
            name='FaturaItem',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('descricao', models.CharField(max_length=255, verbose_name='Descrição')),
                ('valor', models.DecimalField(decimal_places=2, max_digits=15, verbose_name='Valor')),
                ('criado_em', models.DateTimeField(auto_now_add=True)),
                ('cte', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='faturas_itens', to='transport.ctedocumento', verbose_name='CT-e')),
                ('fatura', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='itens', to='transport.fatura', verbose_name='Fatura')),
            ],
            options={
                'verbose_name': 'Item de Fatura',
                'verbose_name_plural': 'Itens de Fatura',
                'db_table': 'fatura_item',
                'ordering': ['criado_em'],
                'constraints': [models.UniqueConstraint(condition=models.Q(('cte__isnull', False)), fields=('cte',), name='unique_fatura_item_cte')],
            },
        ),
        # Re-adiciona o vínculo de TransacaoBancaria com a nova Fatura (UUID).
        migrations.AddField(
            model_name='transacaobancaria',
            name='fatura',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='transacoes', to='transport.fatura', verbose_name='Fatura'),
        ),
    ]
