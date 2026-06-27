# transport/models.py
import uuid
from datetime import date
from decimal import Decimal
from django.db import models
from django.db.models import JSONField
from django.utils import timezone

from .validators import normalizar_placa, validar_cpf, validar_cnpj, validar_ie

# ---------------------------------------------------------------------------
#  B A S E S   A B S T R A T A S
# ---------------------------------------------------------------------------
class Endereco(models.Model):
    """Endereço genérico usado por emitente, remetente, destinatário, etc."""
    logradouro = models.CharField(max_length=60, null=True, blank=True)
    numero = models.CharField(max_length=60, null=True, blank=True)
    complemento = models.CharField(max_length=60, null=True, blank=True)
    bairro = models.CharField(max_length=60, null=True, blank=True)
    codigo_municipio = models.CharField(max_length=7, null=True, blank=True)
    nome_municipio = models.CharField(max_length=60, null=True, blank=True)
    cep = models.CharField(max_length=8, null=True, blank=True)
    uf = models.CharField(max_length=2, null=True, blank=True)
    codigo_pais = models.CharField(max_length=4, default="1058", null=True, blank=True)
    nome_pais = models.CharField(max_length=60, default="BRASIL", null=True, blank=True)

    # Não é abstrato para permitir herança concreta
    # class Meta:
    #    abstract = True


class EntidadeFiscal(Endereco):
    """Pessoa jurídica ou física envolvida no CT-e ou MDF-e."""
    cnpj = models.CharField(max_length=14, null=True, blank=True)
    cpf = models.CharField(max_length=11, null=True, blank=True)
    ie = models.CharField("Inscrição Estadual", max_length=14, null=True, blank=True)
    razao_social = models.CharField("Razão Social/Nome", max_length=60, null=True, blank=True)
    nome_fantasia = models.CharField("Nome Fantasia", max_length=60, null=True, blank=True)
    telefone = models.CharField(max_length=14, null=True, blank=True)
    email = models.EmailField(null=True, blank=True) # Adicionado para abranger casos

    class Meta:
        abstract = True

# ---------------------------------------------------------------------------
#  M O D E L O S   C T - e   (Conhecimento de Transporte Eletrônico)
# ---------------------------------------------------------------------------

class CTeDocumento(models.Model):
    """Raiz do CT-e – mantém a chave e o XML bruto."""
    MODALIDADE_CHOICES = [('CIF','CIF'), ('FOB','FOB')] # Novas Opções CIF/FOB
    STATUS_CHOICES = [
        ('autorizado', 'Autorizado'),
        ('cancelado', 'Cancelado'),
        ('encerrado', 'Encerrado'),
        ('denegado', 'Denegado'),
        ('inutilizado', 'Inutilizado'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    chave = models.CharField("Chave CT-e", max_length=44, unique=True, db_index=True)
    versao = models.CharField("Versão Schema", max_length=5)
    xml_original = models.TextField(null=True, blank=True) # Permite nulo inicialmente
    arquivo_xml = models.FileField(upload_to='xml_ctes/', null=True, blank=True, verbose_name="Arquivo XML")
    checksum = models.CharField("Checksum SHA-256", max_length=64, blank=True, null=True, db_index=True)
    data_arquivamento = models.DateTimeField("Data de Arquivamento", auto_now_add=True)
    caminho_arquivo = models.CharField("Caminho do Arquivo", max_length=255, blank=True, null=True)
    data_upload = models.DateTimeField(auto_now_add=True)
    processado = models.BooleanField(default=False, help_text="Indica se o XML foi processado e os dados extraídos.")
    modalidade = models.CharField("Modalidade Frete", max_length=3, choices=MODALIDADE_CHOICES, null=True, blank=True, db_index=True)
    status = models.CharField("Status", max_length=15, choices=STATUS_CHOICES, default='autorizado', db_index=True)

    # Campos de controle de pagamento (inseridos pelo admin)
    pago = models.BooleanField("Pago", default=False, db_index=True)
    data_pagamento = models.DateTimeField("Data do Pagamento", null=True, blank=True)
    observacao_pagamento = models.TextField("Observação do Pagamento", null=True, blank=True)
    comprovante_pagamento = models.FileField(
        "Comprovante de Pagamento",
        upload_to='comprovantes/ctes/%Y/%m/',
        null=True,
        blank=True,
        help_text="Comprovante de pagamento (PDF, imagem)"
    )

    # Relacionamento com MDF-e (definido mais abaixo via add_to_class)
    # mdfe_vinculado = models.ManyToManyField('MDFeDocumento', through='MDFeDocumentosVinculados', related_name='ctes_transportados')

    class Meta:
        db_table = "cte_documento"
        verbose_name = "CT-e (Documento)"
        verbose_name_plural = "CT-e (Documentos)"
        ordering = ['-identificacao__data_emissao']
        indexes = [
            models.Index(fields=['modalidade', 'data_upload']),
            models.Index(fields=['processado', 'data_upload']),
            models.Index(fields=['pago', 'data_pagamento']),
            models.Index(fields=['pago', 'data_upload']),
        ]

    def __str__(self):
        return self.chave

class CTeIdentificacao(models.Model):
    """<ide>"""
    cte = models.OneToOneField(CTeDocumento, on_delete=models.CASCADE, related_name="identificacao")
    # Campos tornados nullable: o parser não fabrica mais valores padrão quando ausentes (integridade de dados)
    codigo_uf = models.PositiveSmallIntegerField("Código UF Emitente", null=True, blank=True)
    codigo_control = models.CharField("Código Numérico Chave", max_length=8, null=True, blank=True)
    cfop = models.CharField("CFOP", max_length=4, null=True, blank=True)
    natureza_operacao = models.CharField("Natureza da Operação", max_length=60, null=True, blank=True)
    modelo = models.CharField("Modelo", max_length=2, null=True, blank=True)
    serie = models.PositiveSmallIntegerField("Série", null=True, blank=True)
    numero = models.PositiveIntegerField("Número CT-e", null=True, blank=True)
    data_emissao = models.DateTimeField("Data/Hora Emissão", db_index=True, null=True, blank=True)
    tipo_impressao = models.PositiveSmallIntegerField("Tipo Impressão DACTE", null=True, blank=True)
    tipo_emissao = models.PositiveSmallIntegerField("Tipo Emissão", null=True, blank=True)
    digito_verificador = models.PositiveSmallIntegerField("Dígito Verificador Chave", null=True, blank=True)
    ambiente = models.PositiveSmallIntegerField("Ambiente (1=Prod, 2=Hom)", null=True, blank=True)
    tipo_cte = models.PositiveSmallIntegerField("Tipo CT-e (0=Normal, 1=Compl, 2=Anul, 3=Subst)", null=True, blank=True)
    processo_emissao = models.PositiveSmallIntegerField("Processo Emissão", null=True, blank=True)
    versao_processo = models.CharField("Versão Processo Emissão", max_length=60, null=True, blank=True)
    chave_referenciada = models.CharField("Chave CT-e Referenciada", max_length=44, null=True, blank=True)
    codigo_mun_envio = models.CharField("Código Município Envio", max_length=7, null=True, blank=True)
    nome_mun_envio = models.CharField("Nome Município Envio", max_length=60, null=True, blank=True)
    uf_envio = models.CharField("UF Envio", max_length=2, null=True, blank=True)
    modal = models.CharField("Modal", max_length=2, null=True, blank=True)
    tipo_servico = models.CharField("Tipo Serviço", max_length=1, null=True, blank=True)
    codigo_mun_ini = models.CharField("Código Município Início Prest.", max_length=7, null=True, blank=True)
    nome_mun_ini = models.CharField("Nome Município Início Prest.", max_length=60, null=True, blank=True)
    uf_ini = models.CharField("UF Início Prest.", max_length=2, null=True, blank=True)
    codigo_mun_fim = models.CharField("Código Município Fim Prest.", max_length=7, null=True, blank=True)
    nome_mun_fim = models.CharField("Nome Município Fim Prest.", max_length=60, null=True, blank=True)
    uf_fim = models.CharField("UF Fim Prest.", max_length=2, null=True, blank=True)
    retira = models.BooleanField("Retira Mercadoria", default=False)
    detalhes_retira = models.TextField("Detalhes Retira", null=True, blank=True)
    ind_ie_tomador = models.PositiveSmallIntegerField("Indicador IE Tomador", null=True, blank=True)

    TOMA_CHOICES = [
        (0, 'Remetente'),
        (1, 'Expedidor'),
        (2, 'Recebedor'),
        (3, 'Destinatário'),
        (4, 'Outros'),
    ]
    toma = models.PositiveSmallIntegerField(
        "Tomador Serviço",
        choices=TOMA_CHOICES,
        null=True,
        blank=True,
        help_text="0=Remetente, 1=Expedidor, 2=Recebedor, 3=Destinatário, 4=Outros"
    )

    # Tomador (se for '4=Outros')
    tomador_cnpj = models.CharField("CNPJ Tomador", max_length=14, null=True, blank=True)
    tomador_cpf = models.CharField("CPF Tomador", max_length=11, null=True, blank=True)
    tomador_ie = models.CharField("IE Tomador", max_length=14, null=True, blank=True)
    tomador_razao_social = models.CharField("Razão Social Tomador", max_length=60, null=True, blank=True)
    tomador_nome_fantasia = models.CharField("Nome Fantasia Tomador", max_length=60, null=True, blank=True)
    tomador_telefone = models.CharField("Telefone Tomador", max_length=14, null=True, blank=True)
    tomador_endereco = models.ForeignKey('Endereco', on_delete=models.SET_NULL, related_name='+', null=True, blank=True)

    # Novo campo de quilometragem
    dist_km = models.PositiveIntegerField("Distância KM", null=True, blank=True) # NOVO CAMPO

    class Meta:
        db_table = "cte_identificacao"
        verbose_name = "CT-e – Identificação"
        verbose_name_plural = verbose_name
        indexes = [
            models.Index(fields=['numero', 'serie']),
            models.Index(fields=['uf_ini', 'uf_fim']),
            models.Index(fields=['data_emissao', 'numero']),
        ]

class CTeComplemento(models.Model):
    """<compl>"""
    cte = models.OneToOneField(CTeDocumento, on_delete=models.CASCADE, related_name="complemento")
    x_carac_ad = models.CharField("Característica Adicional Transporte", max_length=15, null=True, blank=True)
    x_carac_ser = models.CharField("Característica Adicional Serviço", max_length=30, null=True, blank=True)
    x_emi = models.CharField("Nome Emissor Complementar", max_length=60, null=True, blank=True)
    # <fluxo> omitido por complexidade, pode ser JSONField se necessário
    # <Entrega>
    entrega_sem_data = models.BooleanField("Entrega sem Data Definida", default=False)
    entrega_com_data_d_prev = models.DateField("Data Programada", null=True, blank=True)
    entrega_no_periodo_d_ini = models.DateField("Início Período", null=True, blank=True)
    entrega_no_periodo_d_fin = models.DateField("Fim Período", null=True, blank=True)
    entrega_sem_hora = models.BooleanField("Entrega sem Hora Definida", default=False)
    entrega_com_hora_h_prev = models.TimeField("Hora Programada", null=True, blank=True)
    entrega_no_periodo_h_ini = models.TimeField("Início Horário", null=True, blank=True)
    entrega_no_periodo_h_fin = models.TimeField("Fim Horário", null=True, blank=True)
    orig_cod_mun = models.CharField("Código Município Origem", max_length=7, null=True, blank=True)
    orig_nome_mun = models.CharField("Nome Município Origem", max_length=60, null=True, blank=True)
    orig_uf = models.CharField("UF Origem", max_length=2, null=True, blank=True)
    dest_cod_mun = models.CharField("Código Município Destino", max_length=7, null=True, blank=True)
    dest_nome_mun = models.CharField("Nome Município Destino", max_length=60, null=True, blank=True)
    dest_uf = models.CharField("UF Destino", max_length=2, null=True, blank=True)
    x_obs = models.TextField("Observações Gerais", null=True, blank=True)

    class Meta:
        db_table = "cte_complemento"
        verbose_name = "CT-e – Complemento"
        verbose_name_plural = verbose_name

class CTeObservacaoContribuinte(models.Model):
    """<ObsCont>"""
    complemento = models.ForeignKey(CTeComplemento, on_delete=models.CASCADE, related_name="observacoes_contribuinte")
    campo = models.CharField("Identificação Campo", max_length=20)
    texto = models.TextField("Conteúdo")

    class Meta:
        db_table = "cte_obs_contribuinte"
        verbose_name = "CT-e – Observação Contribuinte"
        verbose_name_plural = "CT-e – Observações Contribuinte"

class CTeObservacaoFisco(models.Model):
    """<ObsFisco>"""
    complemento = models.ForeignKey(CTeComplemento, on_delete=models.CASCADE, related_name="observacoes_fisco")
    campo = models.CharField("Identificação Campo", max_length=20)
    texto = models.TextField("Conteúdo")

    class Meta:
        db_table = "cte_obs_fisco"
        verbose_name = "CT-e – Observação Fisco"
        verbose_name_plural = "CT-e – Observações Fisco"

# --- Entidades Fiscais do CT-e ---
class CTeEmitente(EntidadeFiscal):
    """<emit>"""
    cte = models.OneToOneField(CTeDocumento, on_delete=models.CASCADE, related_name="emitente")
    crt = models.CharField("CRT", max_length=1, null=True, blank=True) # 1=SN; 2=SN Excesso; 3=Regime Normal

    class Meta:
        db_table = "cte_emitente"
        verbose_name = "CT-e – Emitente"
        verbose_name_plural = verbose_name

class CTeRemetente(EntidadeFiscal):
    """<rem>"""
    cte = models.OneToOneField(CTeDocumento, on_delete=models.CASCADE, related_name="remetente")

    class Meta:
        db_table = "cte_remetente"
        verbose_name = "CT-e – Remetente"
        verbose_name_plural = verbose_name

class CTeExpedidor(EntidadeFiscal):
    """<exped>"""
    cte = models.OneToOneField(CTeDocumento, on_delete=models.CASCADE, related_name="expedidor")

    class Meta:
        db_table = "cte_expedidor"
        verbose_name = "CT-e – Expedidor"
        verbose_name_plural = verbose_name

class CTeRecebedor(EntidadeFiscal):
    """<receb>"""
    cte = models.OneToOneField(CTeDocumento, on_delete=models.CASCADE, related_name="recebedor")

    class Meta:
        db_table = "cte_recebedor"
        verbose_name = "CT-e – Recebedor"
        verbose_name_plural = verbose_name

class CTEDestinatario(EntidadeFiscal):
    """<dest>"""
    cte = models.OneToOneField(CTeDocumento, on_delete=models.CASCADE, related_name="destinatario")
    isuf = models.CharField("Inscrição SUFRAMA", max_length=9, null=True, blank=True)

    class Meta:
        db_table = "cte_destinatario"
        verbose_name = "CT-e – Destinatário"
        verbose_name_plural = verbose_name

# --- Valores ---
class CTePrestacaoServico(models.Model):
    """<vPrest>"""
    cte = models.OneToOneField(CTeDocumento, on_delete=models.CASCADE, related_name="prestacao")
    valor_total_prestado = models.DecimalField("Valor Total Prestação", max_digits=15, decimal_places=2, null=True, blank=True)
    valor_recebido = models.DecimalField("Valor a Receber", max_digits=15, decimal_places=2, null=True, blank=True)
    # Novos campos CIF/FOB
    valor_cif = models.DecimalField("Valor Frete CIF", max_digits=15, decimal_places=2, null=True, blank=True) # NOVO CAMPO
    valor_fob = models.DecimalField("Valor Frete FOB", max_digits=15, decimal_places=2, null=True, blank=True) # NOVO CAMPO

    class Meta:
        db_table = "cte_prestacao"
        verbose_name = "CT-e – Prestação do Serviço"
        verbose_name_plural = verbose_name

class CTeComponenteValor(models.Model):
    """<Comp>"""
    prestacao = models.ForeignKey(CTePrestacaoServico, on_delete=models.CASCADE, related_name="componentes")
    nome = models.CharField("Nome Componente", max_length=60) # FRETE PESO, FRETE VALOR, SEC/CAT, ADEME, PEDAGIO, OUTROS, etc.
    valor = models.DecimalField("Valor Componente", max_digits=15, decimal_places=2)

    class Meta:
        db_table = "cte_comp_valor"
        verbose_name = "CT-e – Componente de Valor"
        verbose_name_plural = verbose_name

# --- Tributação ---
class CTeTributos(models.Model):
    """<imp>"""
    cte = models.OneToOneField(CTeDocumento, on_delete=models.CASCADE, related_name="tributos")
    icms = JSONField("Detalhes ICMS (bruto)", null=True, blank=True, help_text="Estrutura JSON bruta do ICMS aplicável.")
    valor_total_tributos = models.DecimalField("Valor Total Tributos", max_digits=15, decimal_places=2, null=True, blank=True) # <vTotTrib>
    info_ad_fisco = models.TextField("Informações Adicionais Fisco", null=True, blank=True) # <infAdFisco>

    # Campos ICMS explícitos (consultáveis) — Fase B
    icms_tipo = models.CharField("Grupo ICMS", max_length=12, null=True, blank=True, help_text="ICMS00/20/45/60/90/OutraUF/SN")
    icms_cst = models.CharField("CST ICMS", max_length=2, null=True, blank=True)
    icms_vbc = models.DecimalField("Base de Cálculo ICMS", max_digits=15, decimal_places=2, null=True, blank=True)
    icms_pred_bc = models.DecimalField("% Redução Base ICMS", max_digits=7, decimal_places=4, null=True, blank=True)
    icms_picms = models.DecimalField("Alíquota ICMS", max_digits=7, decimal_places=4, null=True, blank=True)
    icms_vicms = models.DecimalField("Valor ICMS", max_digits=15, decimal_places=2, null=True, blank=True)
    icms_vcred = models.DecimalField("Crédito ICMS (SN)", max_digits=15, decimal_places=2, null=True, blank=True)
    icms_picms_st = models.DecimalField("Alíquota ICMS ST", max_digits=7, decimal_places=4, null=True, blank=True)
    icms_vbc_st = models.DecimalField("Base de Cálculo ICMS ST", max_digits=15, decimal_places=2, null=True, blank=True)
    icms_vicms_st = models.DecimalField("Valor ICMS ST", max_digits=15, decimal_places=2, null=True, blank=True)
    # ICMSUFFim (partilha) — extraído em JSON quando presente
    icms_uffim = JSONField("ICMS UF Fim (partilha)", null=True, blank=True)

    class Meta:
        db_table = "cte_tributos"
        verbose_name = "CT-e – Impostos"
        verbose_name_plural = verbose_name

# --- Carga ---
class CTeCarga(models.Model):
    """<infCarga>"""
    cte = models.OneToOneField(CTeDocumento, on_delete=models.CASCADE, related_name="carga")
    valor_carga = models.DecimalField("Valor Total Mercadorias", max_digits=15, decimal_places=2, null=True, blank=True)
    produto_predominante = models.CharField("Produto Predominante", max_length=60, null=True, blank=True)
    outras_caracteristicas = models.CharField("Outras Características Carga", max_length=30, null=True, blank=True)
    valor_carga_averbada = models.DecimalField("Valor Carga Averbada (Seguro)", max_digits=15, decimal_places=2, null=True, blank=True) # <vCargaAverb>

    class Meta:
        db_table = "cte_carga"
        verbose_name = "CT-e – Carga"
        verbose_name_plural = verbose_name

class CTeQuantidadeCarga(models.Model):
    """<infQ>"""
    carga = models.ForeignKey(CTeCarga, on_delete=models.CASCADE, related_name="quantidades")
    codigo_unidade = models.CharField("Código Unidade Medida", max_length=2) # 00=M3; 01=KG; 02=TON; 03=UNIDADE; 04=LITROS; 05=MMBTU
    tipo_medida = models.CharField("Tipo Medida", max_length=20) # PESO BRUTO, PESO DECLARADO, PESO CUBADO, etc.
    quantidade = models.DecimalField("Quantidade", max_digits=15, decimal_places=4)

    class Meta:
        db_table = "cte_carga_quantidade"
        verbose_name = "CT-e – Quantidade de Carga"
        verbose_name_plural = verbose_name

# --- Documentos Transportados (NF-e, NF, etc.) ---
class CTeDocumentoTransportado(models.Model):
    """<infDoc> / <infNF> / <infNFe> / <infOutros>"""
    cte = models.ForeignKey(CTeDocumento, on_delete=models.CASCADE, related_name="documentos_transportados")
    tipo_documento = models.CharField("Tipo Documento", max_length=10) # Ex: 'NFe', 'NF', 'Outros'
    chave_nfe = models.CharField("Chave NF-e", max_length=44, null=True, blank=True)
    # Campos para NF (papel)
    modelo_nf = models.CharField("Modelo NF", max_length=2, null=True, blank=True)
    serie_nf = models.CharField("Série NF", max_length=3, null=True, blank=True)
    numero_nf = models.CharField("Número NF", max_length=9, null=True, blank=True)
    data_emissao_nf = models.DateField("Data Emissão NF", null=True, blank=True)
    bc_icms_nf = models.DecimalField("Base ICMS NF", max_digits=15, decimal_places=2, null=True, blank=True)
    valor_icms_nf = models.DecimalField("Valor ICMS NF", max_digits=15, decimal_places=2, null=True, blank=True)
    bc_st_nf = models.DecimalField("Base ICMS ST NF", max_digits=15, decimal_places=2, null=True, blank=True)
    valor_st_nf = models.DecimalField("Valor ICMS ST NF", max_digits=15, decimal_places=2, null=True, blank=True)
    valor_produtos_nf = models.DecimalField("Valor Produtos NF", max_digits=15, decimal_places=2, null=True, blank=True)
    valor_total_nf = models.DecimalField("Valor Total NF", max_digits=15, decimal_places=2, null=True, blank=True)
    cfop_pred_nf = models.CharField("CFOP Predominante NF", max_length=4, null=True, blank=True)
    peso_total_kg_nf = models.DecimalField("Peso Total (Kg) NF", max_digits=15, decimal_places=3, null=True, blank=True)
    pin_suframa_nf = models.CharField("PIN SUFRAMA NF", max_length=9, null=True, blank=True)
    data_prevista_nf = models.DateField("Data Prevista Entrega NF", null=True, blank=True)  # <dPrev>
    # Unidades de carga/transporte (infUnidCarga/infUnidTransp) — capturado integralmente em JSON (Fase C)
    unidades_transporte = JSONField("Unidades de Transporte/Carga", null=True, blank=True)
    # Campos para Outros
    tipo_doc_outros = models.CharField("Tipo Doc Outros", max_length=2, null=True, blank=True)
    desc_outros = models.CharField("Descrição Outros", max_length=100, null=True, blank=True)
    numero_outros = models.CharField("Número Outros", max_length=30, null=True, blank=True)
    data_emissao_outros = models.DateField("Data Emissão Outros", null=True, blank=True)
    valor_doc_outros = models.DecimalField("Valor Doc Outros", max_digits=15, decimal_places=2, null=True, blank=True)

    class Meta:
        db_table = "cte_doc_transportado"
        verbose_name = "CT-e – Documento Transportado"
        verbose_name_plural = "CT-e – Documentos Transportados"

# --- Seguros ---
class CTeSeguro(models.Model):
    """<seg>"""
    cte = models.ForeignKey(CTeDocumento, on_delete=models.CASCADE, related_name="seguros")
    responsavel = models.CharField("Responsável Seguro", max_length=1, null=True, blank=True) # 0=Remetente; 1=Expedidor; ... 5=Emitente CT-e; 6=Tomador
    nome_seguradora = models.CharField("Nome Seguradora", max_length=30, null=True, blank=True)
    numero_apolice = models.CharField("Número Apólice", max_length=20, null=True, blank=True)
    numero_averbacao = models.CharField("Número Averbação", max_length=20, null=True, blank=True)
    valor_carga_averbada = models.DecimalField("Valor Carga (Averbação)", max_digits=15, decimal_places=2, null=True, blank=True)
    valor_seguro = models.DecimalField("Valor do Seguro", max_digits=15, decimal_places=2, null=True, blank=True)  # <vSeg>/<valSeg>

    class Meta:
        db_table = "cte_seguro"
        verbose_name = "CT-e – Seguro"
        verbose_name_plural = verbose_name

# --- Informações Modal (Rodoviário) ---
class CTeModalRodoviario(models.Model):
    """<infModal versaoModal="4.00"><rodo>"""
    cte = models.OneToOneField(CTeDocumento, on_delete=models.CASCADE, related_name="modal_rodoviario")
    rntrc = models.CharField("RNTRC", max_length=8, null=True, blank=True)
    ciot = models.CharField("CIOT", max_length=12, null=True, blank=True)  # <infCIOT>/<CIOT>
    data_prevista_entrega = models.DateField("Data Prevista Entrega", null=True, blank=True)
    lotacao = models.BooleanField("Indicador Lotação", default=False) # 0=Não; 1=Sim

    class Meta:
        db_table = "cte_modal_rodo"
        verbose_name = "CT-e – Modal Rodoviário"
        verbose_name_plural = verbose_name

class CTeOrdemColeta(models.Model):
    """<occ> — Ordem de Coleta associada ao modal rodoviário."""
    modal = models.ForeignKey(CTeModalRodoviario, on_delete=models.CASCADE, related_name="ordens_coleta")
    serie = models.CharField("Série OC", max_length=3, null=True, blank=True)
    numero = models.CharField("Número OC", max_length=9, null=True, blank=True)
    data_emissao = models.DateField("Data Emissão OC", null=True, blank=True)
    cnpj_emissor = models.CharField("CNPJ Emissor OC", max_length=14, null=True, blank=True)
    cpf_emissor = models.CharField("CPF Emissor OC", max_length=11, null=True, blank=True)
    telefone_emissor = models.CharField("Telefone Emissor OC", max_length=14, null=True, blank=True)

    class Meta:
        db_table = "cte_ordem_coleta"
        verbose_name = "CT-e – Ordem de Coleta"
        verbose_name_plural = "CT-e – Ordens de Coleta"

class CTeValePedagio(models.Model):
    """<infModal/rodo/valePed/disp> — vale-pedágio."""
    cte = models.ForeignKey(CTeDocumento, on_delete=models.CASCADE, related_name="vales_pedagio")
    cnpj_fornecedor = models.CharField("CNPJ Fornecedor", max_length=14, null=True, blank=True)
    cnpj_responsavel = models.CharField("CNPJ Responsável Pgto", max_length=14, null=True, blank=True)
    cpf_responsavel = models.CharField("CPF Responsável Pgto", max_length=11, null=True, blank=True)
    numero_comprovante = models.CharField("Nº Comprovante", max_length=20, null=True, blank=True)
    valor = models.DecimalField("Valor Vale-Pedágio", max_digits=15, decimal_places=2, null=True, blank=True)
    tipo_vale = models.CharField("Tipo Vale", max_length=2, null=True, blank=True)  # <tpValePed>

    class Meta:
        db_table = "cte_vale_pedagio"
        verbose_name = "CT-e – Vale-Pedágio"
        verbose_name_plural = "CT-e – Vales-Pedágio"

class CTeCobranca(models.Model):
    """<cobr> — fatura e duplicatas."""
    cte = models.OneToOneField(CTeDocumento, on_delete=models.CASCADE, related_name="cobranca")
    numero_fatura = models.CharField("Número Fatura", max_length=60, null=True, blank=True)  # <fat><nFat>
    valor_original = models.DecimalField("Valor Original", max_digits=15, decimal_places=2, null=True, blank=True)  # <vOrig>
    valor_desconto = models.DecimalField("Valor Desconto", max_digits=15, decimal_places=2, null=True, blank=True)  # <vDesc>
    valor_liquido = models.DecimalField("Valor Líquido", max_digits=15, decimal_places=2, null=True, blank=True)  # <vLiq>

    class Meta:
        db_table = "cte_cobranca"
        verbose_name = "CT-e – Cobrança"
        verbose_name_plural = verbose_name

class CTeDuplicata(models.Model):
    """<cobr><dup> — duplicata de cobrança."""
    cobranca = models.ForeignKey(CTeCobranca, on_delete=models.CASCADE, related_name="duplicatas")
    numero = models.CharField("Número Duplicata", max_length=60, null=True, blank=True)  # <nDup>
    data_vencimento = models.DateField("Vencimento", null=True, blank=True)  # <dVenc>
    valor = models.DecimalField("Valor Duplicata", max_digits=15, decimal_places=2, null=True, blank=True)  # <vDup>

    class Meta:
        db_table = "cte_duplicata"
        verbose_name = "CT-e – Duplicata"
        verbose_name_plural = "CT-e – Duplicatas"

class CTeFluxoPassagem(models.Model):
    """<compl><fluxo><pass> — passagens/rota do fluxo."""
    cte = models.ForeignKey(CTeDocumento, on_delete=models.CASCADE, related_name="fluxo_passagens")
    nome_passagem = models.CharField("Sigla/Nome Passagem", max_length=15, null=True, blank=True)  # <xPass>
    ordem = models.PositiveSmallIntegerField("Ordem", null=True, blank=True)

    class Meta:
        db_table = "cte_fluxo_passagem"
        verbose_name = "CT-e – Fluxo (Passagem)"
        verbose_name_plural = "CT-e – Fluxo (Passagens)"

class CTeVeiculoRodoviario(models.Model):
    """<veic>"""
    modal = models.ForeignKey(CTeModalRodoviario, on_delete=models.CASCADE, related_name="veiculos")
    placa = models.CharField("Placa", max_length=7)
    renavam = models.CharField("RENAVAM", max_length=11, null=True, blank=True)
    tara = models.PositiveIntegerField("Tara (Kg)", null=True, blank=True)
    cap_kg = models.PositiveIntegerField("Capacidade (Kg)", null=True, blank=True)
    cap_m3 = models.PositiveIntegerField("Capacidade (m³)", null=True, blank=True)
    tipo_proprietario = models.CharField("Tipo Proprietário", max_length=1, null=True, blank=True) # 0=TAC Agregado; 1=TAC Independente; 2=Outros
    tipo_veiculo = models.CharField("Tipo Veículo", max_length=1, null=True, blank=True) # 0=Tração; 1=Reboque
    tipo_rodado = models.CharField("Tipo Rodado", max_length=2, null=True, blank=True)
    tipo_carroceria = models.CharField("Tipo Carroceria", max_length=2, null=True, blank=True)
    uf_licenciamento = models.CharField("UF Licenciamento", max_length=2, null=True, blank=True)

    # Proprietário
    prop_cnpj = models.CharField("CNPJ Proprietário", max_length=14, null=True, blank=True)
    prop_cpf = models.CharField("CPF Proprietário", max_length=11, null=True, blank=True)
    prop_rntrc = models.CharField("RNTRC Proprietário", max_length=8, null=True, blank=True)
    prop_razao_social = models.CharField("Razão Social Proprietário", max_length=60, null=True, blank=True)
    prop_ie = models.CharField("IE Proprietário", max_length=14, null=True, blank=True)
    prop_uf = models.CharField("UF Proprietário", max_length=2, null=True, blank=True)

    @property
    def placa_normalizada(self):
        """Placa sem formatação, em maiúsculas (ex.: ABC1234 ou ABC1D23)."""
        return normalizar_placa(self.placa)

    class Meta:
        db_table = "cte_veiculo_rodo"
        verbose_name = "CT-e – Veículo Rodoviário"
        verbose_name_plural = verbose_name

class CTeMotorista(models.Model):
    """<moto>"""
    modal = models.ForeignKey(CTeModalRodoviario, on_delete=models.CASCADE, related_name="motoristas")
    nome = models.CharField("Nome Motorista", max_length=60)
    cpf = models.CharField("CPF Motorista", max_length=11)
    # Vínculo automático com o cadastro mestre (preenchido no parse via CPF)
    motorista = models.ForeignKey(
        'Motorista', on_delete=models.SET_NULL, null=True, blank=True,
        related_name="ctes_como_condutor")

    class Meta:
        db_table = "cte_motorista"
        verbose_name = "CT-e – Motorista"
        verbose_name_plural = verbose_name

# --- Modais não-rodoviários (mod 57) ---
class CTeModalAereo(models.Model):
    """<infModal><aereo>"""
    cte = models.OneToOneField(CTeDocumento, on_delete=models.CASCADE, related_name="modal_aereo")
    numero_minuta = models.CharField("Número Minuta", max_length=12, null=True, blank=True)  # <nMinu>
    numero_oca = models.CharField("Número Operacional Conhecimento Aéreo", max_length=11, null=True, blank=True)  # <nOCA>
    data_prevista_entrega = models.DateField("Data Prevista Entrega", null=True, blank=True)  # <dPrevAereo>
    classe_tarifa = models.CharField("Classe Tarifa", max_length=10, null=True, blank=True)  # <tarifa><CL>
    codigo_tarifa = models.CharField("Código Tarifa", max_length=10, null=True, blank=True)  # <tarifa><cTar>
    valor_tarifa = models.DecimalField("Valor Tarifa", max_digits=15, decimal_places=2, null=True, blank=True)  # <tarifa><vTar>
    dimensao = models.CharField("Dimensão Carga", max_length=20, null=True, blank=True)  # <natCarga><xDime>
    dados_completos = JSONField("Bloco aéreo completo", null=True, blank=True)

    class Meta:
        db_table = "cte_modal_aereo"
        verbose_name = "CT-e – Modal Aéreo"
        verbose_name_plural = verbose_name


class CTeModalAquaviario(models.Model):
    """<infModal><aquav>"""
    cte = models.OneToOneField(CTeDocumento, on_delete=models.CASCADE, related_name="modal_aquaviario")
    valor_prestacao = models.DecimalField("Valor Prestação Base Cálculo", max_digits=15, decimal_places=2, null=True, blank=True)  # <vPrest>
    valor_afrmm = models.DecimalField("Valor AFRMM", max_digits=15, decimal_places=2, null=True, blank=True)  # <vAFRMM>
    numero_booking = models.CharField("Número Booking", max_length=10, null=True, blank=True)  # <nBooking>
    numero_controle = models.CharField("Número Controle", max_length=10, null=True, blank=True)  # <nCtrl>
    nome_navio = models.CharField("Identificação do Navio", max_length=60, null=True, blank=True)  # <xNavio>
    numero_viagem = models.CharField("Número Viagem", max_length=10, null=True, blank=True)  # <nViag>
    direcao = models.CharField("Direção", max_length=1, null=True, blank=True)  # <direc> N/L/O/S
    irin = models.CharField("IRIN do Navio", max_length=10, null=True, blank=True)  # <irin>
    porto_embarque = models.CharField("Porto Embarque", max_length=60, null=True, blank=True)  # <prtEmb>
    porto_destino = models.CharField("Porto Destino", max_length=60, null=True, blank=True)  # <prtDest>
    tipo_navegacao = models.CharField("Tipo Navegação", max_length=1, null=True, blank=True)  # <tpNav>
    dados_completos = JSONField("Bloco aquaviário completo", null=True, blank=True)

    class Meta:
        db_table = "cte_modal_aquav"
        verbose_name = "CT-e – Modal Aquaviário"
        verbose_name_plural = verbose_name


class CTeModalFerroviario(models.Model):
    """<infModal><ferrov>"""
    cte = models.OneToOneField(CTeDocumento, on_delete=models.CASCADE, related_name="modal_ferroviario")
    tipo_trafego = models.CharField("Tipo Tráfego", max_length=1, null=True, blank=True)  # <tpTraf>
    fluxo = models.CharField("Fluxo Ferroviário", max_length=10, null=True, blank=True)  # <fluxo>
    id_trem = models.CharField("Identificação Trem", max_length=36, null=True, blank=True)  # <idTrem>
    valor_frete = models.DecimalField("Valor Frete", max_digits=15, decimal_places=2, null=True, blank=True)  # <vFrete>
    resp_faturamento = models.CharField("Responsável Faturamento", max_length=1, null=True, blank=True)  # <trafMut><respFat>
    ferrovia_emitente = models.CharField("Ferrovia Emitente", max_length=1, null=True, blank=True)  # <trafMut><ferrEmi>
    dados_completos = JSONField("Bloco ferroviário completo", null=True, blank=True)

    class Meta:
        db_table = "cte_modal_ferrov"
        verbose_name = "CT-e – Modal Ferroviário"
        verbose_name_plural = verbose_name


class CTeModalDutoviario(models.Model):
    """<infModal><duto>"""
    cte = models.OneToOneField(CTeDocumento, on_delete=models.CASCADE, related_name="modal_dutoviario")
    valor_tarifa = models.DecimalField("Valor Tarifa", max_digits=15, decimal_places=2, null=True, blank=True)  # <vTar>
    data_inicio = models.DateField("Data Início Prestação", null=True, blank=True)  # <dIni>
    data_fim = models.DateField("Data Fim Prestação", null=True, blank=True)  # <dFim>
    dados_completos = JSONField("Bloco dutoviário completo", null=True, blank=True)

    class Meta:
        db_table = "cte_modal_duto"
        verbose_name = "CT-e – Modal Dutoviário"
        verbose_name_plural = verbose_name


class CTeModalMultimodal(models.Model):
    """<infModal><multimodal>"""
    cte = models.OneToOneField(CTeDocumento, on_delete=models.CASCADE, related_name="modal_multimodal")
    numero_cotm = models.CharField("Número COTM", max_length=20, null=True, blank=True)  # <COTM>
    indicador_negociavel = models.CharField("Indicador Negociável", max_length=1, null=True, blank=True)  # <indNegociavel>
    seguradora = models.CharField("Seguradora Responsável", max_length=30, null=True, blank=True)  # <seg><respSeg>
    numero_apolice = models.CharField("Número Apólice", max_length=20, null=True, blank=True)  # <seg><nApol>
    numero_averbacao = models.CharField("Número Averbação", max_length=20, null=True, blank=True)  # <seg><nAver>
    dados_completos = JSONField("Bloco multimodal completo", null=True, blank=True)

    class Meta:
        db_table = "cte_modal_multi"
        verbose_name = "CT-e – Modal Multimodal"
        verbose_name_plural = verbose_name


# --- CT-e OS (mod 67) — bloco específico <infCTeNormOS> ---
class CTeOSInfo(models.Model):
    """Dados específicos do CT-e Outros Serviços (mod 67): <infCTeNormOS>."""
    cte = models.OneToOneField(CTeDocumento, on_delete=models.CASCADE, related_name="os_info")
    descricao_servico = models.CharField("Descrição do Serviço", max_length=300, null=True, blank=True)  # <infServico><xDescServ>
    quantidade_carga = models.DecimalField("Quantidade de Carga", max_digits=15, decimal_places=4, null=True, blank=True)  # <infServico><infQ><qCarga>
    seguradora = models.CharField("Seguradora", max_length=60, null=True, blank=True)  # <seg><infSeg><xSeg>
    numero_apolice = models.CharField("Número Apólice", max_length=20, null=True, blank=True)  # <seg><nApol>
    numero_averbacao = models.CharField("Número Averbação", max_length=20, null=True, blank=True)  # <seg><nAver>
    documentos_referenciados = JSONField("Documentos Referenciados", null=True, blank=True)  # <infDocRef>
    info_completa = JSONField("Bloco infCTeNormOS completo", null=True, blank=True)

    class Meta:
        db_table = "cte_os_info"
        verbose_name = "CT-e OS – Informações (mod 67)"
        verbose_name_plural = verbose_name


# --- Carta de Correção Eletrônica (CC-e) — evento 110110 ---
class CTeCartaCorrecao(models.Model):
    """Evento de Carta de Correção Eletrônica (110110) de CT-e: <evCCeCTe>."""
    cte = models.ForeignKey(CTeDocumento, on_delete=models.CASCADE, related_name="cartas_correcao")
    sequencia_evento = models.PositiveIntegerField("Sequência do Evento (nSeqEvento)", null=True, blank=True)
    data_evento = models.DateTimeField("Data/Hora do Evento", null=True, blank=True)
    protocolo = models.CharField("Protocolo do Evento", max_length=20, null=True, blank=True)
    codigo_status = models.IntegerField("Status SEFAZ (cStat)", null=True, blank=True)
    motivo_status = models.CharField("Motivo (xMotivo)", max_length=255, null=True, blank=True)
    correcoes = JSONField("Grupos Alterados (infCorrecao)", null=True, blank=True)
    arquivo_xml_evento = models.TextField("XML do Evento", null=True, blank=True)
    criado_em = models.DateTimeField("Criado em", auto_now_add=True)

    class Meta:
        db_table = "cte_carta_correcao"
        verbose_name = "CT-e – Carta de Correção"
        verbose_name_plural = "CT-e – Cartas de Correção"
        unique_together = ('cte', 'sequencia_evento')
        ordering = ['-data_evento']

    def __str__(self):
        return f"CC-e seq {self.sequencia_evento} – CT-e {self.cte_id}"


# --- Autorizados a obter XML ---
class CTeAutXML(models.Model):
    """<autXML>"""
    cte = models.ForeignKey(CTeDocumento, on_delete=models.CASCADE, related_name="autorizados_xml")
    cnpj = models.CharField("CNPJ Autorizado", max_length=14, null=True, blank=True)
    cpf = models.CharField("CPF Autorizado", max_length=11, null=True, blank=True)

    class Meta:
        db_table = "cte_autxml"
        verbose_name = "CT-e – Autorização XML"
        verbose_name_plural = verbose_name
        unique_together = ('cte', 'cnpj', 'cpf')

# --- Responsável Técnico ---
class CTeResponsavelTecnico(models.Model):
    """<infRespTec>"""
    cte = models.OneToOneField(CTeDocumento, on_delete=models.CASCADE, related_name="resp_tecnico")
    cnpj = models.CharField("CNPJ Resp. Técnico", max_length=14)
    contato = models.CharField("Nome Contato", max_length=60)
    email = models.EmailField("Email Contato")
    telefone = models.CharField("Telefone Contato", max_length=14)
    id_csr = models.CharField("ID CSR", max_length=3, null=True, blank=True)
    hash_csr = models.CharField("Hash CSR", max_length=28, null=True, blank=True)

    class Meta:
        db_table = "cte_resp_tec"
        verbose_name = "CT-e – Responsável Técnico"
        verbose_name_plural = verbose_name

# --- Protocolo de Autorização ---
class CTeProtocoloAutorizacao(models.Model):
    """<protCTe>"""
    cte = models.OneToOneField(CTeDocumento, on_delete=models.CASCADE, related_name="protocolo")
    ambiente = models.PositiveSmallIntegerField("Ambiente")
    versao_aplic = models.CharField("Versão Aplicação", max_length=30)
    data_recebimento = models.DateTimeField("Data/Hora Recebimento")
    numero_protocolo = models.CharField("Número Protocolo", max_length=15, unique=True)
    digest_value = models.CharField("Digest Value", max_length=60, null=True, blank=True)
    codigo_status = models.PositiveSmallIntegerField("Código Status")
    motivo_status = models.CharField("Motivo Status", max_length=255)

    class Meta:
        db_table = "cte_protocolo"
        verbose_name = "CT-e – Protocolo"

        # --- Complemento Suplementar (QR Code) ---
class CTeSuplementar(models.Model):
   """<infCTeSupl>"""
   cte = models.OneToOneField(CTeDocumento, on_delete=models.CASCADE, related_name="suplementar")
   qr_code_url = models.TextField("URL QR Code")

   class Meta:
       db_table = "cte_suplementar"
       verbose_name = "CT-e – Suplementar"
       verbose_name_plural = verbose_name

# --- Cancelamento do CT-e (Evento) ---
class CTeCancelamento(models.Model):
   """Evento de Cancelamento - Combina informações do evento e da resposta"""
   cte = models.OneToOneField(CTeDocumento, on_delete=models.CASCADE, related_name="cancelamento")

   # Campos do evento
   id_evento = models.CharField("ID Evento", max_length=60, unique=True) # Formato: ID + tpEvento + chCTe + nSeqEvento (55 chars)
   c_orgao = models.CharField("Código Órgão IBGE", max_length=2)
   tp_amb = models.PositiveSmallIntegerField("Tipo Ambiente")
   cnpj = models.CharField("CNPJ Solicitante", max_length=14)
   cpf = models.CharField("CPF Solicitante", max_length=11, null=True, blank=True)
   dh_evento = models.DateTimeField("Data/Hora Evento")
   tp_evento = models.CharField("Tipo Evento", max_length=6, default="110111") # 110111 = Cancelamento
   n_seq_evento = models.PositiveSmallIntegerField("Sequência Evento", default=1)
   versao_evento = models.CharField("Versão Evento", max_length=5, default="4.00")
   n_prot_original = models.CharField("Protocolo Autorização Original", max_length=15)
   x_just = models.TextField("Justificativa")

   # Campos da resposta do evento
   id_retorno = models.CharField("ID Retorno", max_length=30, null=True, blank=True) # <infEvento> @Id (ex: ID329250183167960)
   ver_aplic = models.CharField("Versão Aplicação Resposta", max_length=20, null=True, blank=True)
   c_stat = models.PositiveSmallIntegerField("Código Status Resposta", null=True, blank=True)
   x_motivo = models.CharField("Motivo Status Resposta", max_length=255, null=True, blank=True)
   dh_reg_evento = models.DateTimeField("Data/Hora Registro Evento", null=True, blank=True)
   n_prot_retorno = models.CharField("Protocolo Evento", max_length=20, null=True, blank=True, unique=True) # Protocolo pode ter ate 18 chars
   arquivo_xml_evento = models.TextField("XML Evento Cancelamento", null=True, blank=True)

   class Meta:
       db_table = "cte_cancelamento"
       verbose_name = "CT-e – Cancelamento"
       verbose_name_plural = "CT-e – Cancelamentos"

   def __str__(self):
       return f"Cancelamento de {self.cte.chave}"


# ---------------------------------------------------------------------------
#  M O D E L O S   M D F - e   (Manifesto Eletrônico de Documentos Fiscais)
# ---------------------------------------------------------------------------

class MDFeDocumento(models.Model):
   """Raiz do MDF-e – mantém a chave e o XML bruto."""
   STATUS_CHOICES = [
       ('autorizado', 'Autorizado'),
       ('cancelado', 'Cancelado'),
       ('encerrado', 'Encerrado'),
       ('denegado', 'Denegado'),
       ('inutilizado', 'Inutilizado'),
   ]

   id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
   chave = models.CharField("Chave MDF-e", max_length=44, unique=True, db_index=True)
   versao = models.CharField("Versão Schema", max_length=5)
   xml_original = models.TextField(null=True, blank=True)
   arquivo_xml = models.FileField(upload_to='xml_mdfes/', null=True, blank=True, verbose_name="Arquivo XML")
   checksum = models.CharField("Checksum SHA-256", max_length=64, blank=True, null=True, db_index=True)
   data_arquivamento = models.DateTimeField("Data de Arquivamento", auto_now_add=True)
   caminho_arquivo = models.CharField("Caminho do Arquivo", max_length=255, blank=True, null=True)
   data_upload = models.DateTimeField(auto_now_add=True)
   processado = models.BooleanField(default=False, help_text="Indica se o XML foi processado e os dados extraídos.")
   status = models.CharField("Status", max_length=15, choices=STATUS_CHOICES, default='autorizado', db_index=True)
   
   # Campos para tratamento de encerramento - NOVOS CAMPOS
   encerrado = models.BooleanField("Encerrado", default=False, db_index=True)
   data_encerramento = models.DateField("Data Encerramento", null=True, blank=True)
   municipio_encerramento_cod = models.CharField("Código Município Encerramento", max_length=7, null=True, blank=True)
   uf_encerramento = models.CharField("UF Encerramento", max_length=2, null=True, blank=True)
   protocolo_encerramento = models.CharField("Protocolo Encerramento", max_length=15, null=True, blank=True, unique=True)

   class Meta:
       db_table = "mdfe_documento"
       verbose_name = "MDF-e (Documento)"
       verbose_name_plural = "MDF-e (Documentos)"
       ordering = ['-identificacao__dh_emi']
       indexes = [
           models.Index(fields=['processado', 'data_upload']),
           models.Index(fields=['encerrado', 'data_encerramento']),
       ]

   def __str__(self):
       return self.chave

class MDFeIdentificacao(models.Model):
   """<ide>"""
   mdfe = models.OneToOneField(MDFeDocumento, on_delete=models.CASCADE, related_name="identificacao")
   c_uf = models.PositiveSmallIntegerField("Código UF Emitente")
   tp_amb = models.PositiveSmallIntegerField("Tipo Ambiente")
   tp_emit = models.PositiveSmallIntegerField("Tipo Emitente (1=Prest Serv, 2=Transp Carga Própria)")
   tp_transp = models.PositiveSmallIntegerField("Tipo Transportador (1=ETC, 2=TAC, 3=CTC)", null=True, blank=True)
   mod = models.CharField("Modelo", max_length=2)
   serie = models.PositiveSmallIntegerField("Série")
   n_mdf = models.PositiveIntegerField("Número MDF-e")
   c_mdf = models.CharField("Código Numérico Chave", max_length=8)
   c_dv = models.CharField("Dígito Verificador Chave", max_length=1)
   modal = models.CharField("Modal (1=Rodoviário, 2=Aéreo, 3=Aquaviário, 4=Ferroviário)", max_length=1)
   dh_emi = models.DateTimeField("Data/Hora Emissão")
   tp_emis = models.PositiveSmallIntegerField("Tipo Emissão (1=Normal, 2=Contingência)")
   proc_emi = models.PositiveSmallIntegerField("Processo Emissão")
   ver_proc = models.CharField("Versão Processo Emissão", max_length=20)
   uf_ini = models.CharField("UF Início Viagem", max_length=2)
   uf_fim = models.CharField("UF Fim Viagem", max_length=2)
   dh_ini_viagem = models.DateTimeField("Data/Hora Início Viagem", null=True, blank=True)
   ind_carga_posterior = models.BooleanField("Indicador Carga Posterior", default=False)
   ind_canal_verde = models.BooleanField("Indicador Canal Verde", default=False)

   class Meta:
       db_table = "mdfe_identificacao"
       verbose_name = "MDF-e – Identificação"
       verbose_name_plural = verbose_name
       indexes = [
           models.Index(fields=['n_mdf', 'serie']),
           models.Index(fields=['uf_ini', 'uf_fim']),
           models.Index(fields=['dh_emi', 'n_mdf']),
       ]

class MDFeMunicipioCarregamento(models.Model):
   """<infMunCarrega>"""
   identificacao = models.ForeignKey(MDFeIdentificacao, on_delete=models.CASCADE, related_name="municipios_carregamento")
   c_mun_carrega = models.CharField("Código Município Carregamento", max_length=7)
   x_mun_carrega = models.CharField("Nome Município Carregamento", max_length=60)

   class Meta:
       db_table = "mdfe_municipio_carrega"
       verbose_name = "MDF-e – Município Carregamento"
       verbose_name_plural = verbose_name
       unique_together = ('identificacao', 'c_mun_carrega')

class MDFePercurso(models.Model):
   """<peri>"""
   identificacao = models.ForeignKey(MDFeIdentificacao, on_delete=models.CASCADE, related_name="percurso")
   uf_per = models.CharField("UF Percurso", max_length=2)

   class Meta:
       db_table = "mdfe_percurso"
       verbose_name = "MDF-e – Percurso"
       verbose_name_plural = "MDF-e – Percursos"
       unique_together = ('identificacao', 'uf_per')

# --- Emitente MDF-e ---
class MDFeEmitente(EntidadeFiscal):
   """<emit>"""
   mdfe = models.OneToOneField(MDFeDocumento, on_delete=models.CASCADE, related_name="emitente")
   # Campos herdados de EntidadeFiscal

   class Meta:
       db_table = "mdfe_emitente"
       verbose_name = "MDF-e – Emitente"
       verbose_name_plural = verbose_name

# --- Modal Rodoviário MDF-e ---
class MDFeModalRodoviario(models.Model):
   """<infModal versaoModal="3.00"><rodo>"""
   mdfe = models.OneToOneField(MDFeDocumento, on_delete=models.CASCADE, related_name="modal_rodoviario")
   rntrc = models.CharField("RNTRC", max_length=8, null=True, blank=True)
   tp_rntrc = models.CharField("Tipo RNTRC", max_length=2, null=True, blank=True)  # <tpRntrc>
   # <veicTracao> é um modelo separado
   # <veicReboque> é um modelo separado
   # <condutor> é um modelo separado
   codigo_agendamento_porto = models.CharField("Código Agendamento Porto", max_length=10, null=True, blank=True) # <codAgPorto>
   # infANTT — financeiro/administrativo (Fase C)
   val_resp_frete = models.DecimalField("Valor Repasse Responsável Frete", max_digits=15, decimal_places=2, null=True, blank=True)  # <valORespFrete>
   val_etarifa = models.DecimalField("Valor E-Tarifa ANTT", max_digits=15, decimal_places=2, null=True, blank=True)  # <valETarifa>
   val_apagar = models.DecimalField("Valor a Pagar Total", max_digits=15, decimal_places=2, null=True, blank=True)  # <valAPagar>
   id_tac = models.CharField("ID Transportador Autônomo (TAC)", max_length=14, null=True, blank=True)  # <idtac>
   id_ac = models.CharField("ID Agenciador de Cargas (AC)", max_length=14, null=True, blank=True)  # <idtAC>
   nro_ocrim = models.CharField("Nº Ocorrência Criminal", max_length=20, null=True, blank=True)  # <nroOCrim>
   nro_proc = models.CharField("Nº Processo Administrativo", max_length=30, null=True, blank=True)  # <nroProc>

   class Meta:
       db_table = "mdfe_modal_rodo"
       verbose_name = "MDF-e – Modal Rodoviário"
       verbose_name_plural = verbose_name

class MDFeVeiculoTracao(models.Model):
   """<rodo><veicTracao>"""
   modal = models.OneToOneField(MDFeModalRodoviario, on_delete=models.CASCADE, related_name="veiculo_tracao")
   placa = models.CharField("Placa", max_length=7)
   renavam = models.CharField("RENAVAM", max_length=11, null=True, blank=True)
   tara = models.PositiveIntegerField("Tara (Kg)")
   cap_kg = models.PositiveIntegerField("Capacidade (Kg)", null=True, blank=True)
   cap_m3 = models.PositiveIntegerField("Capacidade (m³)", null=True, blank=True)
   tp_rod = models.CharField("Tipo Rodado", max_length=2, null=True, blank=True)
   tp_car = models.CharField("Tipo Carroceria", max_length=2, null=True, blank=True)
   uf = models.CharField("UF Licenciamento", max_length=2, null=True, blank=True)

   # Proprietário (se não for o emitente)
   prop_cnpj = models.CharField("CNPJ Proprietário", max_length=14, null=True, blank=True)
   prop_cpf = models.CharField("CPF Proprietário", max_length=11, null=True, blank=True)
   prop_rntrc = models.CharField("RNTRC Proprietário", max_length=8, null=True, blank=True)
   prop_razao_social = models.CharField("Razão Social Proprietário", max_length=60, null=True, blank=True)
   prop_ie = models.CharField("IE Proprietário", max_length=14, null=True, blank=True)
   prop_uf = models.CharField("UF Proprietário", max_length=2, null=True, blank=True)
   prop_tp = models.CharField("Tipo Proprietário", max_length=1, null=True, blank=True) # 1=ETC; 2=TAC; 3=CTC

   class Meta:
       db_table = "mdfe_veiculo_tracao"
       verbose_name = "MDF-e – Veículo Tração"
       verbose_name_plural = verbose_name

class MDFeVeiculoReboque(models.Model):
   """<rodo><veicReboque>"""
   modal = models.ForeignKey(MDFeModalRodoviario, on_delete=models.CASCADE, related_name="veiculos_reboque")
   placa = models.CharField("Placa", max_length=7)
   renavam = models.CharField("RENAVAM", max_length=11, null=True, blank=True)
   tara = models.PositiveIntegerField("Tara (Kg)")
   cap_kg = models.PositiveIntegerField("Capacidade (Kg)", null=True, blank=True)
   cap_m3 = models.PositiveIntegerField("Capacidade (m³)", null=True, blank=True)
   tp_car = models.CharField("Tipo Carroceria", max_length=2, null=True, blank=True)
   uf = models.CharField("UF Licenciamento", max_length=2, null=True, blank=True)

   # Proprietário (se não for o emitente)
   prop_cnpj = models.CharField("CNPJ Proprietário", max_length=14, null=True, blank=True)
   prop_cpf = models.CharField("CPF Proprietário", max_length=11, null=True, blank=True)
   prop_rntrc = models.CharField("RNTRC Proprietário", max_length=8, null=True, blank=True)
   prop_razao_social = models.CharField("Razão Social Proprietário", max_length=60, null=True, blank=True)
   prop_ie = models.CharField("IE Proprietário", max_length=14, null=True, blank=True)
   prop_uf = models.CharField("UF Proprietário", max_length=2, null=True, blank=True)
   prop_tp = models.CharField("Tipo Proprietário", max_length=1, null=True, blank=True)

   class Meta:
       db_table = "mdfe_veiculo_reboque"
       verbose_name = "MDF-e – Veículo Reboque"
       verbose_name_plural = verbose_name

class MDFeCondutor(models.Model):
   """<rodo><condutor>"""
   # Mudança: Relacionado diretamente ao MDFeDocumento para permitir múltiplos modais (embora raro)
   mdfe = models.ForeignKey(MDFeDocumento, on_delete=models.CASCADE, related_name="condutores")
   nome = models.CharField("Nome Condutor", max_length=60)
   cpf = models.CharField("CPF Condutor", max_length=11)
   # Vínculo automático com o cadastro mestre (preenchido no parse via CPF)
   motorista = models.ForeignKey(
       'Motorista', on_delete=models.SET_NULL, null=True, blank=True,
       related_name="mdfes_como_condutor")

   class Meta:
       db_table = "mdfe_condutor"
       verbose_name = "MDF-e – Condutor"
       verbose_name_plural = verbose_name
       unique_together = ('mdfe', 'cpf')

class MDFeCIOT(models.Model):
   """<rodo><infCIOT>"""
   modal = models.ForeignKey(MDFeModalRodoviario, on_delete=models.CASCADE, related_name="ciots")
   ciot = models.CharField("CIOT", max_length=12, null=True, blank=True)
   cnpj_responsavel = models.CharField("CNPJ Responsável", max_length=14, null=True, blank=True)
   cpf_responsavel = models.CharField("CPF Responsável", max_length=11, null=True, blank=True)

   class Meta:
       db_table = "mdfe_ciot"
       verbose_name = "MDF-e – CIOT"
       verbose_name_plural = verbose_name

class MDFeValePedagio(models.Model):
   """<rodo><valePed>"""
   modal = models.ForeignKey(MDFeModalRodoviario, on_delete=models.CASCADE, related_name="vales_pedagio")
   cnpj_fornecedor = models.CharField("CNPJ Fornecedor", max_length=14)
   cnpj_pagador = models.CharField("CNPJ Pagador Frete", max_length=14, null=True, blank=True)
   cpf_pagador = models.CharField("CPF Pagador Frete", max_length=11, null=True, blank=True)
   numero_compra = models.CharField("Número Comprovante Compra", max_length=20)
   valor_vale = models.DecimalField("Valor Vale Pedágio", max_digits=15, decimal_places=2)

   class Meta:
       db_table = "mdfe_vale_pedagio"
       verbose_name = "MDF-e – Vale Pedágio"
       verbose_name_plural = verbose_name

class MDFeContratante(models.Model):
   """<rodo><infContratante>"""
   modal = models.ForeignKey(MDFeModalRodoviario, on_delete=models.CASCADE, related_name="contratantes")
   cnpj = models.CharField("CNPJ Contratante", max_length=14, null=True, blank=True)
   cpf = models.CharField("CPF Contratante", max_length=11, null=True, blank=True)

   class Meta:
       db_table = "mdfe_contratante"
       verbose_name = "MDF-e – Contratante"
       verbose_name_plural = verbose_name

# --- Documentos Vinculados (agrupados por município de descarregamento) ---
class MDFeMunicipioDescarga(models.Model):
   """<infMunDescarga>"""
   mdfe = models.ForeignKey(MDFeDocumento, on_delete=models.CASCADE, related_name="municipios_descarga")
   c_mun_descarga = models.CharField("Código Município Descarga", max_length=7)
   x_mun_descarga = models.CharField("Nome Município Descarga", max_length=60)

   class Meta:
       db_table = "mdfe_municipio_descarga"
       verbose_name = "MDF-e – Município Descarga"
       verbose_name_plural = "MDF-e – Municípios Descarga"
       unique_together = ('mdfe', 'c_mun_descarga')

# --- Modais não-rodoviários (mod 58) ---
class MDFeModalAereo(models.Model):
   """<infModal><aereo>"""
   mdfe = models.OneToOneField(MDFeDocumento, on_delete=models.CASCADE, related_name="modal_aereo")
   nacionalidade = models.CharField("Nacionalidade da Aeronave", max_length=4, null=True, blank=True)  # <nac>
   matricula = models.CharField("Matrícula da Aeronave", max_length=6, null=True, blank=True)  # <matr>
   numero_voo = models.CharField("Número do Voo", max_length=9, null=True, blank=True)  # <nVoo>
   aerodromo_embarque = models.CharField("Aeródromo de Embarque", max_length=4, null=True, blank=True)  # <cAerEmb>
   aerodromo_destino = models.CharField("Aeródromo de Destino", max_length=4, null=True, blank=True)  # <cAerDes>
   data_voo = models.DateField("Data do Voo", null=True, blank=True)  # <dVoo>
   dados_completos = JSONField("Bloco aéreo completo", null=True, blank=True)

   class Meta:
       db_table = "mdfe_modal_aereo"
       verbose_name = "MDF-e – Modal Aéreo"
       verbose_name_plural = verbose_name


class MDFeModalAquaviario(models.Model):
   """<infModal><aquav>"""
   mdfe = models.OneToOneField(MDFeDocumento, on_delete=models.CASCADE, related_name="modal_aquaviario")
   cnpj_agente_navegacao = models.CharField("CNPJ Agente de Navegação", max_length=14, null=True, blank=True)  # <CNPJAgeNav>
   codigo_embarcacao = models.CharField("Código da Embarcação", max_length=10, null=True, blank=True)  # <cEmbar>
   nome_embarcacao = models.CharField("Nome da Embarcação", max_length=60, null=True, blank=True)  # <xEmbar>
   numero_viagem = models.CharField("Número da Viagem", max_length=10, null=True, blank=True)  # <nViag>
   tipo_embarcacao = models.CharField("Tipo de Embarcação", max_length=2, null=True, blank=True)  # <tpEmb>
   tipo_navegacao = models.CharField("Tipo de Navegação", max_length=1, null=True, blank=True)  # <tpNav>
   irin = models.CharField("IRIN", max_length=10, null=True, blank=True)  # <irin>
   porto_embarque = models.CharField("Código Porto Embarque", max_length=10, null=True, blank=True)  # <cPrtEmb>
   porto_destino = models.CharField("Código Porto Destino", max_length=10, null=True, blank=True)  # <cPrtDest>
   dados_completos = JSONField("Bloco aquaviário completo", null=True, blank=True)

   class Meta:
       db_table = "mdfe_modal_aquav"
       verbose_name = "MDF-e – Modal Aquaviário"
       verbose_name_plural = verbose_name


class MDFeModalFerroviario(models.Model):
   """<infModal><ferrov>"""
   mdfe = models.OneToOneField(MDFeDocumento, on_delete=models.CASCADE, related_name="modal_ferroviario")
   prefixo_trem = models.CharField("Prefixo do Trem", max_length=10, null=True, blank=True)  # <trem><xPref>
   data_hora_trem = models.DateTimeField("Data/Hora Liberação do Trem", null=True, blank=True)  # <trem><dhTrem>
   origem_trem = models.CharField("Origem do Trem", max_length=100, null=True, blank=True)  # <trem><xOri>
   destino_trem = models.CharField("Destino do Trem", max_length=100, null=True, blank=True)  # <trem><xDest>
   qtd_vagoes = models.IntegerField("Quantidade de Vagões", null=True, blank=True)  # <trem><qVag>
   dados_completos = JSONField("Bloco ferroviário completo (trem + vagões)", null=True, blank=True)

   class Meta:
       db_table = "mdfe_modal_ferrov"
       verbose_name = "MDF-e – Modal Ferroviário"
       verbose_name_plural = verbose_name


# Modelo Intermediário para Relacionar MDF-e e CT-e
class MDFeDocumentosVinculados(models.Model):
   """Modelo para vincular MDF-e aos CT-es (ou NF-es) que ele transporta"""
   mdfe = models.ForeignKey(MDFeDocumento, on_delete=models.CASCADE, related_name='docs_vinculados_mdfe')
   municipio_descarga = models.ForeignKey(MDFeMunicipioDescarga, on_delete=models.CASCADE, related_name='docs_vinculados_municipio')

   # Armazena a chave do documento vinculado (CT-e ou NF-e)
   chave_documento = models.CharField("Chave Documento Vinculado", max_length=44, db_index=True)
   seg_cod_barras = models.CharField("Segundo Código Barras (CT-e)", max_length=36, null=True, blank=True) # <segCodBarra>
   ind_reentrega = models.BooleanField("Indicador Reentrega", default=False)
   # Unidades de transporte/carga (infUnidTransp/infUnidCarga) — capturado em JSON (Fase C)
   unidades_transporte = JSONField("Unidades de Transporte/Carga", null=True, blank=True)

   # Tenta relacionar com o CTeDocumento se a chave existir
   cte_relacionado = models.ForeignKey(CTeDocumento, on_delete=models.SET_NULL, null=True, blank=True, related_name='mdfe_transportador', to_field='chave')
   # Adicionar ForeignKey para NF-e se houver um modelo NF-e

   class Meta:
       db_table = "mdfe_documentos_vinculados"
       verbose_name = "MDF-e – Documento Vinculado"
       verbose_name_plural = "MDF-e – Documentos Vinculados"
       unique_together = ('mdfe', 'chave_documento')

class MDFeProdutoPerigoso(models.Model):
   """<infDoc><peri>"""
   documento_vinculado = models.ForeignKey(MDFeDocumentosVinculados, on_delete=models.CASCADE, related_name="produtos_perigosos")
   n_onu = models.CharField("Número ONU", max_length=4, null=True, blank=True)
   x_nome_ae = models.CharField("Nome Apropriado Embarque", max_length=150, null=True, blank=True)
   x_cla_risco = models.CharField("Classe Risco", max_length=40, null=True, blank=True)
   gr_emb = models.CharField("Grupo Embalagem", max_length=6, null=True, blank=True)
   q_tot_prod = models.CharField("Quantidade Total Produto", max_length=20, null=True, blank=True) # Pode ser número ou texto (ex: "2 Tambores")
   q_vol_tipo = models.CharField("Quantidade e Tipo Volumes", max_length=60, null=True, blank=True)
   ponto_fulgor = models.CharField("Ponto de Fulgor", max_length=6, null=True, blank=True)  # <pontoFulgor>

   class Meta:
       db_table = "mdfe_produto_perigoso"
       verbose_name = "MDF-e – Produto Perigoso"
       verbose_name_plural = "MDF-e – Produtos Perigosos"

# --- Seguros MDF-e ---
class MDFeSeguroCarga(models.Model):
   """<seg>"""
   mdfe = models.ForeignKey(MDFeDocumento, on_delete=models.CASCADE, related_name="seguros_carga")
   responsavel = models.CharField("Responsável Seguro", max_length=1, null=True, blank=True) # 1=Emitente MDF-e; 2=Responsável pela contratação (contratante)
   cnpj_responsavel = models.CharField("CNPJ Responsável", max_length=14, null=True, blank=True)
   cpf_responsavel = models.CharField("CPF Responsável", max_length=11, null=True, blank=True)

   # <infSeg>
   nome_seguradora = models.CharField("Nome Seguradora", max_length=30, null=True, blank=True)
   cnpj_seguradora = models.CharField("CNPJ Seguradora", max_length=14, null=True, blank=True)
   numero_apolice = models.CharField("Número Apólice", max_length=20, null=True, blank=True)
   # <nAver> (ocorrências múltiplas)

   class Meta:
       db_table = "mdfe_seguro_carga"
       verbose_name = "MDF-e – Seguro Carga"
       verbose_name_plural = "MDF-e – Seguros Carga"

class MDFeAverbacaoSeguro(models.Model):
   """<nAver>"""
   seguro = models.ForeignKey(MDFeSeguroCarga, on_delete=models.CASCADE, related_name="averbacoes")
   numero = models.CharField("Número Averbação", max_length=40)

   class Meta:
       db_table = "mdfe_averbacao_seguro"
       verbose_name = "MDF-e – Averbação Seguro"
       verbose_name_plural = "MDF-e – Averbações Seguro"

# --- Produto Predominante ---
class MDFeProdutoPredominante(models.Model):
   """<prodPred>"""
   mdfe = models.OneToOneField(MDFeDocumento, on_delete=models.CASCADE, related_name="prod_pred")
   tp_carga = models.CharField("Tipo Carga", max_length=2, null=True, blank=True) # Ver tabela ANTT
   x_prod = models.CharField("Descrição Produto", max_length=120, null=True, blank=True)
   ncm = models.CharField("NCM", max_length=8, null=True, blank=True)
   # <infLotacao> — local de carregamento/descarregamento (Fase C)
   cep_carrega = models.CharField("CEP Local Carregamento", max_length=8, null=True, blank=True)
   lat_carrega = models.CharField("Latitude Carregamento", max_length=15, null=True, blank=True)
   long_carrega = models.CharField("Longitude Carregamento", max_length=15, null=True, blank=True)
   cep_descarrega = models.CharField("CEP Local Descarregamento", max_length=8, null=True, blank=True)
   lat_descarrega = models.CharField("Latitude Descarregamento", max_length=15, null=True, blank=True)
   long_descarrega = models.CharField("Longitude Descarregamento", max_length=15, null=True, blank=True)

   class Meta:
       db_table = "mdfe_prod_pred"
       verbose_name = "MDF-e – Produto Predominante"
       verbose_name_plural = verbose_name

class MDFeObservacao(models.Model):
    """<obsCont>/<obsFisco> — observações do contribuinte ou do fisco."""
    TIPO_CHOICES = [('cont', 'Contribuinte'), ('fisco', 'Fisco')]
    mdfe = models.ForeignKey(MDFeDocumento, on_delete=models.CASCADE, related_name="observacoes")
    tipo = models.CharField("Tipo", max_length=5, choices=TIPO_CHOICES)
    campo = models.CharField("Identificação Campo", max_length=20, null=True, blank=True)  # @xCampo
    texto = models.TextField("Conteúdo", null=True, blank=True)  # <xTexto>

    class Meta:
        db_table = "mdfe_observacao"
        verbose_name = "MDF-e – Observação"
        verbose_name_plural = "MDF-e – Observações"

# --- Totalizadores ---
class MDFeTotais(models.Model):
   """<tot>"""
   mdfe = models.OneToOneField(MDFeDocumento, on_delete=models.CASCADE, related_name="totais")
   q_cte = models.PositiveIntegerField("Qtd. CT-e", null=True, blank=True)
   q_nfe = models.PositiveIntegerField("Qtd. NF-e", null=True, blank=True)
   # qCT omitido (obsoleto)
   v_carga = models.DecimalField("Valor Total Carga", max_digits=15, decimal_places=2, null=True, blank=True)
   c_unid = models.CharField("Código Unidade Peso Bruto", max_length=2, null=True, blank=True) # 01=KG; 02=TON
   q_carga = models.DecimalField("Peso Bruto Total Carga", max_digits=15, decimal_places=4, null=True, blank=True)
   q_unid = models.PositiveIntegerField("Qtd. Unidades de Carga", null=True, blank=True)  # <qUnid>

   class Meta:
       db_table = "mdfe_totais"
       verbose_name = "MDF-e – Totais"
       verbose_name_plural = verbose_name

# --- Lacres ---
class MDFeLacreRodoviario(models.Model):
   """<lacres><lacRodo>"""
   mdfe = models.ForeignKey(MDFeDocumento, on_delete=models.CASCADE, related_name="lacres_rodoviarios")
   numero = models.CharField("Número Lacre", max_length=20)

   class Meta:
       db_table = "mdfe_lacre_rodo"
       verbose_name = "MDF-e – Lacre Rodoviário"
       verbose_name_plural = "MDF-e – Lacres Rodoviários"

# --- Autorizados a obter XML MDF-e ---
class MDFeAutXML(models.Model):
   """<autXML>"""
   mdfe = models.ForeignKey(MDFeDocumento, on_delete=models.CASCADE, related_name="autorizados_xml")
   cnpj = models.CharField("CNPJ Autorizado", max_length=14, null=True, blank=True)
   cpf = models.CharField("CPF Autorizado", max_length=11, null=True, blank=True)

   class Meta:
       db_table = "mdfe_autxml"
       verbose_name = "MDF-e – Autorização XML"
       verbose_name_plural = verbose_name
       unique_together = ('mdfe', 'cnpj', 'cpf')

# --- Informações Adicionais ---
class MDFeInformacoesAdicionais(models.Model):
   """<infAdic>"""
   mdfe = models.OneToOneField(MDFeDocumento, on_delete=models.CASCADE, related_name="adicional")
   inf_ad_fisco = models.TextField("Informações Adicionais Fisco", null=True, blank=True)
   inf_cpl = models.TextField("Informações Complementares", null=True, blank=True)

   class Meta:
       db_table = "mdfe_inf_adic"
       verbose_name = "MDF-e – Informações Adicionais"
       verbose_name_plural = verbose_name

# --- Responsável Técnico MDF-e ---
class MDFeResponsavelTecnico(models.Model):
   """<infRespTec>"""
   mdfe = models.OneToOneField(MDFeDocumento, on_delete=models.CASCADE, related_name="resp_tecnico")
   cnpj = models.CharField("CNPJ Resp. Técnico", max_length=14)
   contato = models.CharField("Nome Contato", max_length=60)
   email = models.EmailField("Email Contato")
   telefone = models.CharField("Telefone Contato", max_length=14)
   id_csr = models.CharField("ID CSR", max_length=3, null=True, blank=True)
   hash_csr = models.CharField("Hash CSR", max_length=28, null=True, blank=True)

   class Meta:
       db_table = "mdfe_resp_tec"
       verbose_name = "MDF-e – Responsável Técnico"
       verbose_name_plural = verbose_name

# --- Protocolo de Autorização MDF-e ---
class MDFeProtocoloAutorizacao(models.Model):
   """<protMDFe>"""
   mdfe = models.OneToOneField(MDFeDocumento, on_delete=models.CASCADE, related_name="protocolo")
   ambiente = models.PositiveSmallIntegerField("Ambiente")
   versao_aplic = models.CharField("Versão Aplicação", max_length=30)
   data_recebimento = models.DateTimeField("Data/Hora Recebimento")
   numero_protocolo = models.CharField("Número Protocolo", max_length=15, unique=True)
   digest_value = models.CharField("Digest Value", max_length=60, null=True, blank=True)
   codigo_status = models.PositiveSmallIntegerField("Código Status")
   motivo_status = models.CharField("Motivo Status", max_length=255)

   class Meta:
       db_table = "mdfe_protocolo"
       verbose_name = "MDF-e – Protocolo"
       verbose_name_plural = verbose_name

# --- Suplementar MDF-e (QR Code) ---
class MDFeSuplementar(models.Model):
   """<infMDFeSupl>"""
   mdfe = models.OneToOneField(MDFeDocumento, on_delete=models.CASCADE, related_name="suplementar")
   qr_code_url = models.TextField("URL QR Code")

   class Meta:
       db_table = "mdfe_suplementar"
       verbose_name = "MDF-e – Suplementar"
       verbose_name_plural = verbose_name

# --- Cancelamento do MDF-e (Evento) ---
class MDFeCancelamento(models.Model):
   """Evento de Cancelamento MDF-e - Combina informações do evento e da resposta"""
   mdfe = models.OneToOneField(MDFeDocumento, on_delete=models.CASCADE, related_name="cancelamento")

   # Campos do evento
   id_evento = models.CharField("ID Evento", max_length=60, unique=True) # Formato: ID + tpEvento + chMDFe + nSeqEvento (55 chars)
   c_orgao = models.CharField("Código Órgão IBGE", max_length=2)
   tp_amb = models.PositiveSmallIntegerField("Tipo Ambiente")
   cnpj = models.CharField("CNPJ Solicitante", max_length=14)
   cpf = models.CharField("CPF Solicitante", max_length=11, null=True, blank=True)
   dh_evento = models.DateTimeField("Data/Hora Evento")
   tp_evento = models.CharField("Tipo Evento", max_length=6, default="110111") # 110111 = Cancelamento
   n_seq_evento = models.PositiveSmallIntegerField("Sequência Evento", default=1)
   versao_evento = models.CharField("Versão Evento", max_length=5, default="3.00")
   n_prot_original = models.CharField("Protocolo Autorização Original", max_length=15)
   x_just = models.TextField("Justificativa")

   # Campos da resposta do evento
   id_retorno = models.CharField("ID Retorno", max_length=30, null=True, blank=True) # <infEvento> @Id (ex: ID329250183167960)
   ver_aplic = models.CharField("Versão Aplicação Resposta", max_length=20, null=True, blank=True)
   c_stat = models.PositiveSmallIntegerField("Código Status Resposta", null=True, blank=True)
   x_motivo = models.CharField("Motivo Status Resposta", max_length=255, null=True, blank=True)
   dh_reg_evento = models.DateTimeField("Data/Hora Registro Evento", null=True, blank=True)
   n_prot_retorno = models.CharField("Protocolo Evento", max_length=20, null=True, blank=True, unique=True) # Protocolo pode ter ate 18 chars
   arquivo_xml_evento = models.TextField("XML Evento Cancelamento", null=True, blank=True)

   class Meta:
       db_table = "mdfe_cancelamento"
       verbose_name = "MDF-e – Cancelamento"
       verbose_name_plural = "MDF-e – Cancelamentos"

   def __str__(self):
       return f"Cancelamento de {self.mdfe.chave}"

# --- Cancelamento de Encerramento (para complementar handlers do parser_eventos.py) ---
class MDFeCancelamentoEncerramento(models.Model):
   """
   Evento de Cancelamento de Encerramento do MDF-e (110113)
   Usado quando o encerramento foi registrado por engano
   """
   mdfe = models.OneToOneField(MDFeDocumento, on_delete=models.CASCADE, related_name="cancelamento_encerramento")

   # Campos do evento
   id_evento = models.CharField("ID Evento", max_length=60, unique=True) # Formato: ID + tpEvento + chMDFe + nSeqEvento (55 chars)
   c_orgao = models.CharField("Código Órgão IBGE", max_length=2)
   tp_amb = models.PositiveSmallIntegerField("Tipo Ambiente")
   cnpj = models.CharField("CNPJ Solicitante", max_length=14)
   cpf = models.CharField("CPF Solicitante", max_length=11, null=True, blank=True)
   dh_evento = models.DateTimeField("Data/Hora Evento")
   tp_evento = models.CharField("Tipo Evento", max_length=6, default="110113") # 110113 = Cancelamento Encerramento
   n_seq_evento = models.PositiveSmallIntegerField("Sequência Evento", default=1)
   versao_evento = models.CharField("Versão Evento", max_length=5, default="3.00")
   n_prot_cancelar = models.CharField("Protocolo Encerramento a Cancelar", max_length=20) # Protocolo pode ter ate 18 chars
   x_just = models.TextField("Justificativa")

   # Campos da resposta do evento
   id_retorno = models.CharField("ID Retorno", max_length=30, null=True, blank=True) # <infEvento> @Id (ex: ID329250183167960)
   ver_aplic = models.CharField("Versão Aplicação Resposta", max_length=20, null=True, blank=True)
   c_stat = models.PositiveSmallIntegerField("Código Status Resposta", null=True, blank=True)
   x_motivo = models.CharField("Motivo Status Resposta", max_length=255, null=True, blank=True)
   dh_reg_evento = models.DateTimeField("Data/Hora Registro Evento", null=True, blank=True)
   n_prot_retorno = models.CharField("Protocolo Evento", max_length=20, null=True, blank=True, unique=True) # Protocolo pode ter ate 18 chars
   arquivo_xml_evento = models.TextField("XML Evento Canc. Encerramento", null=True, blank=True)

   class Meta:
       db_table = "mdfe_cancelamento_encerramento"
       verbose_name = "MDF-e – Cancelamento de Encerramento"
       verbose_name_plural = "MDF-e – Cancelamentos de Encerramento"

   def __str__(self):
       return f"Cancelamento de Encerramento de {self.mdfe.chave}"


# --------------------------------------------------
#  V E Í C U L O   E   M A N U T E N Ç Ã O
# --------------------------------------------------
class Veiculo(models.Model):
   """
   Cadastro básico do veículo – serve de referência para MDF‑e, manutenção
   e futuros indicadores (quilometragem, capacidade da frota etc.).
   ATUALIZADO: Adicionados campos de documentação e capacidade.
   """
   # Dados Básicos
   placa = models.CharField(max_length=8, unique=True, verbose_name="Placa", db_index=True)
   renavam = models.CharField(max_length=11, null=True, blank=True)
   tara = models.PositiveIntegerField(null=True, blank=True, help_text="Peso em ordem de marcha (kg)")
   capacidade_kg = models.PositiveIntegerField(null=True, blank=True, help_text="Capacidade máxima (kg)")
   capacidade_m3 = models.DecimalField(
       "Capacidade Total (M³)",
       max_digits=10,
       decimal_places=2,
       null=True,
       blank=True,
       help_text="Capacidade total do veículo em metros cúbicos"
   )
   tipo_rodado = models.CharField("Tipo Rodado", max_length=5, blank=True, null=True)
   tipo_carroceria = models.CharField("Tipo Carroceria", max_length=5, blank=True, null=True)

   # Proprietário
   tipo_proprietario = models.CharField(max_length=2, null=True, blank=True,
                                        help_text="00‑Próprio / 01‑Arrendado / 02‑Agregado …")
   proprietario_cnpj = models.CharField("CNPJ Proprietário", max_length=14, null=True, blank=True)
   proprietario_cpf = models.CharField("CPF Proprietário", max_length=11, null=True, blank=True)
   proprietario_nome = models.CharField("Razão Social/Nome Proprietário", max_length=60, null=True, blank=True)
   rntrc_proprietario = models.CharField("RNTRC Proprietário", max_length=8, null=True, blank=True)
   uf_proprietario = models.CharField("UF Proprietário", max_length=2, null=True, blank=True)

   # Documentação do Veículo (NOVOS CAMPOS)
   civ_validade = models.DateField(
       "CIV - Validade",
       blank=True,
       null=True,
       help_text="Certificado de Inspeção Veicular"
   )
   cipp_validade = models.DateField(
       "CIPP - Validade",
       blank=True,
       null=True,
       help_text="Certificado de Inspeção para Transporte de Produtos Perigosos"
   )
   afericao_validade = models.DateField(
       "Aferição - Validade",
       blank=True,
       null=True,
       help_text="Aferição de Tacógrafo"
   )
   crlv_validade = models.DateField(
       "CRLV - Validade",
       blank=True,
       null=True,
       help_text="Certificado de Registro e Licenciamento de Veículo"
   )
   cronotacografo_validade = models.DateField(
       "Cronotacógrafo - Validade",
       blank=True,
       null=True,
       help_text="Validade da aferição do cronotacógrafo"
   )
   seguro_validade = models.DateField(
       "Seguro - Validade",
       blank=True,
       null=True
   )
   laudo_vistoria_validade = models.DateField(
       "Laudo de Vistoria - Validade",
       blank=True,
       null=True
   )

   # Status
   ativo = models.BooleanField(default=True)
   observacoes = models.TextField("Observações", blank=True, null=True)

   # Integração com GPS
   gps_identificador = models.CharField(
       "ID no GPS",
       max_length=60,
       blank=True,
       null=True,
       help_text="Identificador do veículo no sistema de rastreamento GPS"
   )
   gps_provedor = models.CharField(
       "Provedor GPS",
       max_length=30,
       blank=True,
       null=True,
       help_text="Ex: onixsat, sitrack, autotrac, sascar"
   )
   gps_ultima_sincronizacao = models.DateTimeField(
       "Última sincronização GPS",
       null=True,
       blank=True
   )

   criado_em = models.DateTimeField(auto_now_add=True)
   atualizado_em = models.DateTimeField(auto_now=True)

   @property
   def placa_normalizada(self):
       """Placa sem formatação, em maiúsculas (ex.: ABC1234 ou ABC1D23)."""
       return normalizar_placa(self.placa)

   def __str__(self):
       return self.placa

   def get_documentos_vencendo(self, dias=30):
       """
       Retorna lista de documentos que vencem em X dias.

       Args:
           dias (int): Número de dias para considerar "próximo do vencimento"

       Returns:
           list: Lista de dicionários com documentos vencendo
       """
       from datetime import date, timedelta

       hoje = date.today()
       data_limite = hoje + timedelta(days=dias)
       documentos_vencendo = []

       documentos_verificar = [
           ('CIV', self.civ_validade),
           ('CIPP', self.cipp_validade),
           ('Aferição', self.afericao_validade),
           ('CRLV', self.crlv_validade),
           ('Cronotacógrafo', self.cronotacografo_validade),
           ('Seguro', self.seguro_validade),
           ('Laudo de Vistoria', self.laudo_vistoria_validade),
       ]

       for nome_doc, validade in documentos_verificar:
           if validade and validade <= data_limite:
               dias_restantes = (validade - hoje).days
               documentos_vencendo.append({
                   'documento': nome_doc,
                   'validade': validade,
                   'vencido': validade < hoje,
                   'dias_restantes': dias_restantes
               })

       # Verificar documentos anexos com validade
       for doc_anexo in self.documentos_anexos.filter(validade__isnull=False):
           if doc_anexo.validade <= data_limite:
               dias_restantes = (doc_anexo.validade - hoje).days
               # Usar o nome do documento ou o tipo formatado
               nome_doc = doc_anexo.nome or doc_anexo.get_tipo_display()
               documentos_vencendo.append({
                   'documento': f'{nome_doc} (anexo)',
                   'validade': doc_anexo.validade,
                   'vencido': doc_anexo.validade < hoje,
                   'dias_restantes': dias_restantes,
                   'documento_anexo_id': str(doc_anexo.id)
               })

       return documentos_vencendo

   class Meta:
       db_table = "veiculo"
       verbose_name = "Veículo"
       verbose_name_plural = "Veículos"
       ordering = ["placa"]
       indexes = [
           models.Index(fields=['placa']),
           models.Index(fields=['ativo', 'placa']),
       ]


class CompartimentacaoVeiculo(models.Model):
    """Modelo para compartimentação de veículos (bocas)."""

    veiculo = models.ForeignKey(
        Veiculo,
        on_delete=models.CASCADE,
        related_name='compartimentos',
        verbose_name="Veículo"
    )
    numero_boca = models.PositiveSmallIntegerField(
        "Número da Boca",
        help_text="Número da boca (1-9)"
    )
    capacidade_m3 = models.DecimalField(
        "Capacidade (M³)",
        max_digits=10,
        decimal_places=2,
        help_text="Capacidade da boca em metros cúbicos"
    )

    class Meta:
        db_table = "compartimentacao_veiculo"
        verbose_name = "Compartimento de Veículo"
        verbose_name_plural = "Compartimentos de Veículos"
        ordering = ['veiculo', 'numero_boca']
        unique_together = ('veiculo', 'numero_boca')
        indexes = [
            models.Index(fields=['veiculo', 'numero_boca']),
        ]

    def __str__(self):
        return f"{self.veiculo.placa} - Boca {self.numero_boca} ({self.capacidade_m3}m³)"

    def clean(self):
        """Validações customizadas."""
        from django.core.exceptions import ValidationError

        # Validar número da boca (1-9)
        if self.numero_boca < 1 or self.numero_boca > 9:
            raise ValidationError({'numero_boca': 'Número da boca deve estar entre 1 e 9.'})

        # Capacidade deve ser positiva
        if self.capacidade_m3 and self.capacidade_m3 <= 0:
            raise ValidationError({'capacidade_m3': 'Capacidade deve ser maior que zero.'})


class ManutencaoVeiculo(models.Model):
   """
   Registro de cada serviço de manutenção realizado no veículo.
   Os valores de peça + mão‑de‑obra são somados automaticamente em `valor_total`.
   """
   TIPO_MANUTENCAO_OPCOES = (
       ("preventiva", "Preventiva"),
       ("corretiva", "Corretiva"),
       ("preditiva", "Preditiva"),
   )

   STATUS_OPCOES = (
       ("agendada", "Agendada"),
       ("em_andamento", "Em Andamento"),
       ("concluida", "Concluída"),
       ("cancelada", "Cancelada"),
   )

   veiculo = models.ForeignKey(
       Veiculo,
       on_delete=models.PROTECT,
       related_name="manutencoes",
       verbose_name="Veículo",
   )
   tipo = models.CharField(
       "Tipo de Manutenção",
       max_length=20,
       choices=TIPO_MANUTENCAO_OPCOES,
       default="preventiva",
       null=True,
       blank=True
   )
   descricao = models.TextField("Descrição do Serviço", null=True, blank=True)
   data_agendada = models.DateField("Data Agendada", null=True, blank=True)
   data_realizada = models.DateField("Data Realizada", null=True, blank=True)
   quilometragem = models.PositiveIntegerField("Quilometragem Atual", null=True, blank=True)
   custo = models.DecimalField("Custo Total", max_digits=12, decimal_places=2, default=Decimal("0.00"))
   fornecedor = models.CharField("Fornecedor/Oficina", max_length=120, null=True, blank=True)
   status = models.CharField(max_length=20, choices=STATUS_OPCOES, default="agendada")
   observacoes = models.TextField(null=True, blank=True)
   nota_fiscal = models.CharField("Número Nota Fiscal", max_length=44, null=True, blank=True)
   arquivo_nota = models.FileField(
       "Arquivo Nota Fiscal",
       upload_to='manutencoes/notas/%Y/%m/',
       null=True,
       blank=True,
       help_text="Arquivo da nota fiscal (PDF, imagem)"
   )

   # Campos legados (mantidos para compatibilidade com dados existentes)
   data_servico = models.DateField(verbose_name="Data do Serviço", null=True, blank=True)
   servico_realizado = models.CharField(max_length=120, null=True, blank=True)
   oficina = models.CharField(max_length=120, null=True, blank=True)
   peca_utilizada = models.CharField(max_length=120, null=True, blank=True)
   valor_peca = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
   valor_mao_obra = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
   valor_total = models.DecimalField(max_digits=12, decimal_places=2, editable=False, default=Decimal("0.00"))

   criado_em = models.DateTimeField(auto_now_add=True)
   atualizado_em = models.DateTimeField(auto_now=True)

   def save(self, *args, **kwargs):
       # soma automática dos custos legados
       self.valor_total = (self.valor_peca or Decimal("0")) + (self.valor_mao_obra or Decimal("0"))
       # Se não tiver custo definido, usa o valor_total legado
       if not self.custo and self.valor_total:
           self.custo = self.valor_total
       # Migrar dados legados para novos campos se necessário
       if self.data_servico and not self.data_agendada:
           self.data_agendada = self.data_servico
       if self.servico_realizado and not self.descricao:
           self.descricao = self.servico_realizado
       if self.oficina and not self.fornecedor:
           self.fornecedor = self.oficina
       super().save(*args, **kwargs)

   def __str__(self):
       data = self.data_agendada or self.data_servico
       desc = self.descricao or self.servico_realizado or "Manutenção"
       data_str = data.strftime('%d/%m/%Y') if data else 'sem data'
       return f"{self.veiculo.placa} – {desc[:50]} ({data_str})"

   class Meta:
       verbose_name = "Manutenção de Veículo"
       verbose_name_plural = "Manutenções de Veículos"
       ordering = ["-data_agendada", "-criado_em"]


# --------------------------------------------------
#  N O V O S   M O D E L O S   (Pagamento e Parametrização)
# --------------------------------------------------

class FaixaKM(models.Model):
   """Parametrização de valores de pagamento por faixa de KM para condutores próprios."""
   min_km = models.PositiveIntegerField("KM Mínimo", unique=True) # Garante que não haja sobreposição inicial
   max_km = models.PositiveIntegerField("KM Máximo", null=True, blank=True, help_text="Deixe em branco para a última faixa (sem limite superior)")
   valor_pago = models.DecimalField("Valor a Pagar (R$)", max_digits=10, decimal_places=2)
   # Adicionar validação no save para garantir que max_km > min_km e que não haja sobreposições completas

   class Meta:
       verbose_name = "Faixa de KM (Pagamento Próprio)"
       verbose_name_plural = "Faixas de KM (Pagamento Próprio)"
       ordering = ['min_km']

   def __str__(self):
       if self.max_km:
           return f"De {self.min_km}km até {self.max_km}km: R$ {self.valor_pago}"
       else:
           return f"Acima de {self.min_km}km: R$ {self.valor_pago}"


class PagamentoAgregado(models.Model):
   """Registra o pagamento a ser realizado para condutores agregados (baseado em % do frete)."""
   STATUS_PAGAMENTO = [('pendente','Pendente'), ('pago','Pago')]

   cte = models.OneToOneField(CTeDocumento, on_delete=models.CASCADE, related_name='pagamento_agregado')
   placa = models.CharField("Placa Veículo", max_length=8, db_index=True)
   condutor_cpf = models.CharField("CPF Condutor", max_length=11, null=True, blank=True, db_index=True) # Melhor usar CPF para identificar unicamente
   condutor_nome = models.CharField("Nome Condutor", max_length=120) # Mantém nome para referência
   valor_frete_total = models.DecimalField("Valor Frete (Base)", max_digits=12, decimal_places=2)
   percentual_repasse = models.DecimalField("Percentual Repasse (%)", max_digits=5, decimal_places=2, default=Decimal('25.00'))
   desconto = models.DecimalField("Desconto (R$)", max_digits=12, decimal_places=2, default=Decimal('0.00'), help_text="Desconto aplicado sobre o valor a repassar")
   valor_repassado = models.DecimalField("Valor Repasse (R$)", max_digits=12, decimal_places=2)
   obs = models.TextField("Observações", blank=True, null=True)
   status = models.CharField("Status", max_length=10, choices=STATUS_PAGAMENTO, default='pendente', db_index=True)
   data_prevista = models.DateField("Data Prevista")
   data_pagamento = models.DateField("Data Pagamento", null=True, blank=True)
   comprovante = models.FileField(
       "Comprovante",
       upload_to='comprovantes/agregados/%Y/%m/',
       null=True,
       blank=True,
       help_text="Comprovante de pagamento (PDF, imagem)"
   )
   criado_em = models.DateTimeField(auto_now_add=True)
   atualizado_em = models.DateTimeField(auto_now=True)

   class Meta:
       verbose_name = "Pagamento Agregado (CT-e)"
       verbose_name_plural = "Pagamentos Agregados (CT-e)"
       ordering = ['-data_prevista', 'status']

   def clean(self):
       from django.core.exceptions import ValidationError
       if self.cte_id and PagamentoProprio.objects.filter(cte_id=self.cte_id).exists():
           raise ValidationError(
               "Este CT-e já possui um pagamento próprio associado. "
               "Não é permitido ter pagamento agregado e próprio simultaneamente."
           )

   def save(self, *args, **kwargs):
       self.clean()
       # Calcula o valor do repasse automaticamente: (frete * percentual / 100) - desconto
       if self.valor_frete_total and self.percentual_repasse:
           valor_bruto = (self.valor_frete_total * self.percentual_repasse) / Decimal('100.0')
           desconto = self.desconto or Decimal('0.00')
           self.valor_repassado = max(valor_bruto - desconto, Decimal('0.00'))  # Não permite valor negativo
       else:
           self.valor_repassado = Decimal('0.00')
       super().save(*args, **kwargs)

   def __str__(self):
       return f"Pgto Agregado CT-e {self.cte.identificacao.numero if hasattr(self.cte, 'identificacao') else self.cte_id} - {self.condutor_nome or self.condutor_cpf}"


class PagamentoProprio(models.Model):
   """Pagamento de veículos próprios, podendo ser por período ou por CT-e individual."""
   STATUS_PAGAMENTO = [('pendente','Pendente'), ('pago','Pago')]

   veiculo = models.ForeignKey(Veiculo, on_delete=models.PROTECT, related_name='pagamentos_proprios')
   # Ex: '2025-04-1Q' (1ª Quinzena), '2025-04-2Q' (2ª Quinzena) ou '2025-04' (Mensal)
   periodo = models.CharField("Período (AAAA-MM ou AAAA-MM-XQ)", max_length=10, db_index=True)

   # CT-e vinculado (opcional, relação 1:1)
   cte = models.OneToOneField(
       'CTeDocumento', on_delete=models.CASCADE,
       related_name='pagamento_proprio', verbose_name="CT-e Vinculado",
       null=True, blank=True
   )
   cte_numero = models.CharField("Número do CT-e", max_length=20, blank=True, null=True)
   motorista_nome = models.CharField("Nome do Condutor", max_length=255, blank=True, null=True)
   motorista_cpf = models.CharField("CPF do Condutor", max_length=14, blank=True, null=True)
   data_prevista = models.DateField("Data Prevista Pagamento", null=True, blank=True)

   km_total_periodo = models.PositiveIntegerField("KM Total no Período", default=0)
   valor_base_faixa = models.DecimalField("Valor Base (Faixa KM)", max_digits=12, decimal_places=2, null=True, blank=True)
   ajustes = models.DecimalField("Ajustes/Adicionais (R$)", max_digits=12, decimal_places=2, default=Decimal('0.00'))
   valor_total_pagar = models.DecimalField("Valor Total a Pagar (R$)", max_digits=12, decimal_places=2)
   status = models.CharField("Status", max_length=10, choices=STATUS_PAGAMENTO, default='pendente', db_index=True)
   data_pagamento = models.DateField("Data Pagamento", null=True, blank=True)
   comprovante = models.FileField(
       "Comprovante",
       upload_to='comprovantes/proprios/%Y/%m/',
       null=True,
       blank=True,
       help_text="Comprovante de pagamento (PDF, imagem)"
   )
   obs = models.TextField("Observações", blank=True, null=True)
   criado_em = models.DateTimeField(auto_now_add=True)
   atualizado_em = models.DateTimeField(auto_now=True)

   class Meta:
       verbose_name = "Pagamento Próprio"
       verbose_name_plural = "Pagamentos Próprios"
       ordering = ['-periodo', 'veiculo__placa']
       # Removido unique_together para permitir múltiplos registros por veículo/período

   def clean(self):
       from django.core.exceptions import ValidationError
       if self.cte_id and PagamentoAgregado.objects.filter(cte_id=self.cte_id).exists():
           raise ValidationError(
               "Este CT-e já possui um pagamento agregado associado. "
               "Não é permitido ter pagamento agregado e próprio simultaneamente."
           )

   def save(self, *args, **kwargs):
       self.clean()
       # Calcula o valor total a pagar
       self.valor_total_pagar = (self.valor_base_faixa or Decimal('0.00')) + (self.ajustes or Decimal('0.00'))
       super().save(*args, **kwargs)

   def __str__(self):
       if self.cte_numero:
           return f"Pgto Próprio {self.veiculo.placa} - CT-e {self.cte_numero}"
       return f"Pgto Próprio {self.veiculo.placa} - Período {self.periodo}"


# --------------------------------------------------
#  M O D E L O S   D E   S I S T E M A
# --------------------------------------------------

class ParametroSistema(models.Model):
   """Parâmetros gerais do sistema."""
   GRUPOS_PARAMETROS = [
       ('GERAL', 'Configurações Gerais'),
       ('ALERTA', 'Configurações de Alertas'),
       ('PAGTO', 'Configurações de Pagamentos'),
       ('EMAIL', 'Configurações de Email'),
       ('BACKUP', 'Configurações de Backup'),
   ]

   nome = models.CharField("Nome do Parâmetro", max_length=50, unique=True)
   descricao = models.CharField("Descrição", max_length=255)
   valor = models.CharField("Valor", max_length=255)
   grupo = models.CharField("Grupo", max_length=10, choices=GRUPOS_PARAMETROS, default='GERAL')
   tipo_dado = models.CharField("Tipo de Dado", max_length=20, 
                               choices=[('int', 'Inteiro'), ('float', 'Decimal'), 
                                        ('str', 'Texto'), ('bool', 'Booleano'),
                                        ('date', 'Data'), ('json', 'JSON')], 
                               default='str')
   editavel = models.BooleanField("Editável", default=True)
   criado_em = models.DateTimeField(auto_now_add=True)
   atualizado_em = models.DateTimeField(auto_now=True)

   class Meta:
       verbose_name = "Parâmetro do Sistema"
       verbose_name_plural = "Parâmetros do Sistema"
       ordering = ['grupo', 'nome']

   def __str__(self):
       return f"{self.nome} [{self.grupo}]"
   
   def get_valor_tipado(self):
       """Retorna o valor convertido para o tipo correto."""
       import json
       from datetime import datetime
       
       if not self.valor:
           return None
           
       if self.tipo_dado == 'int':
           return int(self.valor)
       elif self.tipo_dado == 'float':
           return float(self.valor)
       elif self.tipo_dado == 'bool':
           return self.valor.lower() in ('true', 't', '1', 'sim', 's')
       elif self.tipo_dado == 'date':
           try:
               return datetime.strptime(self.valor, '%Y-%m-%d').date()
           except (ValueError, TypeError):
               return None
       elif self.tipo_dado == 'json':
           try:
               return json.loads(self.valor)
           except (json.JSONDecodeError, TypeError, ValueError):
               return {}
       else:  # Assume string
           return self.valor


class ConfiguracaoEmpresa(models.Model):
   """Configurações da empresa usuária do sistema."""
   razao_social = models.CharField("Razão Social", max_length=120)
   nome_fantasia = models.CharField("Nome Fantasia", max_length=120, null=True, blank=True)
   cnpj = models.CharField("CNPJ", max_length=14, unique=True)
   ie = models.CharField("Inscrição Estadual", max_length=20, null=True, blank=True)
   rntrc = models.CharField("RNTRC", max_length=8, null=True, blank=True)
   email = models.EmailField("Email", null=True, blank=True)
   telefone = models.CharField("Telefone", max_length=15, null=True, blank=True)
   
   # Endereço
   cep = models.CharField("CEP", max_length=8, null=True, blank=True)
   logradouro = models.CharField("Logradouro", max_length=100, null=True, blank=True)
   numero = models.CharField("Número", max_length=10, null=True, blank=True)
   complemento = models.CharField("Complemento", max_length=60, null=True, blank=True)
   bairro = models.CharField("Bairro", max_length=60, null=True, blank=True)
   municipio = models.CharField("Município", max_length=60, null=True, blank=True)
   uf = models.CharField("UF", max_length=2, null=True, blank=True)
   
   # Logotipo
   logo = models.ImageField("Logotipo", upload_to='logos/', null=True, blank=True)
   
   # Telefones de destinatários para notificações
   telefone_gestor = models.CharField("Telefone do Gestor", max_length=20, null=True, blank=True,
                                      help_text="Recebe notificações de pagamentos e alertas críticos")
   telefone_financeiro = models.CharField("Telefone do Financeiro", max_length=20, null=True, blank=True,
                                          help_text="Recebe notificações de cobranças e faturamentos")
   telefone_operacional = models.CharField("Telefone do Operacional", max_length=20, null=True, blank=True,
                                           help_text="Recebe notificações de manutenções e vencimentos")

   # Dados adicionais
   certificado_digital = models.CharField("Certificado A1 (Nome)", max_length=255, null=True, blank=True)
   responsavel_tecnico_cnpj = models.CharField("CNPJ Responsável Técnico", max_length=14, null=True, blank=True)
   responsavel_tecnico_contato = models.CharField("Nome Responsável Técnico", max_length=60, null=True, blank=True)
   responsavel_tecnico_email = models.EmailField("Email Responsável Técnico", null=True, blank=True)
   responsavel_tecnico_fone = models.CharField("Telefone Responsável Técnico", max_length=15, null=True, blank=True)

   criado_em = models.DateTimeField(auto_now_add=True)
   atualizado_em = models.DateTimeField(auto_now=True)

   class Meta:
       verbose_name = "Configuração da Empresa"
       verbose_name_plural = "Configuração da Empresa"

   def __str__(self):
       return self.razao_social


class RegistroBackup(models.Model):
   """Registra os backups realizados pelo sistema."""
   data_hora = models.DateTimeField("Data/Hora", auto_now_add=True)
   nome_arquivo = models.CharField("Nome do Arquivo", max_length=100)
   tamanho_bytes = models.PositiveBigIntegerField("Tamanho (bytes)")
   md5_hash = models.CharField("Hash MD5", max_length=32)
   localizacao = models.CharField("Localização", max_length=255)
   usuario = models.CharField("Usuário", max_length=150)
   status = models.CharField("Status", max_length=20, 
                            choices=[('completo', 'Completo'), 
                                     ('parcial', 'Parcial'),
                                     ('erro', 'Erro')], 
                            default='completo')
   detalhes = models.TextField("Detalhes", null=True, blank=True)

   class Meta:
       verbose_name = "Registro de Backup"
       verbose_name_plural = "Registros de Backup"
       ordering = ['-data_hora']

   def __str__(self):
       return f"Backup {self.nome_arquivo} ({self.data_hora:%d/%m/%Y %H:%M})"


class AlertaSistema(models.Model):
    """Registros de alertas gerais do sistema."""
    PRIORIDADE_OPCOES = [
        ('alta', 'Alta'),
        ('media', 'Média'),
        ('baixa', 'Baixa'),
    ]

    prioridade = models.CharField(max_length=10, choices=PRIORIDADE_OPCOES)
    data_hora = models.DateTimeField(auto_now_add=True)
    tipo = models.CharField(max_length=60, blank=True)
    mensagem = models.TextField()
    dados_adicionais = models.JSONField(null=True, blank=True)
    modulo = models.CharField(max_length=60, blank=True)
    usuario = models.CharField(max_length=60, blank=True)
    referencia = models.CharField(max_length=60, blank=True)
    lido = models.BooleanField("Lido", default=False)
    resolvido = models.BooleanField("Resolvido", default=False)
    data_resolucao = models.DateTimeField("Data Resolução", null=True, blank=True)

    class Meta:
        verbose_name = "Alerta do Sistema"
        verbose_name_plural = "Alertas do Sistema"
        ordering = ['-data_hora']


    def __str__(self):
        return f"[{self.prioridade.upper()}] {self.tipo or 'Alerta'}"


# --------------------------------------------------
#  C I O T - Código de Identificação da Operação de Transporte
# --------------------------------------------------
class CIOT(models.Model):
    """
    Gerenciamento de Códigos de Identificação da Operação de Transporte (CIOT).
    O CIOT é obrigatório para operações de transporte remunerado rodoviário
    de cargas e deve ser informado no CT-e/MDF-e.
    """

    STATUS_CHOICES = [
        ('ativo', 'Ativo'),
        ('usado', 'Usado'),
        ('vencido', 'Vencido'),
        ('cancelado', 'Cancelado'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    codigo = models.CharField(
        "Código CIOT",
        max_length=12,
        unique=True,
        db_index=True,
        help_text="Código de 12 dígitos numéricos gerado no sistema CIOT/NTT"
    )
    descricao = models.CharField("Descrição", max_length=255, blank=True, null=True)

    # Responsáveis pela operação
    responsavel_cnpj = models.CharField("CNPJ Responsável", max_length=14, blank=True, null=True)
    responsavel_cpf = models.CharField("CPF Responsável", max_length=11, blank=True, null=True)

    # Contratante / Contratado
    cliente = models.ForeignKey(
        'Cliente',
        on_delete=models.PROTECT,
        related_name='ciots',
        verbose_name="Contratante",
        null=True,
        blank=True
    )
    motorista = models.ForeignKey(
        'Motorista',
        on_delete=models.PROTECT,
        related_name='ciots',
        verbose_name="Contratado / Motorista",
        null=True,
        blank=True
    )

    # Origem / Destino
    origem_cidade = models.CharField("Cidade Origem", max_length=120, blank=True, null=True)
    origem_uf = models.CharField("UF Origem", max_length=2, blank=True, null=True)
    destino_cidade = models.CharField("Cidade Destino", max_length=120, blank=True, null=True)
    destino_uf = models.CharField("UF Destino", max_length=2, blank=True, null=True)

    # Dados financeiros/operacionais
    valor = models.DecimalField("Valor da Operação", max_digits=15, decimal_places=2, null=True, blank=True)
    data_emissao = models.DateField("Data de Emissão", null=True, blank=True)
    data_validade = models.DateField("Data de Validade", null=True, blank=True)

    # Vínculos (opcional)
    cte = models.ForeignKey(
        'CTeDocumento',
        on_delete=models.SET_NULL,
        related_name='ciots',
        verbose_name="CT-e Vinculado",
        null=True,
        blank=True
    )
    mdfe = models.ForeignKey(
        'MDFeDocumento',
        on_delete=models.SET_NULL,
        related_name='ciots',
        verbose_name="MDF-e Vinculado",
        null=True,
        blank=True
    )
    ordem = models.ForeignKey(
        'OrdemViagem',
        on_delete=models.SET_NULL,
        related_name='ciots',
        verbose_name="Ordem de Viagem",
        null=True,
        blank=True
    )

    status = models.CharField("Status", max_length=10, choices=STATUS_CHOICES, default='ativo', db_index=True)
    observacao = models.TextField("Observação", blank=True, null=True)

    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "ciot"
        verbose_name = "CIOT"
        verbose_name_plural = "CIOTs"
        ordering = ['-criado_em']
        indexes = [
            models.Index(fields=['status', 'data_validade']),
            models.Index(fields=['cliente', 'status']),
            models.Index(fields=['motorista', 'status']),
        ]

    def __str__(self):
        return f"CIOT {self.codigo}"

    def clean(self):
        from django.core.exceptions import ValidationError
        if self.codigo and not self.codigo.isdigit():
            raise ValidationError("O código CIOT deve conter apenas números.")
        if self.codigo and len(self.codigo) != 12:
            raise ValidationError("O código CIOT deve conter exatamente 12 dígitos.")


# --------------------------------------------------
#  C A D A S T R O   D E   C L I E N T E S
# --------------------------------------------------
class Cliente(models.Model):
    """Modelo para cadastro de clientes (tomadores de serviço)."""

    # ID
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # Dados Fiscais
    razao_social = models.CharField("Razão Social", max_length=255)
    nome_fantasia = models.CharField("Nome Fantasia", max_length=255, blank=True, null=True)
    cnpj = models.CharField("CNPJ", max_length=18, unique=True, db_index=True)
    ie = models.CharField("Inscrição Estadual", max_length=20, blank=True, null=True)

    # Endereço
    logradouro = models.CharField("Logradouro", max_length=255, blank=True, null=True)
    numero = models.CharField("Número", max_length=20, blank=True, null=True)
    complemento = models.CharField("Complemento", max_length=100, blank=True, null=True)
    bairro = models.CharField("Bairro", max_length=100, blank=True, null=True)
    cidade = models.CharField("Cidade", max_length=100, blank=True, null=True)
    estado = models.CharField("Estado (UF)", max_length=2, blank=True, null=True)
    cep = models.CharField("CEP", max_length=10, blank=True, null=True)

    # Contato
    email = models.EmailField("E-mail", max_length=255, blank=True, null=True)
    telefone = models.CharField("Telefone", max_length=20, blank=True, null=True)

    # Informações Operacionais
    distancia = models.DecimalField(
        "Distância da Base (KM)",
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Distância em KM da base até o cliente"
    )
    tipo_frete = models.CharField(
        "Tipo de Frete Padrão",
        max_length=3,
        choices=[('CIF', 'CIF'), ('FOB', 'FOB')],
        default='CIF',
        help_text="Tipo de frete padrão para este cliente"
    )

    # Metadados
    ativo = models.BooleanField("Ativo", default=True)
    observacoes = models.TextField("Observações", blank=True, null=True)
    criado_em = models.DateTimeField("Criado em", auto_now_add=True)
    atualizado_em = models.DateTimeField("Atualizado em", auto_now=True)

    class Meta:
        db_table = "cliente"
        verbose_name = "Cliente"
        verbose_name_plural = "Clientes"
        ordering = ['razao_social']
        indexes = [
            models.Index(fields=['cnpj']),
            models.Index(fields=['ativo', 'razao_social']),
        ]

    def __str__(self):
        return f"{self.razao_social} ({self.cnpj})"

    def clean(self):
        """Validações customizadas."""
        from django.core.exceptions import ValidationError

        # Validação de CNPJ (dígitos verificadores)
        if self.cnpj:
            try:
                validar_cnpj(self.cnpj)
            except ValidationError as exc:
                raise ValidationError({'cnpj': exc.message})

        # Validação básica de Inscrição Estadual
        if self.ie:
            try:
                validar_ie(self.ie, uf=self.estado)
            except ValidationError as exc:
                raise ValidationError({'ie': exc.message})

        # Validação de UF
        if self.estado:
            ufs_validas = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO',
                          'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
                          'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO']
            if self.estado.upper() not in ufs_validas:
                raise ValidationError({'estado': 'UF inválida.'})


# --------------------------------------------------
#  C A D A S T R O   D E   M O T O R I S T A S
# --------------------------------------------------
class Motorista(models.Model):
    """Modelo para cadastro de motoristas."""

    # ID
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # Dados Pessoais
    nome = models.CharField("Nome Completo", max_length=255)
    cpf = models.CharField("CPF", max_length=14, unique=True, db_index=True)

    # CNH (nullable para permitir auto-cadastro a partir do XML, que não traz CNH;
    # unique continua valendo — múltiplos NULL não colidem no Postgres)
    cnh = models.CharField("CNH", max_length=20, unique=True, db_index=True, blank=True, null=True)
    categoria_cnh = models.CharField(
        "Categoria CNH",
        max_length=5,
        choices=[
            ('A', 'A'), ('B', 'B'), ('C', 'C'), ('D', 'D'), ('E', 'E'),
            ('AB', 'AB'), ('AC', 'AC'), ('AD', 'AD'), ('AE', 'AE')
        ],
        blank=True,
        null=True
    )
    validade_cnh = models.DateField("Validade CNH", blank=True, null=True)

    # Certificações Obrigatórias
    nr20_validade = models.DateField(
        "NR20 - Validade",
        blank=True,
        null=True,
        help_text="Norma Regulamentadora 20 - Inflamáveis e Combustíveis"
    )
    nr35_validade = models.DateField(
        "NR35 - Validade",
        blank=True,
        null=True,
        help_text="Norma Regulamentadora 35 - Trabalho em Altura"
    )
    mopp_validade = models.DateField(
        "MOPP - Validade",
        blank=True,
        null=True,
        help_text="Movimentação Operacional de Produtos Perigosos"
    )
    toxicologico_validade = models.DateField(
        "Exame Toxicológico - Validade",
        blank=True,
        null=True,
        help_text="Exame toxicológico obrigatório para motoristas profissionais"
    )
    aso_validade = models.DateField(
        "ASO - Validade",
        blank=True,
        null=True,
        help_text="Atestado de Saúde Ocupacional"
    )

    # Contato
    telefone = models.CharField("Telefone", max_length=20, blank=True, null=True)
    email = models.EmailField("E-mail", blank=True, null=True)

    # Endereço
    logradouro = models.CharField("Logradouro", max_length=255, blank=True, null=True)
    numero = models.CharField("Número", max_length=20, blank=True, null=True)
    complemento = models.CharField("Complemento", max_length=100, blank=True, null=True)
    bairro = models.CharField("Bairro", max_length=100, blank=True, null=True)
    cidade = models.CharField("Cidade", max_length=100, blank=True, null=True)
    estado = models.CharField("Estado (UF)", max_length=2, blank=True, null=True)
    cep = models.CharField("CEP", max_length=10, blank=True, null=True)

    # Dados Bancários / Pix
    TIPO_CHAVE_PIX_CHOICES = [
        ('cpf', 'CPF'),
        ('cnpj', 'CNPJ'),
        ('celular', 'Celular'),
        ('email', 'E-mail'),
        ('aleatoria', 'Chave Aleatória'),
    ]
    TIPO_CONTA_CHOICES = [
        ('corrente', 'Corrente'),
        ('poupanca', 'Poupança'),
        ('salario', 'Salário'),
    ]
    tipo_chave_pix = models.CharField(
        "Tipo de Chave Pix",
        max_length=10,
        choices=TIPO_CHAVE_PIX_CHOICES,
        blank=True,
        null=True
    )
    chave_pix = models.CharField("Chave Pix", max_length=140, blank=True, null=True)
    banco = models.CharField("Banco", max_length=100, blank=True, null=True)
    agencia = models.CharField("Agência", max_length=10, blank=True, null=True)
    conta = models.CharField("Conta", max_length=20, blank=True, null=True)
    tipo_conta = models.CharField(
        "Tipo de Conta",
        max_length=10,
        choices=TIPO_CONTA_CHOICES,
        blank=True,
        null=True
    )
    favorecido = models.CharField(
        "Favorecido",
        max_length=255,
        blank=True,
        null=True,
        help_text="Nome do titular da conta, se diferente do motorista"
    )

    # Metadados
    ativo = models.BooleanField("Ativo", default=True)
    cadastro_automatico = models.BooleanField(
        "Cadastro automático (via XML)", default=False,
        help_text="Criado automaticamente a partir de um condutor de CT-e/MDF-e; pode estar incompleto (sem CNH/validades)."
    )
    observacoes = models.TextField("Observações", blank=True, null=True)
    criado_em = models.DateTimeField("Criado em", auto_now_add=True)
    atualizado_em = models.DateTimeField("Atualizado em", auto_now=True)

    @property
    def cadastro_completo(self):
        """True se os dados essenciais de compliance estão preenchidos."""
        return bool(self.cnh and self.validade_cnh)

    class Meta:
        db_table = "motorista"
        verbose_name = "Motorista"
        verbose_name_plural = "Motoristas"
        ordering = ['nome']
        indexes = [
            models.Index(fields=['cpf']),
            models.Index(fields=['cnh']),
            models.Index(fields=['ativo', 'nome']),
        ]

    def __str__(self):
        return f"{self.nome} (CPF: {self.cpf})"

    def clean(self):
        """Validações customizadas."""
        from django.core.exceptions import ValidationError

        # Validação de CPF (dígitos verificadores)
        if self.cpf:
            try:
                validar_cpf(self.cpf)
            except ValidationError as exc:
                raise ValidationError({'cpf': exc.message})

    def get_documentos_vencendo(self, dias=30):
        """
        Retorna lista de documentos que vencem em X dias.

        Args:
            dias (int): Número de dias para considerar "próximo do vencimento"

        Returns:
            list: Lista de dicionários com documentos vencendo
        """
        from datetime import date, timedelta

        hoje = date.today()
        data_limite = hoje + timedelta(days=dias)
        documentos_vencendo = []

        # Verificar CNH
        if self.validade_cnh and self.validade_cnh <= data_limite:
            dias_restantes = (self.validade_cnh - hoje).days
            documentos_vencendo.append({
                'documento': 'CNH',
                'validade': self.validade_cnh,
                'vencido': self.validade_cnh < hoje,
                'dias_restantes': dias_restantes
            })

        # Verificar NR20
        if self.nr20_validade and self.nr20_validade <= data_limite:
            dias_restantes = (self.nr20_validade - hoje).days
            documentos_vencendo.append({
                'documento': 'NR20',
                'validade': self.nr20_validade,
                'vencido': self.nr20_validade < hoje,
                'dias_restantes': dias_restantes
            })

        # Verificar NR35
        if self.nr35_validade and self.nr35_validade <= data_limite:
            dias_restantes = (self.nr35_validade - hoje).days
            documentos_vencendo.append({
                'documento': 'NR35',
                'validade': self.nr35_validade,
                'vencido': self.nr35_validade < hoje,
                'dias_restantes': dias_restantes
            })

        # Verificar MOPP
        if self.mopp_validade and self.mopp_validade <= data_limite:
            dias_restantes = (self.mopp_validade - hoje).days
            documentos_vencendo.append({
                'documento': 'MOPP',
                'validade': self.mopp_validade,
                'vencido': self.mopp_validade < hoje,
                'dias_restantes': dias_restantes
            })

        # Verificar Exame Toxicológico
        if self.toxicologico_validade and self.toxicologico_validade <= data_limite:
            dias_restantes = (self.toxicologico_validade - hoje).days
            documentos_vencendo.append({
                'documento': 'Toxicológico',
                'validade': self.toxicologico_validade,
                'vencido': self.toxicologico_validade < hoje,
                'dias_restantes': dias_restantes
            })

        # Verificar ASO
        if self.aso_validade and self.aso_validade <= data_limite:
            dias_restantes = (self.aso_validade - hoje).days
            documentos_vencendo.append({
                'documento': 'ASO',
                'validade': self.aso_validade,
                'vencido': self.aso_validade < hoje,
                'dias_restantes': dias_restantes
            })

        # Verificar documentos anexos com validade
        for doc_anexo in self.documentos_anexos.filter(validade__isnull=False):
            if doc_anexo.validade <= data_limite:
                dias_restantes = (doc_anexo.validade - hoje).days
                # Usar o nome do documento ou o tipo formatado
                nome_doc = doc_anexo.nome or doc_anexo.get_tipo_display()
                documentos_vencendo.append({
                    'documento': f'{nome_doc} (anexo)',
                    'validade': doc_anexo.validade,
                    'vencido': doc_anexo.validade < hoje,
                    'dias_restantes': dias_restantes,
                    'documento_anexo_id': str(doc_anexo.id)
                })

        return documentos_vencendo


# --------------------------------------------------
#  C O N T A S   A   R E C E B E R  –  F A T U R A S
# --------------------------------------------------
class Fatura(models.Model):
    """Fatura de contas a receber vinculada a itens de CT-e."""

    STATUS_CHOICES = [
        ('rascunho', 'Rascunho'),
        ('enviada', 'Enviada'),
        ('paga', 'Paga'),
        ('atrasada', 'Atrasada'),
        ('cancelada', 'Cancelada'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    cliente = models.ForeignKey(
        Cliente,
        on_delete=models.PROTECT,
        related_name='faturas',
        verbose_name="Cliente"
    )
    numero = models.CharField("Número", max_length=30, unique=True, db_index=True)
    data_emissao = models.DateField("Data de Emissão", default=date.today)
    data_vencimento = models.DateField("Data de Vencimento")
    status = models.CharField(
        "Status",
        max_length=20,
        choices=STATUS_CHOICES,
        default='rascunho',
        db_index=True
    )
    valor_total = models.DecimalField(
        "Valor Total", max_digits=15, decimal_places=2, default=Decimal('0.00')
    )
    observacao = models.TextField("Observação", blank=True, null=True)
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "fatura"
        verbose_name = "Fatura"
        verbose_name_plural = "Faturas"
        ordering = ['-data_emissao', '-criado_em']

    def __str__(self):
        return f"Fatura {self.numero}"


class FaturaItem(models.Model):
    """Item de uma fatura de contas a receber."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    fatura = models.ForeignKey(
        Fatura,
        on_delete=models.CASCADE,
        related_name='itens',
        verbose_name="Fatura"
    )
    cte = models.ForeignKey(
        CTeDocumento,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='faturas_itens',
        verbose_name="CT-e"
    )
    descricao = models.CharField("Descrição", max_length=255)
    valor = models.DecimalField("Valor", max_digits=15, decimal_places=2)
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "fatura_item"
        verbose_name = "Item de Fatura"
        verbose_name_plural = "Itens de Fatura"
        ordering = ['criado_em']
        constraints = [
            models.UniqueConstraint(
                fields=['cte'],
                name='unique_fatura_item_cte',
                condition=models.Q(cte__isnull=False),
            ),
        ]

    def __str__(self):
        return f"{self.fatura.numero} - {self.descricao}"


class ContaPagar(models.Model):
    """Contas a pagar da empresa: combustível, pedágio, seguro, oficina, outras."""

    CATEGORIA_OPCOES = [
        ('combustivel', 'Combustível'),
        ('pedagio', 'Pedágio'),
        ('seguro', 'Seguro'),
        ('oficina', 'Oficina'),
        ('outras', 'Outras'),
    ]

    STATUS_OPCOES = [
        ('pendente', 'Pendente'),
        ('paga', 'Paga'),
        ('atrasada', 'Atrasada'),
        ('cancelada', 'Cancelada'),
    ]

    descricao = models.CharField("Descrição", max_length=255)
    categoria = models.CharField("Categoria", max_length=20, choices=CATEGORIA_OPCOES, default='outras')
    fornecedor = models.CharField("Fornecedor", max_length=120, blank=True, null=True)
    valor = models.DecimalField("Valor (R$)", max_digits=12, decimal_places=2)
    data_vencimento = models.DateField("Data de Vencimento")
    data_pagamento = models.DateField("Data de Pagamento", null=True, blank=True)
    status = models.CharField("Status", max_length=10, choices=STATUS_OPCOES, default='pendente', db_index=True)
    comprovante = models.FileField(
        "Comprovante",
        upload_to='comprovantes/contas_pagar/%Y/%m/',
        null=True,
        blank=True,
        help_text="Comprovante de pagamento (PDF, imagem)"
    )
    veiculo = models.ForeignKey(
        Veiculo,
        on_delete=models.PROTECT,
        related_name='contas_a_pagar',
        verbose_name="Veículo",
        null=True,
        blank=True
    )
    # viagem = models.ForeignKey('Viagem', on_delete=models.SET_NULL, related_name='contas_a_pagar', null=True, blank=True)
    observacao = models.TextField("Observação", blank=True, null=True)
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "conta_pagar"
        verbose_name = "Conta a Pagar"
        verbose_name_plural = "Contas a Pagar"
        ordering = ['-data_vencimento', 'status']

    def __str__(self):
        return f"{self.descricao} - R$ {self.valor} ({self.get_status_display()})"


class TransacaoBancaria(models.Model):
    """Transação bancária extraída de arquivos OFX/CSV."""
    TIPO_CHOICES = [('credito', 'Crédito'), ('debito', 'Débito')]

    data = models.DateField("Data")
    descricao = models.CharField("Descrição", max_length=255)
    valor = models.DecimalField("Valor", max_digits=15, decimal_places=2)
    tipo = models.CharField("Tipo", max_length=10, choices=TIPO_CHOICES)
    arquivo_origem = models.CharField("Arquivo de Origem", max_length=255)
    conciliado = models.BooleanField("Conciliado", default=False)
    fatura = models.ForeignKey(
        Fatura,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='transacoes',
        verbose_name="Fatura"
    )
    conta_pagar = models.ForeignKey(
        ContaPagar,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='transacoes',
        verbose_name="Conta a Pagar"
    )
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "transacao_bancaria"
        verbose_name = "Transação Bancária"
        verbose_name_plural = "Transações Bancárias"
        ordering = ['-data', '-criado_em']

    def __str__(self):
        return f"{self.descricao} - R$ {self.valor} ({self.get_tipo_display()})"


# --------------------------------------------------
#  D O C U M E N T O S   A N E X O S
# --------------------------------------------------

def documento_anexo_path(instance, filename):
    """
    Gera o caminho para salvar o arquivo anexo.
    Organiza por tipo de entidade e ID.
    """
    import os
    from django.utils import timezone

    # Determina o diretorio base pelo tipo de entidade
    if instance.cliente:
        base_dir = f"anexos/clientes/{instance.cliente.id}"
    elif instance.motorista:
        base_dir = f"anexos/motoristas/{instance.motorista.id}"
    elif instance.veiculo:
        base_dir = f"anexos/veiculos/{instance.veiculo.id}"
    else:
        base_dir = "anexos/outros"

    # Adiciona timestamp para evitar colisoes
    timestamp = timezone.now().strftime('%Y%m%d_%H%M%S')
    ext = os.path.splitext(filename)[1]
    new_filename = f"{timestamp}_{filename}"

    return os.path.join(base_dir, new_filename)


class DocumentoAnexo(models.Model):
    """
    Modelo generico para anexar documentos a Clientes, Motoristas ou Veiculos.
    Usa GenericForeignKey pattern simplificado com FKs opcionais.
    """

    TIPO_DOCUMENTO_CHOICES = [
        # Documentos de Cliente
        ('contrato', 'Contrato'),
        ('proposta', 'Proposta Comercial'),
        ('procuracao', 'Procuração'),

        # Documentos de Motorista
        ('cnh', 'CNH'),
        ('rg', 'RG'),
        ('cpf', 'CPF'),
        ('comprovante_residencia', 'Comprovante de Residência'),
        ('certificado_nr20', 'Certificado NR20'),
        ('certificado_nr35', 'Certificado NR35'),
        ('certificado_mopp', 'Certificado MOPP'),
        ('aso', 'ASO - Atestado de Saúde Ocupacional'),
        ('ficha_registro', 'Ficha de Registro'),

        # Documentos de Veiculo
        ('crlv', 'CRLV'),
        ('civ', 'CIV - Certificado de Inspeção Veicular'),
        ('cipp', 'CIPP - Transporte Produtos Perigosos'),
        ('seguro', 'Apólice de Seguro'),
        ('certificado_tacografo', 'Certificado Tacógrafo'),
        ('laudo_vistoria', 'Laudo de Vistoria'),

        # Outros
        ('outro', 'Outro'),
    ]

    # ID
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # Relacionamentos (apenas um deve ser preenchido)
    cliente = models.ForeignKey(
        'Cliente',
        on_delete=models.CASCADE,
        related_name='documentos_anexos',
        null=True,
        blank=True
    )
    motorista = models.ForeignKey(
        'Motorista',
        on_delete=models.CASCADE,
        related_name='documentos_anexos',
        null=True,
        blank=True
    )
    veiculo = models.ForeignKey(
        'Veiculo',
        on_delete=models.CASCADE,
        related_name='documentos_anexos',
        null=True,
        blank=True
    )
    cte = models.ForeignKey(
        'CTeDocumento',
        on_delete=models.CASCADE,
        related_name='documentos_anexos',
        null=True,
        blank=True
    )

    # Dados do documento
    tipo = models.CharField(
        "Tipo de Documento",
        max_length=30,
        choices=TIPO_DOCUMENTO_CHOICES,
        default='outro'
    )
    nome = models.CharField("Nome/Descrição", max_length=255)
    arquivo = models.FileField(
        "Arquivo",
        upload_to=documento_anexo_path,
        help_text="Formatos aceitos: PDF, JPG, PNG, DOC, DOCX (max 10MB)"
    )

    # Metadados
    tamanho = models.PositiveIntegerField("Tamanho (bytes)", null=True, blank=True)
    tipo_mime = models.CharField("Tipo MIME", max_length=100, null=True, blank=True)
    validade = models.DateField("Data de Validade", null=True, blank=True)
    observacoes = models.TextField("Observações", blank=True, null=True)

    # Controle
    criado_em = models.DateTimeField("Criado em", auto_now_add=True)
    atualizado_em = models.DateTimeField("Atualizado em", auto_now=True)
    criado_por = models.ForeignKey(
        'auth.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='documentos_criados'
    )

    class Meta:
        db_table = "documento_anexo"
        verbose_name = "Documento Anexo"
        verbose_name_plural = "Documentos Anexos"
        ordering = ['-criado_em']
        indexes = [
            models.Index(fields=['cliente', 'tipo']),
            models.Index(fields=['motorista', 'tipo']),
            models.Index(fields=['veiculo', 'tipo']),
            models.Index(fields=['validade']),
        ]

    def __str__(self):
        entidade = self.get_entidade_nome()
        return f"{self.nome} - {entidade}"

    def get_entidade_nome(self):
        """Retorna o nome da entidade relacionada."""
        if self.cliente:
            return f"Cliente: {self.cliente.razao_social}"
        elif self.motorista:
            return f"Motorista: {self.motorista.nome}"
        elif self.veiculo:
            return f"Veículo: {self.veiculo.placa}"
        elif self.cte:
            return f"CT-e: {self.cte.chave}"
        return "Sem vínculo"

    def get_entidade_tipo(self):
        """Retorna o tipo da entidade relacionada."""
        if self.cliente:
            return 'cliente'
        elif self.motorista:
            return 'motorista'
        elif self.veiculo:
            return 'veiculo'
        elif self.cte:
            return 'cte'
        return None

    def save(self, *args, **kwargs):
        """Salva o documento e atualiza metadados do arquivo."""
        if self.arquivo:
            # Atualiza tamanho
            self.tamanho = self.arquivo.size

            # Tenta determinar o tipo MIME
            import mimetypes
            self.tipo_mime = mimetypes.guess_type(self.arquivo.name)[0] or 'application/octet-stream'

        super().save(*args, **kwargs)

    def clean(self):
        """Validações do modelo."""
        from django.core.exceptions import ValidationError

        # Verifica se exatamente uma entidade está vinculada
        vinculos = [self.cliente, self.motorista, self.veiculo, self.cte]
        vinculos_preenchidos = sum(1 for v in vinculos if v is not None)

        if vinculos_preenchidos == 0:
            raise ValidationError(
                "O documento deve estar vinculado a um Cliente, Motorista, Veículo ou CT-e."
            )
        if vinculos_preenchidos > 1:
            raise ValidationError(
                "O documento deve estar vinculado a apenas uma entidade."
            )

        # Valida tamanho do arquivo (max 10MB)
        if self.arquivo and self.arquivo.size > 10 * 1024 * 1024:
            raise ValidationError({'arquivo': 'O arquivo não pode exceder 10MB.'})

        # Valida extensão do arquivo
        if self.arquivo:
            import os
            ext = os.path.splitext(self.arquivo.name)[1].lower()
            extensoes_permitidas = ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx', '.xls', '.xlsx']
            if ext not in extensoes_permitidas:
                raise ValidationError({
                    'arquivo': f'Extensão não permitida. Use: {", ".join(extensoes_permitidas)}'
                })


# --------------------------------------------------
#  C O N T R O L E   D E   N U M E R A Ç Ã O
# --------------------------------------------------

class ControleNumeracao(models.Model):
    """
    Controla a numeração/série de CT-e e MDF-e por emitente.
    Garante que não haja duplicidade de número para a mesma combinação
    de CNPJ emitente, modelo e série.
    """
    MODELO_CTE = 'CTe'
    MODELO_MDFE = 'MDFe'
    MODELO_CHOICES = [
        (MODELO_CTE, 'CT-e'),
        (MODELO_MDFE, 'MDF-e'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    cnpj_emitente = models.CharField("CNPJ Emitente", max_length=14, db_index=True)
    modelo = models.CharField("Modelo", max_length=4, choices=MODELO_CHOICES, db_index=True)
    serie = models.CharField("Série", max_length=5, db_index=True)
    ultimo_numero = models.PositiveIntegerField("Último Número", default=0)
    atualizado_em = models.DateTimeField("Atualizado em", auto_now=True)
    criado_em = models.DateTimeField("Criado em", auto_now_add=True)

    class Meta:
        db_table = "controle_numeracao"
        verbose_name = "Controle de Numeração"
        verbose_name_plural = "Controles de Numeração"
        constraints = [
            models.UniqueConstraint(
                fields=['cnpj_emitente', 'modelo', 'serie'],
                name='unique_controle_numeracao'
            ),
        ]

    def __str__(self):
        return f"{self.modelo} - Série {self.serie} - CNPJ {self.cnpj_emitente} (último: {self.ultimo_numero})"


# --------------------------------------------------
#  R E C E P Ç Ã O   G E N É R I C A
# --------------------------------------------------

class DocumentoFiscalGenerico(models.Model):
    """Recepção sem perda de documentos fiscais que não são CT-e mod 57 nem MDF-e
    mod 58 de primeira classe (ex.: GTV-e mod 64). Guarda o XML e o JSON completos
    para nunca descartar dados, com alguns campos de cabeçalho indexáveis."""
    TIPO_CHOICES = [
        ('GTVE', 'GTV-e (mod 64)'),
        ('OUTRO', 'Outro'),
    ]
    tipo = models.CharField("Tipo", max_length=10, choices=TIPO_CHOICES, default='OUTRO')
    modelo = models.CharField("Modelo", max_length=2, null=True, blank=True)
    chave = models.CharField("Chave de Acesso", max_length=44, unique=True)
    numero = models.CharField("Número", max_length=20, null=True, blank=True)
    serie = models.CharField("Série", max_length=5, null=True, blank=True)
    data_emissao = models.DateTimeField("Data de Emissão", null=True, blank=True)
    emitente_cnpj = models.CharField("CNPJ Emitente", max_length=14, null=True, blank=True)
    emitente_nome = models.CharField("Nome Emitente", max_length=120, null=True, blank=True)
    valor_total = models.DecimalField("Valor Total", max_digits=15, decimal_places=2, null=True, blank=True)
    xml_original = models.TextField("XML Original")
    dados_json = JSONField("Documento completo (JSON)", null=True, blank=True)
    processado = models.BooleanField("Processado", default=False)
    criado_em = models.DateTimeField("Criado em", auto_now_add=True)

    class Meta:
        db_table = "documento_fiscal_generico"
        verbose_name = "Documento Fiscal Genérico"
        verbose_name_plural = "Documentos Fiscais Genéricos"

    def __str__(self):
        return f"{self.get_tipo_display()} {self.chave}"


class DocumentoEvento(models.Model):
    """Recepção genérica de QUALQUER evento de CT-e/MDF-e (cancelamento, CC-e, EPEC,
    encerramento, inclusão de condutor/DF-e, comprovante de entrega, desacordo, etc.).
    Serve de fallback universal: nenhum evento recebido é descartado, mesmo os sem
    handler estruturado dedicado."""
    DOC_CHOICES = [('CTE', 'CT-e'), ('MDFE', 'MDF-e')]
    tipo_documento = models.CharField("Documento", max_length=4, choices=DOC_CHOICES)
    chave_documento = models.CharField("Chave do Documento", max_length=44, db_index=True)
    cte = models.ForeignKey(CTeDocumento, on_delete=models.CASCADE, related_name="eventos", null=True, blank=True)
    mdfe = models.ForeignKey(MDFeDocumento, on_delete=models.CASCADE, related_name="eventos", null=True, blank=True)
    tipo_evento = models.CharField("Tipo do Evento (tpEvento)", max_length=6, db_index=True)
    descricao_evento = models.CharField("Descrição do Evento", max_length=120, null=True, blank=True)
    sequencia_evento = models.PositiveIntegerField("Sequência (nSeqEvento)", null=True, blank=True)
    data_evento = models.DateTimeField("Data/Hora do Evento", null=True, blank=True)
    protocolo = models.CharField("Protocolo", max_length=20, null=True, blank=True)
    orgao = models.CharField("Órgão (cOrgao)", max_length=2, null=True, blank=True)
    codigo_status = models.CharField("Status SEFAZ (cStat)", max_length=3, null=True, blank=True)
    motivo_status = models.CharField("Motivo (xMotivo)", max_length=255, null=True, blank=True)
    confirmado = models.BooleanField("Confirmado pela SEFAZ", default=False)
    detalhe_json = JSONField("Detalhe do Evento (JSON)", null=True, blank=True)
    xml_evento = models.TextField("XML do Evento", null=True, blank=True)
    criado_em = models.DateTimeField("Criado em", auto_now_add=True)

    class Meta:
        db_table = "documento_evento"
        verbose_name = "Documento – Evento"
        verbose_name_plural = "Documentos – Eventos"
        unique_together = ('chave_documento', 'tipo_evento', 'sequencia_evento')
        ordering = ['-data_evento']

    def __str__(self):
        return f"Evento {self.tipo_evento} ({self.tipo_documento} {self.chave_documento})"


# --------------------------------------------------
#  O R D E N S   D E   V I A G E M   (O S)
# --------------------------------------------------

class OrdemViagem(models.Model):
    """Ordem de Serviço / Ordem de Viagem que agrupa CT-es, veículo e motorista."""

    STATUS_OPCOES = [
        ('rascunho', 'Rascunho'),
        ('agendada', 'Agendada'),
        ('em_andamento', 'Em Andamento'),
        ('concluida', 'Concluída'),
        ('cancelada', 'Cancelada'),
    ]

    TIPO_OPCOES = [
        ('carga', 'Carga'),
        ('descarga', 'Descarga'),
        ('transferencia', 'Transferência'),
        ('outros', 'Outros'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    numero = models.CharField("Número OS", max_length=20, unique=True, db_index=True)
    tipo = models.CharField("Tipo", max_length=15, choices=TIPO_OPCOES, default='carga')
    status = models.CharField("Status", max_length=15, choices=STATUS_OPCOES, default='rascunho', db_index=True)

    cliente = models.ForeignKey(
        Cliente,
        on_delete=models.PROTECT,
        related_name='ordens_viagem',
        verbose_name="Cliente",
        null=True,
        blank=True
    )
    veiculo = models.ForeignKey(
        Veiculo,
        on_delete=models.PROTECT,
        related_name='ordens_viagem',
        verbose_name="Veículo"
    )
    motorista = models.ForeignKey(
        Motorista,
        on_delete=models.PROTECT,
        related_name='ordens_viagem',
        verbose_name="Motorista",
        null=True,
        blank=True
    )

    data_saida = models.DateTimeField("Data/Hora Saída", null=True, blank=True)
    data_retorno = models.DateTimeField("Data/Hora Retorno", null=True, blank=True)
    data_previsao_chegada = models.DateTimeField("Previsão Chegada", null=True, blank=True)

    km_inicial = models.PositiveIntegerField("KM Inicial", null=True, blank=True)
    km_final = models.PositiveIntegerField("KM Final", null=True, blank=True)

    origem_uf = models.CharField("UF Origem", max_length=2, blank=True, null=True)
    origem_cidade = models.CharField("Cidade Origem", max_length=120, blank=True, null=True)
    origem_latitude = models.DecimalField("Latitude Origem", max_digits=10, decimal_places=8, null=True, blank=True)
    origem_longitude = models.DecimalField("Longitude Origem", max_digits=11, decimal_places=8, null=True, blank=True)
    destino_uf = models.CharField("UF Destino", max_length=2, blank=True, null=True)
    destino_cidade = models.CharField("Cidade Destino", max_length=120, blank=True, null=True)
    destino_latitude = models.DecimalField("Latitude Destino", max_digits=10, decimal_places=8, null=True, blank=True)
    destino_longitude = models.DecimalField("Longitude Destino", max_digits=11, decimal_places=8, null=True, blank=True)

    ciot = models.ForeignKey(
        CIOT,
        on_delete=models.SET_NULL,
        related_name='ordens_viagem',
        verbose_name="CIOT",
        null=True,
        blank=True
    )

    observacoes = models.TextField("Observações", blank=True, null=True)
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "ordem_viagem"
        verbose_name = "Ordem de Viagem"
        verbose_name_plural = "Ordens de Viagem"
        ordering = ['-data_saida', '-criado_em']
        indexes = [
            models.Index(fields=['status', 'data_saida']),
            models.Index(fields=['veiculo', 'status']),
            models.Index(fields=['motorista', 'status']),
        ]

    def __str__(self):
        return f"OS {self.numero}"

    @property
    def distancia_km(self):
        if self.km_inicial and self.km_final:
            return self.km_final - self.km_inicial
        return None

    @property
    def ctes_count(self):
        return self.ctes.count()


class OrdemViagemCTe(models.Model):
    """Vínculo entre Ordem de Viagem e CT-e."""
    ordem = models.ForeignKey(OrdemViagem, on_delete=models.CASCADE, related_name='ctes')
    cte = models.ForeignKey(CTeDocumento, on_delete=models.CASCADE, related_name='ordens_viagem')
    ordem_entrega = models.PositiveSmallIntegerField("Ordem de Entrega", default=1)

    class Meta:
        db_table = "ordem_viagem_cte"
        verbose_name = "CT-e da Ordem"
        verbose_name_plural = "CT-es da Ordem"
        unique_together = [('ordem', 'cte')]
        ordering = ['ordem_entrega', 'cte__identificacao__numero']


class OrdemViagemParada(models.Model):
    """Paradas de uma ordem de viagem (origem, destino, entregas)."""
    TIPO_PARADA = [
        ('coleta', 'Coleta'),
        ('entrega', 'Entrega'),
        ('parada', 'Parada'),
        ('outros', 'Outros'),
    ]

    ordem = models.ForeignKey(OrdemViagem, on_delete=models.CASCADE, related_name='paradas')
    tipo = models.CharField("Tipo", max_length=10, choices=TIPO_PARADA, default='parada')
    sequencia = models.PositiveSmallIntegerField("Sequência", default=1)
    cidade = models.CharField("Cidade", max_length=120, blank=True, null=True)
    uf = models.CharField("UF", max_length=2, blank=True, null=True)
    latitude = models.DecimalField("Latitude", max_digits=10, decimal_places=8, null=True, blank=True)
    longitude = models.DecimalField("Longitude", max_digits=11, decimal_places=8, null=True, blank=True)
    data_previsao = models.DateTimeField("Previsão", null=True, blank=True)
    data_realizada = models.DateTimeField("Realizada", null=True, blank=True)
    observacao = models.TextField("Observação", blank=True, null=True)

    class Meta:
        db_table = "ordem_viagem_parada"
        verbose_name = "Parada da Ordem"
        verbose_name_plural = "Paradas da Ordem"
        ordering = ['sequencia']


class DespesaViagem(models.Model):
    """Despesas avulsas vinculadas a uma ordem de viagem."""
    CATEGORIA_OPCOES = [
        ('pedagio', 'Pedágio'),
        ('alimentacao', 'Alimentação'),
        ('hospedagem', 'Hospedagem'),
        ('manutencao', 'Manutenção'),
        ('outros', 'Outros'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ordem = models.ForeignKey(OrdemViagem, on_delete=models.CASCADE, related_name='despesas')
    categoria = models.CharField("Categoria", max_length=15, choices=CATEGORIA_OPCOES, default='outros')
    descricao = models.CharField("Descrição", max_length=255)
    valor = models.DecimalField("Valor (R$)", max_digits=12, decimal_places=2)
    data = models.DateField("Data", default=date.today)
    comprovante = models.FileField(
        "Comprovante",
        upload_to='comprovantes/despesas_viagem/%Y/%m/',
        null=True,
        blank=True
    )
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "despesa_viagem"
        verbose_name = "Despesa de Viagem"
        verbose_name_plural = "Despesas de Viagem"
        ordering = ['-data', '-criado_em']

    def __str__(self):
        return f"{self.descricao} - R$ {self.valor}"


class Abastecimento(models.Model):
    """Registro de abastecimento de combustível da frota."""

    COMBUSTIVEL_CHOICES = [
        ('diesel', 'Diesel'),
        ('diesel_s10', 'Diesel S10'),
        ('arla', 'Arla 32'),
        ('gasolina', 'Gasolina'),
        ('etanol', 'Etanol'),
        ('gnv', 'GNV'),
        ('outros', 'Outros'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    veiculo = models.ForeignKey(
        Veiculo,
        on_delete=models.PROTECT,
        related_name='abastecimentos',
        verbose_name="Veículo"
    )
    motorista = models.ForeignKey(
        Motorista,
        on_delete=models.PROTECT,
        related_name='abastecimentos',
        verbose_name="Motorista",
        null=True,
        blank=True
    )
    ordem_viagem = models.ForeignKey(
        OrdemViagem,
        on_delete=models.SET_NULL,
        related_name='abastecimentos',
        verbose_name="Ordem de Viagem",
        null=True,
        blank=True
    )
    data = models.DateField("Data", default=date.today, db_index=True)
    hodometro = models.PositiveIntegerField("Hodômetro (KM)")
    litros = models.DecimalField("Litros", max_digits=10, decimal_places=2)
    valor_total = models.DecimalField("Valor Total (R$)", max_digits=12, decimal_places=2)
    tipo_combustivel = models.CharField(
        "Tipo de Combustível",
        max_length=15,
        choices=COMBUSTIVEL_CHOICES,
        default='diesel'
    )
    posto = models.CharField("Posto/Fornecedor", max_length=120, blank=True, null=True)
    cnpj_posto = models.CharField("CNPJ Posto", max_length=18, blank=True, null=True)
    comprovante = models.FileField(
        "Comprovante",
        upload_to='comprovantes/abastecimentos/%Y/%m/',
        null=True,
        blank=True
    )
    observacao = models.TextField("Observação", blank=True, null=True)
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "abastecimento"
        verbose_name = "Abastecimento"
        verbose_name_plural = "Abastecimentos"
        ordering = ['-data', '-criado_em']
        indexes = [
            models.Index(fields=['veiculo', 'data']),
            models.Index(fields=['tipo_combustivel', 'data']),
        ]

    def __str__(self):
        return f"{self.veiculo.placa} - {self.data} - {self.litros}L"

    @property
    def preco_litro(self):
        if self.litros and self.valor_total and self.litros > 0:
            return self.valor_total / self.litros
        return None

    @property
    def consumo_medio(self):
        """Calcula consumo médio (km/l) com base no abastecimento anterior."""
        anterior = Abastecimento.objects.filter(
            veiculo=self.veiculo,
            data__lt=self.data
        ).order_by('-data', '-criado_em').first()
        if anterior and self.hodometro > anterior.hodometro:
            km_rodados = self.hodometro - anterior.hodometro
            if self.litros and self.litros > 0:
                return round(km_rodados / float(self.litros), 2)
        return None


class PlanoManutencao(models.Model):
    """Plano de manutenção preventiva/preditiva por veículo."""

    TIPO_CHOICES = [
        ('preventiva', 'Preventiva'),
        ('corretiva', 'Corretiva'),
        ('preditiva', 'Preditiva'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    veiculo = models.ForeignKey(
        Veiculo,
        on_delete=models.CASCADE,
        related_name='planos_manutencao',
        verbose_name="Veículo"
    )
    tipo = models.CharField("Tipo", max_length=15, choices=TIPO_CHOICES, default='preventiva')
    descricao = models.CharField("Descrição do Serviço", max_length=255)
    intervalo_km = models.PositiveIntegerField("Intervalo (KM)", null=True, blank=True)
    intervalo_dias = models.PositiveIntegerField("Intervalo (Dias)", null=True, blank=True)
    ultima_km = models.PositiveIntegerField("Última KM Realizada", null=True, blank=True)
    ultima_data = models.DateField("Última Data Realizada", null=True, blank=True)
    proxima_km = models.PositiveIntegerField("Próxima KM", null=True, blank=True)
    proxima_data = models.DateField("Próxima Data", null=True, blank=True)
    ativo = models.BooleanField("Ativo", default=True)
    observacao = models.TextField("Observação", blank=True, null=True)
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "plano_manutencao"
        verbose_name = "Plano de Manutenção"
        verbose_name_plural = "Planos de Manutenção"
        ordering = ['veiculo__placa', 'tipo', 'descricao']

    def __str__(self):
        return f"{self.veiculo.placa} - {self.descricao}"

    def calcular_proximas(self, km_atual=None):
        """Calcula próxima KM e data com base na última manutenção."""
        from datetime import timedelta
        if self.ultima_km and self.intervalo_km:
            self.proxima_km = self.ultima_km + self.intervalo_km
        if self.ultima_data and self.intervalo_dias:
            self.proxima_data = self.ultima_data + timedelta(days=self.intervalo_dias)

    def esta_vencendo(self, km_atual=None, dias_alerta=30):
        """Retorna True se o plano está próximo do vencimento."""
        from datetime import date, timedelta
        hoje = date.today()
        if self.proxima_data and self.proxima_data <= hoje + timedelta(days=dias_alerta):
            return True
        if km_atual and self.proxima_km and km_atual >= self.proxima_km:
            return True
        return False


class Multa(models.Model):
    """Registro de multas de trânsito dos veículos."""

    STATUS_CHOICES = [
        ('pendente', 'Pendente'),
        ('paga', 'Paga'),
        ('impugnada', 'Impugnada'),
        ('cancelada', 'Cancelada'),
    ]

    GRAVIDADE_CHOICES = [
        ('leve', 'Leve'),
        ('media', 'Média'),
        ('grave', 'Grave'),
        ('gravissima', 'Gravíssima'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    veiculo = models.ForeignKey(
        Veiculo,
        on_delete=models.PROTECT,
        related_name='multas',
        verbose_name="Veículo"
    )
    motorista = models.ForeignKey(
        Motorista,
        on_delete=models.PROTECT,
        related_name='multas',
        verbose_name="Motorista",
        null=True,
        blank=True
    )
    data_infracao = models.DateField("Data da Infração", default=date.today)
    local = models.CharField("Local", max_length=255, blank=True, null=True)
    descricao = models.CharField("Descrição/Infração", max_length=255, blank=True, null=True)
    auto_infracao = models.CharField("Auto de Infração", max_length=30, blank=True, null=True)
    gravidade = models.CharField("Gravidade", max_length=15, choices=GRAVIDADE_CHOICES, default='media')
    pontos = models.PositiveSmallIntegerField("Pontos", null=True, blank=True)
    valor = models.DecimalField("Valor (R$)", max_digits=12, decimal_places=2)
    data_vencimento = models.DateField("Data de Vencimento", null=True, blank=True)
    data_pagamento = models.DateField("Data de Pagamento", null=True, blank=True)
    status = models.CharField("Status", max_length=15, choices=STATUS_CHOICES, default='pendente', db_index=True)
    comprovante = models.FileField(
        "Comprovante",
        upload_to='comprovantes/multas/%Y/%m/',
        null=True,
        blank=True
    )
    observacao = models.TextField("Observação", blank=True, null=True)
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "multa"
        verbose_name = "Multa"
        verbose_name_plural = "Multas"
        ordering = ['-data_infracao', '-criado_em']

    def __str__(self):
        return f"{self.veiculo.placa} - {self.auto_infracao or 'Multa'}"


class Sinistro(models.Model):
    """Registro de sinistros envolvendo veículos da frota."""

    TIPO_CHOICES = [
        ('colisao', 'Colisão'),
        ('incendio', 'Incêndio'),
        ('furto_roubo', 'Furto/Roubo'),
        ('avaria_carga', 'Avaria de Carga'),
        ('outros', 'Outros'),
    ]

    STATUS_CHOICES = [
        ('aberto', 'Aberto'),
        ('em_andamento', 'Em Andamento'),
        ('resolvido', 'Resolvido'),
        ('cancelado', 'Cancelado'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    veiculo = models.ForeignKey(
        Veiculo,
        on_delete=models.PROTECT,
        related_name='sinistros',
        verbose_name="Veículo"
    )
    motorista = models.ForeignKey(
        Motorista,
        on_delete=models.PROTECT,
        related_name='sinistros',
        verbose_name="Motorista",
        null=True,
        blank=True
    )
    data = models.DateField("Data", default=date.today)
    local = models.CharField("Local", max_length=255, blank=True, null=True)
    tipo = models.CharField("Tipo", max_length=20, choices=TIPO_CHOICES, default='colisao')
    descricao = models.TextField("Descrição", blank=True, null=True)
    envolvidos_terceiros = models.TextField("Envolvidos / Terceiros", blank=True, null=True)
    custo_total = models.DecimalField("Custo Total (R$)", max_digits=12, decimal_places=2, null=True, blank=True)
    status = models.CharField("Status", max_length=15, choices=STATUS_CHOICES, default='aberto', db_index=True)
    numero_sinistro = models.CharField("Número do Sinistro", max_length=30, blank=True, null=True)
    seguradora = models.CharField("Seguradora", max_length=120, blank=True, null=True)
    comprovante = models.FileField(
        "Comprovante/Boletim",
        upload_to='comprovantes/sinistros/%Y/%m/',
        null=True,
        blank=True
    )
    observacao = models.TextField("Observação", blank=True, null=True)
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "sinistro"
        verbose_name = "Sinistro"
        verbose_name_plural = "Sinistros"
        ordering = ['-data', '-criado_em']

    def __str__(self):
        return f"{self.veiculo.placa} - {self.get_tipo_display()}"


class Pedagio(models.Model):
    """Registro de pedágios pagos em viagens."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ordem = models.ForeignKey(
        OrdemViagem,
        on_delete=models.CASCADE,
        related_name='pedagios',
        verbose_name="Ordem de Viagem",
        null=True,
        blank=True
    )
    veiculo = models.ForeignKey(
        Veiculo,
        on_delete=models.PROTECT,
        related_name='pedagios',
        verbose_name="Veículo"
    )
    data = models.DateField("Data", default=date.today)
    praca = models.CharField("Praça/Pedágio", max_length=120)
    rodovia = models.CharField("Rodovia/BR", max_length=20, blank=True, null=True)
    km = models.PositiveIntegerField("KM", null=True, blank=True)
    categoria = models.CharField("Categoria", max_length=10, blank=True, null=True)
    tag = models.CharField("Tag/Passagem", max_length=30, blank=True, null=True)
    valor = models.DecimalField("Valor (R$)", max_digits=10, decimal_places=2)
    comprovante = models.FileField(
        "Comprovante",
        upload_to='comprovantes/pedagios/%Y/%m/',
        null=True,
        blank=True
    )
    observacao = models.TextField("Observação", blank=True, null=True)
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "pedagio"
        verbose_name = "Pedágio"
        verbose_name_plural = "Pedágios"
        ordering = ['-data', '-criado_em']

    def __str__(self):
        return f"{self.veiculo.placa} - {self.praca} - R$ {self.valor}"


class TabelaFrete(models.Model):
    """Tabela de frete por rota e tipo de veículo."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    origem_uf = models.CharField("UF Origem", max_length=2)
    origem_cidade = models.CharField("Cidade Origem", max_length=120)
    destino_uf = models.CharField("UF Destino", max_length=2)
    destino_cidade = models.CharField("Cidade Destino", max_length=120)
    tipo_veiculo = models.CharField("Tipo de Veículo", max_length=50, blank=True, null=True)
    valor_por_km = models.DecimalField("Valor por KM (R$)", max_digits=10, decimal_places=2, default=Decimal('0.00'))
    valor_minimo = models.DecimalField("Valor Mínimo (R$)", max_digits=12, decimal_places=2, default=Decimal('0.00'))
    valor_tonelada = models.DecimalField("Valor por Tonelada (R$)", max_digits=12, decimal_places=2, null=True, blank=True)
    valor_m3 = models.DecimalField("Valor por M³ (R$)", max_digits=12, decimal_places=2, null=True, blank=True)
    vigencia_inicio = models.DateField("Início Vigência", default=date.today)
    vigencia_fim = models.DateField("Fim Vigência", null=True, blank=True)
    ativo = models.BooleanField("Ativo", default=True)
    observacao = models.TextField("Observação", blank=True, null=True)
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "tabela_frete"
        verbose_name = "Tabela de Frete"
        verbose_name_plural = "Tabelas de Frete"
        ordering = ['origem_uf', 'origem_cidade', 'destino_uf', 'destino_cidade']
        indexes = [
            models.Index(fields=['origem_uf', 'destino_uf']),
            models.Index(fields=['ativo', 'vigencia_inicio', 'vigencia_fim']),
        ]

    def __str__(self):
        return f"{self.origem_cidade}/{self.origem_uf} → {self.destino_cidade}/{self.destino_uf}"

    def calcular_frete(self, distancia_km=0, peso_kg=0, volume_m3=0):
        """Calcula o valor do frete com base na tabela."""
        from decimal import Decimal
        valor = Decimal('0.00')
        if self.valor_por_km and distancia_km:
            valor += self.valor_por_km * Decimal(distancia_km)
        if self.valor_tonelada and peso_kg:
            valor += self.valor_tonelada * Decimal(peso_kg) / Decimal('1000')
        if self.valor_m3 and volume_m3:
            valor += self.valor_m3 * Decimal(volume_m3)
        if self.valor_minimo and valor < self.valor_minimo:
            valor = self.valor_minimo
        return valor


class PosicaoVeiculo(models.Model):
    """Posição geográfica de um veículo vinculado a uma ordem de viagem."""

    FONTE_CHOICES = [
        ('manual', 'Manual'),
        ('gps', 'GPS'),
        ('app', 'App Motorista'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ordem = models.ForeignKey(
        OrdemViagem,
        on_delete=models.CASCADE,
        related_name='posicoes',
        verbose_name="Ordem de Viagem"
    )
    veiculo = models.ForeignKey(
        Veiculo,
        on_delete=models.PROTECT,
        related_name='posicoes',
        verbose_name="Veículo"
    )
    latitude = models.DecimalField("Latitude", max_digits=10, decimal_places=8)
    longitude = models.DecimalField("Longitude", max_digits=11, decimal_places=8)
    velocidade = models.DecimalField("Velocidade (km/h)", max_digits=5, decimal_places=2, null=True, blank=True)
    data_hora = models.DateTimeField("Data/Hora", default=timezone.now)
    fonte = models.CharField("Fonte", max_length=10, choices=FONTE_CHOICES, default='manual')

    class Meta:
        db_table = "posicao_veiculo"
        verbose_name = "Posição do Veículo"
        verbose_name_plural = "Posições dos Veículos"
        ordering = ['-data_hora']

    def __str__(self):
        return f"{self.veiculo.placa} - {self.latitude}, {self.longitude}"


class RotaOtimizada(models.Model):
    """Rota calculada e otimizada para uma ordem de viagem (via OSRM/OpenStreetMap)."""

    STATUS_CHOICES = [
        ('calculada', 'Calculada'),
        ('em_uso', 'Em Uso'),
        ('concluida', 'Concluída'),
        ('cancelada', 'Cancelada'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ordem = models.ForeignKey(
        OrdemViagem,
        on_delete=models.CASCADE,
        related_name='rotas',
        verbose_name="Ordem de Viagem"
    )
    distancia_km = models.DecimalField("Distância (km)", max_digits=10, decimal_places=2)
    duracao_min = models.IntegerField("Duração (min)")
    geometria = models.JSONField("Geometria (GeoJSON)", null=True, blank=True)
    waypoints = models.JSONField("Waypoints ordenados", null=True, blank=True)
    provedor = models.CharField("Provedor", max_length=50, default='osrm')
    status = models.CharField("Status", max_length=15, choices=STATUS_CHOICES, default='calculada')
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "rota_otimizada"
        verbose_name = "Rota Otimizada"
        verbose_name_plural = "Rotas Otimizadas"
        ordering = ['-criado_em']

    def __str__(self):
        return f"Rota {self.ordem.numero} - {self.distancia_km} km"


class MensagemComunicacao(models.Model):
    """Registro de comunicações enviadas (e-mail/WhatsApp) para clientes/motoristas."""

    CANAL_CHOICES = [
        ('email', 'E-mail'),
        ('whatsapp', 'WhatsApp'),
        ('sms', 'SMS'),
    ]

    STATUS_CHOICES = [
        ('pendente', 'Pendente'),
        ('enviado', 'Enviado'),
        ('falha', 'Falha'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    canal = models.CharField("Canal", max_length=10, choices=CANAL_CHOICES)
    destinatario = models.CharField("Destinatário", max_length=255)
    assunto = models.CharField("Assunto", max_length=255, blank=True, null=True)
    conteudo = models.TextField("Conteúdo")
    status = models.CharField("Status", max_length=10, choices=STATUS_CHOICES, default='pendente')
    erro = models.TextField("Erro", blank=True, null=True)
    cliente = models.ForeignKey(
        Cliente,
        on_delete=models.SET_NULL,
        related_name='comunicacoes',
        verbose_name="Cliente",
        null=True,
        blank=True
    )
    motorista = models.ForeignKey(
        Motorista,
        on_delete=models.SET_NULL,
        related_name='comunicacoes',
        verbose_name="Motorista",
        null=True,
        blank=True
    )
    ordem = models.ForeignKey(
        OrdemViagem,
        on_delete=models.SET_NULL,
        related_name='comunicacoes',
        verbose_name="Ordem de Viagem",
        null=True,
        blank=True
    )
    enviado_em = models.DateTimeField("Enviado em", null=True, blank=True)
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "mensagem_comunicacao"
        verbose_name = "Mensagem de Comunicação"
        verbose_name_plural = "Mensagens de Comunicação"
        ordering = ['-criado_em']

    def __str__(self):
        return f"{self.canal.upper()} - {self.destinatario}"


# --------------------------------------------------
#  R E L A C I O N A M E N T O S   F I N A I S
# --------------------------------------------------

# Adicionar relacionamento ManyToMany entre CTe e MDFE usando o modelo intermediário
# (Mantido do código original, mas precisa ser adicionado após ambas as classes serem definidas)
CTeDocumento.add_to_class(
   'mdfe_vinculado',
   models.ManyToManyField(MDFeDocumento, through=MDFeDocumentosVinculados, related_name='ctes_transportados')
)


# --------------------------------------------------
#  A U D I T L O G   -   R E G I S T R O   D E   M O D E L O S
# --------------------------------------------------
from auditlog.registry import auditlog  # noqa: E402

auditlog.register(CTeDocumento)
auditlog.register(MDFeDocumento)
auditlog.register(PagamentoAgregado)
auditlog.register(PagamentoProprio)
auditlog.register(Fatura)
auditlog.register(ContaPagar)
auditlog.register(TransacaoBancaria)
auditlog.register(Cliente)
auditlog.register(Motorista)
auditlog.register(Veiculo)
auditlog.register(OrdemViagem)
auditlog.register(Abastecimento)
auditlog.register(PlanoManutencao)
auditlog.register(Multa)
auditlog.register(Sinistro)
auditlog.register(Pedagio)
auditlog.register(TabelaFrete)
auditlog.register(PosicaoVeiculo)
auditlog.register(RotaOtimizada)
auditlog.register(CIOT)