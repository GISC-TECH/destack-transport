# 📋 PLANO DE IMPLEMENTAÇÃO - NOVOS CADASTROS

**Data:** 26/11/2024
**Objetivo:** Implementar cadastros de Cliente, Motorista e extensão de Veículo conforme mockups
**Estimativa:** 6-8 horas de desenvolvimento
**Complexidade:** Média

---

## 📸 REFERÊNCIAS DOS MOCKUPS

Baseado em 3 mockups em `nova implementação/`:
1. **CADASTRO DE VEÍCULO** - Campos adicionais de documentação e compartimentação
2. **CADASTRO DE CLIENTE** - Modelo completo de cliente
3. **CADASTRO DE MOTORISTA** - Modelo completo com certificações

---

## 🎯 OBJETIVOS DA IMPLEMENTAÇÃO

### 1. **Modelo de Cliente**
Criar modelo completo para cadastro de clientes com:
- Dados fiscais (CNPJ, IE, Razão Social, Nome Fantasia)
- Endereço completo
- Informações de distância e tipo de frete (CIF/FOB)

### 2. **Modelo de Motorista**
Criar modelo independente para cadastro de motoristas com:
- Dados pessoais (Nome, CPF, CNH, Categoria)
- Certificações obrigatórias (NR20, NR35, MOPP)
- Sistema de alertas de vencimento

### 3. **Extensão do Modelo de Veículo**
Adicionar campos de documentação ao modelo existente:
- Documentos obrigatórios (CIV, CIPP, Aferição, CRLV, Cronotacógrafo)
- Sistema de compartimentação (9 bocas)
- Capacidade em M³

### 4. **APIs REST Completas**
Implementar APIs CRUD para todos os novos modelos com:
- Serializers completos
- ViewSets com filtros
- Validações robustas
- Documentação Swagger

### 5. **Sistema de Alertas**
Criar sistema de alertas para vencimento de documentos e certificações

---

## 📊 ANÁLISE DE IMPACTO

### ✅ **SEM IMPACTO (Não quebra nada existente):**
- Novos modelos são independentes
- Extensão de Veículo é aditiva (novos campos nullable)
- APIs novas não conflitam com existentes

### ⚠️ **REQUER ATENÇÃO:**
- Migration precisa ser cuidadosa (adicionar campos sem quebrar dados existentes)
- Sistema de compartimentação usa modelo relacionado (ForeignKey)
- Integração com sistema de alertas existente

### 🔄 **INTEGRAÇÕES FUTURAS:**
- Vincular Cliente ao CTeRemetente/CTeDestinatario (opcional)
- Vincular Motorista ao CTeMotorista/MDFeCondutor (opcional)
- Dashboard de vencimentos (fase futura)

---

## 🏗️ ESTRUTURA DE IMPLEMENTAÇÃO

### **FASE 1: MODELOS DE DADOS** ⏱️ 2 horas

#### 1.1 Modelo Cliente
**Localização:** `transport/models.py` (seção antes de Sistema)

```python
# ===============================================================
# ==> CADASTRO DE CLIENTES
# ===============================================================

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

        # Validação básica de CNPJ (apenas formato)
        if self.cnpj:
            cnpj_limpo = ''.join(filter(str.isdigit, self.cnpj))
            if len(cnpj_limpo) != 14:
                raise ValidationError({'cnpj': 'CNPJ deve ter 14 dígitos.'})

        # Validação de UF
        if self.estado:
            ufs_validas = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO',
                          'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
                          'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO']
            if self.estado.upper() not in ufs_validas:
                raise ValidationError({'estado': 'UF inválida.'})
```

#### 1.2 Modelo Motorista
**Localização:** `transport/models.py` (após Cliente)

```python
# ===============================================================
# ==> CADASTRO DE MOTORISTAS
# ===============================================================

class Motorista(models.Model):
    """Modelo para cadastro de motoristas."""

    # ID
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # Dados Pessoais
    nome = models.CharField("Nome Completo", max_length=255)
    cpf = models.CharField("CPF", max_length=14, unique=True, db_index=True)

    # CNH
    cnh = models.CharField("CNH", max_length=20, unique=True, db_index=True)
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

    # Metadados
    ativo = models.BooleanField("Ativo", default=True)
    observacoes = models.TextField("Observações", blank=True, null=True)
    criado_em = models.DateTimeField("Criado em", auto_now_add=True)
    atualizado_em = models.DateTimeField("Atualizado em", auto_now=True)

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

        # Validação básica de CPF (apenas formato)
        if self.cpf:
            cpf_limpo = ''.join(filter(str.isdigit, self.cpf))
            if len(cpf_limpo) != 11:
                raise ValidationError({'cpf': 'CPF deve ter 11 dígitos.'})

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
            documentos_vencendo.append({
                'documento': 'CNH',
                'validade': self.validade_cnh,
                'vencido': self.validade_cnh < hoje
            })

        # Verificar NR20
        if self.nr20_validade and self.nr20_validade <= data_limite:
            documentos_vencendo.append({
                'documento': 'NR20',
                'validade': self.nr20_validade,
                'vencido': self.nr20_validade < hoje
            })

        # Verificar NR35
        if self.nr35_validade and self.nr35_validade <= data_limite:
            documentos_vencendo.append({
                'documento': 'NR35',
                'validade': self.nr35_validade,
                'vencido': self.nr35_validade < hoje
            })

        # Verificar MOPP
        if self.mopp_validade and self.mopp_validade <= data_limite:
            documentos_vencendo.append({
                'documento': 'MOPP',
                'validade': self.mopp_validade,
                'vencido': self.mopp_validade < hoje
            })

        return documentos_vencendo
```

#### 1.3 Extensão de Veículo + Compartimentação
**Localização:** `transport/models.py` (substituir modelo Veiculo existente)

```python
# ===============================================================
# ==> VEÍCULOS E MANUTENÇÃO (ATUALIZADO)
# ===============================================================

class Veiculo(models.Model):
    """Modelo para cadastro de veículos (atualizado com novos campos)."""

    # ID
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # Dados Básicos do Veículo (EXISTENTES)
    placa = models.CharField("Placa", max_length=10, unique=True, db_index=True)
    renavam = models.CharField("RENAVAM", max_length=20, blank=True, null=True)
    tara = models.DecimalField("Tara (kg)", max_digits=10, decimal_places=2, null=True, blank=True)
    capacidade_kg = models.DecimalField("Capacidade KG", max_digits=10, decimal_places=2, null=True, blank=True)
    tipo_rodado = models.CharField("Tipo Rodado", max_length=5, blank=True, null=True)
    tipo_carroceria = models.CharField("Tipo Carroceria", max_length=5, blank=True, null=True)

    # Proprietário (EXISTENTES)
    tipo_proprietario = models.CharField(
        "Tipo Proprietário",
        max_length=2,
        choices=[
            ('00', 'Transporte Próprio por Conta Própria (TAC)'),
            ('01', 'Transporte Próprio por Conta de Terceiros (TAC)'),
            ('02', 'Transporte por Conta de Terceiros (TFC)')
        ],
        blank=True,
        null=True
    )
    proprietario_cnpj = models.CharField("CNPJ Proprietário", max_length=18, blank=True, null=True)
    proprietario_cpf = models.CharField("CPF Proprietário", max_length=14, blank=True, null=True)
    proprietario_nome = models.CharField("Nome Proprietário", max_length=255, blank=True, null=True)
    proprietario_rntrc = models.CharField("RNTRC Proprietário", max_length=20, blank=True, null=True)
    proprietario_uf = models.CharField("UF Proprietário", max_length=2, blank=True, null=True)

    # **NOVOS CAMPOS - Documentação do Veículo**
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

    # **NOVOS CAMPOS - Capacidade**
    capacidade_m3 = models.DecimalField(
        "Capacidade Total (M³)",
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Capacidade total do veículo em metros cúbicos"
    )

    # Metadados (EXISTENTES)
    ativo = models.BooleanField("Ativo", default=True)
    observacoes = models.TextField("Observações", blank=True, null=True)
    criado_em = models.DateTimeField("Criado em", auto_now_add=True)
    atualizado_em = models.DateTimeField("Atualizado em", auto_now=True)

    class Meta:
        db_table = "veiculo"
        verbose_name = "Veículo"
        verbose_name_plural = "Veículos"
        ordering = ['placa']
        indexes = [
            models.Index(fields=['placa']),
            models.Index(fields=['ativo', 'placa']),
        ]

    def __str__(self):
        return f"{self.placa}"

    def get_documentos_vencendo(self, dias=30):
        """
        Retorna lista de documentos que vencem em X dias.
        Similar ao método do Motorista.
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
        ]

        for nome_doc, validade in documentos_verificar:
            if validade and validade <= data_limite:
                documentos_vencendo.append({
                    'documento': nome_doc,
                    'validade': validade,
                    'vencido': validade < hoje
                })

        return documentos_vencendo


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


# ManutencaoVeiculo permanece inalterado (já existe)
```

---

### **FASE 2: MIGRATIONS** ⏱️ 30 minutos

#### 2.1 Criar Migration
```bash
python manage.py makemigrations transport --name adicionar_cliente_motorista_compartimentacao
```

#### 2.2 Verificar Migration Gerada
- Revisar arquivo `0002_adicionar_cliente_motorista_compartimentacao.py`
- Confirmar que campos novos em Veiculo são nullable
- Confirmar índices foram criados

#### 2.3 Aplicar Migration
```bash
python manage.py migrate transport
```

#### 2.4 Testar Rollback (Opcional)
```bash
python manage.py migrate transport 0001  # Voltar
python manage.py migrate transport 0002  # Avançar novamente
```

---

### **FASE 3: SERIALIZERS** ⏱️ 1.5 horas

#### 3.1 Criar `transport/serializers/cliente_serializers.py`

```python
# transport/serializers/cliente_serializers.py

from rest_framework import serializers
from ..models import Cliente


class ClienteSerializer(serializers.ModelSerializer):
    """Serializer completo para Cliente."""

    cnpj_formatado = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Cliente
        fields = '__all__'
        read_only_fields = ('id', 'criado_em', 'atualizado_em')

    def get_cnpj_formatado(self, obj):
        """Retorna CNPJ formatado."""
        if obj.cnpj and len(obj.cnpj) == 14:
            cnpj = obj.cnpj
            return f"{cnpj[:2]}.{cnpj[2:5]}.{cnpj[5:8]}/{cnpj[8:12]}-{cnpj[12:]}"
        return obj.cnpj

    def validate_cnpj(self, value):
        """Valida formato de CNPJ."""
        cnpj_limpo = ''.join(filter(str.isdigit, value))
        if len(cnpj_limpo) != 14:
            raise serializers.ValidationError("CNPJ deve ter 14 dígitos.")
        return cnpj_limpo

    def validate_estado(self, value):
        """Valida UF."""
        if value:
            ufs_validas = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO',
                          'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
                          'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO']
            if value.upper() not in ufs_validas:
                raise serializers.ValidationError("UF inválida.")
            return value.upper()
        return value


class ClienteListSerializer(serializers.ModelSerializer):
    """Serializer simplificado para listagem de Clientes."""

    cnpj_formatado = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Cliente
        fields = ['id', 'razao_social', 'nome_fantasia', 'cnpj', 'cnpj_formatado',
                  'cidade', 'estado', 'tipo_frete', 'ativo']
        read_only_fields = fields

    def get_cnpj_formatado(self, obj):
        if obj.cnpj and len(obj.cnpj) == 14:
            cnpj = obj.cnpj
            return f"{cnpj[:2]}.{cnpj[2:5]}.{cnpj[5:8]}/{cnpj[8:12]}-{cnpj[12:]}"
        return obj.cnpj
```

#### 3.2 Criar `transport/serializers/motorista_serializers.py`

```python
# transport/serializers/motorista_serializers.py

from rest_framework import serializers
from ..models import Motorista


class MotoristaSerializer(serializers.ModelSerializer):
    """Serializer completo para Motorista."""

    cpf_formatado = serializers.SerializerMethodField(read_only=True)
    documentos_vencendo = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Motorista
        fields = '__all__'
        read_only_fields = ('id', 'criado_em', 'atualizado_em')

    def get_cpf_formatado(self, obj):
        """Retorna CPF formatado."""
        if obj.cpf and len(obj.cpf) == 11:
            cpf = obj.cpf
            return f"{cpf[:3]}.{cpf[3:6]}.{cpf[6:9]}-{cpf[9:]}"
        return obj.cpf

    def get_documentos_vencendo(self, obj):
        """Retorna documentos que vencem em 30 dias."""
        return obj.get_documentos_vencendo(dias=30)

    def validate_cpf(self, value):
        """Valida formato de CPF."""
        cpf_limpo = ''.join(filter(str.isdigit, value))
        if len(cpf_limpo) != 11:
            raise serializers.ValidationError("CPF deve ter 11 dígitos.")
        return cpf_limpo


class MotoristaListSerializer(serializers.ModelSerializer):
    """Serializer simplificado para listagem de Motoristas."""

    cpf_formatado = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Motorista
        fields = ['id', 'nome', 'cpf', 'cpf_formatado', 'cnh', 'categoria_cnh',
                  'validade_cnh', 'ativo']
        read_only_fields = fields

    def get_cpf_formatado(self, obj):
        if obj.cpf and len(obj.cpf) == 11:
            cpf = obj.cpf
            return f"{cpf[:3]}.{cpf[3:6]}.{cpf[6:9]}-{cpf[9:]}"
        return obj.cpf
```

#### 3.3 Atualizar `transport/serializers/vehicle_serializers.py`

```python
# Adicionar no início do arquivo

from ..models import Veiculo, ManutencaoVeiculo, CompartimentacaoVeiculo


# Novo serializer para Compartimentação
class CompartimentacaoVeiculoSerializer(serializers.ModelSerializer):
    """Serializer para Compartimentação de Veículo."""

    class Meta:
        model = CompartimentacaoVeiculo
        fields = '__all__'
        read_only_fields = ('id',)
        extra_kwargs = {
            'veiculo': {'required': False}  # Será setado automaticamente em nested routes
        }

    def validate_numero_boca(self, value):
        """Valida número da boca."""
        if value < 1 or value > 9:
            raise serializers.ValidationError("Número da boca deve estar entre 1 e 9.")
        return value


# Atualizar VeiculoSerializer existente
class VeiculoSerializer(serializers.ModelSerializer):
    """Serializer completo para Veículo (ATUALIZADO)."""

    compartimentos = CompartimentacaoVeiculoSerializer(many=True, read_only=True)
    documentos_vencendo = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Veiculo
        fields = '__all__'
        read_only_fields = ('id', 'criado_em', 'atualizado_em')

    def get_documentos_vencendo(self, obj):
        """Retorna documentos que vencem em 30 dias."""
        return obj.get_documentos_vencendo(dias=30)
```

#### 3.4 Atualizar `transport/serializers/__init__.py`

```python
# Adicionar imports
from .cliente_serializers import ClienteSerializer, ClienteListSerializer
from .motorista_serializers import MotoristaSerializer, MotoristaListSerializer
from .vehicle_serializers import (
    VeiculoSerializer,
    ManutencaoVeiculoSerializer,
    CompartimentacaoVeiculoSerializer  # NOVO
)
```

---

### **FASE 4: VIEWS (ViewSets)** ⏱️ 1.5 horas

#### 4.1 Criar `transport/views/cliente_views.py`

```python
# transport/views/cliente_views.py

from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q

from ..models import Cliente
from ..serializers.cliente_serializers import ClienteSerializer, ClienteListSerializer


class ClienteViewSet(viewsets.ModelViewSet):
    """
    ViewSet para gerenciamento de Clientes.

    Endpoints:
    - GET /api/clientes/ - Listar clientes
    - GET /api/clientes/{id}/ - Detalhes de um cliente
    - POST /api/clientes/ - Criar cliente
    - PUT/PATCH /api/clientes/{id}/ - Atualizar cliente
    - DELETE /api/clientes/{id}/ - Deletar cliente
    - GET /api/clientes/export/ - Exportar para CSV
    """

    queryset = Cliente.objects.all()
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        """Retorna serializer apropriado para a action."""
        if self.action == 'list':
            return ClienteListSerializer
        return ClienteSerializer

    def get_queryset(self):
        """Aplica filtros via query parameters."""
        queryset = super().get_queryset()
        params = self.request.query_params

        # Filtro por ativo
        ativo = params.get('ativo')
        if ativo is not None:
            queryset = queryset.filter(ativo=ativo.lower() == 'true')

        # Filtro por tipo de frete
        tipo_frete = params.get('tipo_frete')
        if tipo_frete:
            queryset = queryset.filter(tipo_frete=tipo_frete.upper())

        # Filtro por UF
        estado = params.get('estado')
        if estado:
            queryset = queryset.filter(estado__iexact=estado)

        # Busca geral (razão social, nome fantasia, CNPJ)
        q = params.get('q')
        if q:
            queryset = queryset.filter(
                Q(razao_social__icontains=q) |
                Q(nome_fantasia__icontains=q) |
                Q(cnpj__icontains=q)
            )

        return queryset.distinct().order_by('razao_social')

    @action(detail=False, methods=['get'])
    def export(self, request):
        """Exporta clientes para CSV."""
        import csv
        from django.http import HttpResponse
        from django.utils import timezone

        queryset = self.get_queryset()

        # Criar resposta CSV
        response = HttpResponse(content_type='text/csv; charset=utf-8')
        filename = f"clientes_{timezone.now().strftime('%Y%m%d_%H%M%S')}.csv"
        response['Content-Disposition'] = f'attachment; filename="{filename}"'

        writer = csv.writer(response)
        writer.writerow([
            'ID', 'Razão Social', 'Nome Fantasia', 'CNPJ', 'IE',
            'Endereço', 'Cidade', 'UF', 'CEP',
            'Distância (KM)', 'Tipo Frete', 'Ativo'
        ])

        for cliente in queryset:
            endereco_completo = f"{cliente.logradouro or ''}, {cliente.numero or ''}"
            writer.writerow([
                str(cliente.id),
                cliente.razao_social,
                cliente.nome_fantasia or '',
                cliente.cnpj,
                cliente.ie or '',
                endereco_completo,
                cliente.cidade or '',
                cliente.estado or '',
                cliente.cep or '',
                cliente.distancia or '',
                cliente.tipo_frete,
                'Sim' if cliente.ativo else 'Não'
            ])

        return response
```

#### 4.2 Criar `transport/views/motorista_views.py`

```python
# transport/views/motorista_views.py

from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q
from datetime import date, timedelta

from ..models import Motorista
from ..serializers.motorista_serializers import MotoristaSerializer, MotoristaListSerializer


class MotoristaViewSet(viewsets.ModelViewSet):
    """
    ViewSet para gerenciamento de Motoristas.

    Endpoints:
    - GET /api/motoristas/ - Listar motoristas
    - GET /api/motoristas/{id}/ - Detalhes de um motorista
    - POST /api/motoristas/ - Criar motorista
    - PUT/PATCH /api/motoristas/{id}/ - Atualizar motorista
    - DELETE /api/motoristas/{id}/ - Deletar motorista
    - GET /api/motoristas/vencimentos/ - Motoristas com documentos vencendo
    - GET /api/motoristas/export/ - Exportar para CSV
    """

    queryset = Motorista.objects.all()
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        """Retorna serializer apropriado para a action."""
        if self.action == 'list':
            return MotoristaListSerializer
        return MotoristaSerializer

    def get_queryset(self):
        """Aplica filtros via query parameters."""
        queryset = super().get_queryset()
        params = self.request.query_params

        # Filtro por ativo
        ativo = params.get('ativo')
        if ativo is not None:
            queryset = queryset.filter(ativo=ativo.lower() == 'true')

        # Filtro por categoria CNH
        categoria = params.get('categoria_cnh')
        if categoria:
            queryset = queryset.filter(categoria_cnh=categoria.upper())

        # Busca geral (nome, CPF, CNH)
        q = params.get('q')
        if q:
            queryset = queryset.filter(
                Q(nome__icontains=q) |
                Q(cpf__icontains=q) |
                Q(cnh__icontains=q)
            )

        return queryset.distinct().order_by('nome')

    @action(detail=False, methods=['get'])
    def vencimentos(self, request):
        """
        Retorna motoristas com documentos vencendo.
        Query param: dias (default: 30)
        """
        dias = int(request.query_params.get('dias', 30))
        hoje = date.today()
        data_limite = hoje + timedelta(days=dias)

        # Motoristas com pelo menos um documento vencendo
        motoristas_vencendo = []

        for motorista in self.get_queryset().filter(ativo=True):
            docs_vencendo = motorista.get_documentos_vencendo(dias=dias)
            if docs_vencendo:
                motoristas_vencendo.append({
                    'id': str(motorista.id),
                    'nome': motorista.nome,
                    'cpf': motorista.cpf,
                    'documentos_vencendo': docs_vencendo
                })

        return Response({
            'dias_alerta': dias,
            'total': len(motoristas_vencendo),
            'motoristas': motoristas_vencendo
        })

    @action(detail=False, methods=['get'])
    def export(self, request):
        """Exporta motoristas para CSV."""
        import csv
        from django.http import HttpResponse
        from django.utils import timezone

        queryset = self.get_queryset()

        response = HttpResponse(content_type='text/csv; charset=utf-8')
        filename = f"motoristas_{timezone.now().strftime('%Y%m%d_%H%M%S')}.csv"
        response['Content-Disposition'] = f'attachment; filename="{filename}"'

        writer = csv.writer(response)
        writer.writerow([
            'ID', 'Nome', 'CPF', 'CNH', 'Categoria', 'Validade CNH',
            'NR20', 'NR35', 'MOPP', 'Telefone', 'Email', 'Ativo'
        ])

        for motorista in queryset:
            writer.writerow([
                str(motorista.id),
                motorista.nome,
                motorista.cpf,
                motorista.cnh,
                motorista.categoria_cnh or '',
                motorista.validade_cnh or '',
                motorista.nr20_validade or '',
                motorista.nr35_validade or '',
                motorista.mopp_validade or '',
                motorista.telefone or '',
                motorista.email or '',
                'Sim' if motorista.ativo else 'Não'
            ])

        return response
```

#### 4.3 Atualizar `transport/views/vehicle_views.py`

```python
# Adicionar no início
from ..models import Veiculo, ManutencaoVeiculo, CompartimentacaoVeiculo
from ..serializers.vehicle_serializers import (
    VeiculoSerializer,
    ManutencaoVeiculoSerializer,
    CompartimentacaoVeiculoSerializer
)
from rest_framework_nested import routers

# Adicionar novo ViewSet
class CompartimentacaoVeiculoViewSet(viewsets.ModelViewSet):
    """
    ViewSet para gerenciamento de Compartimentação de Veículos.

    Rota aninhada: /api/veiculos/{veiculo_id}/compartimentos/
    """

    queryset = CompartimentacaoVeiculo.objects.all()
    serializer_class = CompartimentacaoVeiculoSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Filtra por veículo da URL."""
        veiculo_pk = self.kwargs.get('veiculo_pk')
        if veiculo_pk:
            return self.queryset.filter(veiculo_id=veiculo_pk).order_by('numero_boca')
        return self.queryset.all()

    def perform_create(self, serializer):
        """Associa compartimento ao veículo da URL."""
        veiculo_pk = self.kwargs.get('veiculo_pk')
        serializer.save(veiculo_id=veiculo_pk)


# Atualizar VeiculoViewSet para incluir action de vencimentos
class VeiculoViewSet(viewsets.ModelViewSet):
    # ... código existente ...

    @action(detail=False, methods=['get'])
    def vencimentos(self, request):
        """
        Retorna veículos com documentos vencendo.
        Query param: dias (default: 30)
        """
        from datetime import date, timedelta

        dias = int(request.query_params.get('dias', 30))

        veiculos_vencendo = []

        for veiculo in self.get_queryset().filter(ativo=True):
            docs_vencendo = veiculo.get_documentos_vencendo(dias=dias)
            if docs_vencendo:
                veiculos_vencendo.append({
                    'id': str(veiculo.id),
                    'placa': veiculo.placa,
                    'documentos_vencendo': docs_vencendo
                })

        return Response({
            'dias_alerta': dias,
            'total': len(veiculos_vencendo),
            'veiculos': veiculos_vencendo
        })
```

#### 4.4 Atualizar `transport/views/__init__.py`

```python
# Adicionar imports
from .cliente_views import ClienteViewSet
from .motorista_views import MotoristaViewSet
from .vehicle_views import CompartimentacaoVeiculoViewSet  # NOVO
```

---

### **FASE 5: URLs** ⏱️ 30 minutos

#### 5.1 Atualizar `transport/api_urls.py`

```python
# Adicionar imports
from .views import (
    # ... existentes ...
    ClienteViewSet,
    MotoristaViewSet,
    CompartimentacaoVeiculoViewSet,
)

# Registrar no router
router.register(r"clientes", ClienteViewSet, basename="cliente")
router.register(r"motoristas", MotoristaViewSet, basename="motorista")

# Rotas aninhadas - Compartimentação de Veículos
veiculos_router.register(
    r"compartimentos",
    CompartimentacaoVeiculoViewSet,
    basename="veiculo-compartimento"
)
```

**URLs criadas:**
- `/api/clientes/`
- `/api/clientes/{id}/`
- `/api/clientes/export/`
- `/api/motoristas/`
- `/api/motoristas/{id}/`
- `/api/motoristas/vencimentos/`
- `/api/motoristas/export/`
- `/api/veiculos/{veiculo_id}/compartimentos/`
- `/api/veiculos/{veiculo_id}/compartimentos/{id}/`
- `/api/veiculos/vencimentos/` (NOVO)

---

### **FASE 6: ADMIN** ⏱️ 1 hora

#### 6.1 Criar `transport/admin/cliente.py`

```python
# transport/admin/cliente.py

from django.contrib import admin
from ..models import Cliente


@admin.register(Cliente)
class ClienteAdmin(admin.ModelAdmin):
    """Admin para Cliente."""

    list_display = [
        'razao_social', 'nome_fantasia', 'cnpj', 'cidade',
        'estado', 'tipo_frete', 'ativo', 'criado_em'
    ]
    list_filter = ['ativo', 'tipo_frete', 'estado', 'criado_em']
    search_fields = ['razao_social', 'nome_fantasia', 'cnpj', 'ie']
    readonly_fields = ['id', 'criado_em', 'atualizado_em']

    fieldsets = (
        ('Dados Fiscais', {
            'fields': ('razao_social', 'nome_fantasia', 'cnpj', 'ie')
        }),
        ('Endereço', {
            'fields': (
                'logradouro', 'numero', 'complemento',
                'bairro', 'cidade', 'estado', 'cep'
            )
        }),
        ('Operacional', {
            'fields': ('distancia', 'tipo_frete', 'ativo')
        }),
        ('Observações', {
            'fields': ('observacoes',),
            'classes': ('collapse',)
        }),
        ('Metadados', {
            'fields': ('id', 'criado_em', 'atualizado_em'),
            'classes': ('collapse',)
        })
    )
```

#### 6.2 Criar `transport/admin/motorista.py`

```python
# transport/admin/motorista.py

from django.contrib import admin
from django.utils.html import format_html
from datetime import date, timedelta
from ..models import Motorista


@admin.register(Motorista)
class MotoristaAdmin(admin.ModelAdmin):
    """Admin para Motorista."""

    list_display = [
        'nome', 'cpf', 'cnh', 'categoria_cnh',
        'status_documentos', 'ativo', 'criado_em'
    ]
    list_filter = ['ativo', 'categoria_cnh', 'criado_em']
    search_fields = ['nome', 'cpf', 'cnh']
    readonly_fields = ['id', 'criado_em', 'atualizado_em', 'alertas_vencimento']

    fieldsets = (
        ('Dados Pessoais', {
            'fields': ('nome', 'cpf', 'telefone', 'email')
        }),
        ('CNH', {
            'fields': ('cnh', 'categoria_cnh', 'validade_cnh')
        }),
        ('Certificações', {
            'fields': ('nr20_validade', 'nr35_validade', 'mopp_validade')
        }),
        ('Endereço', {
            'fields': (
                'logradouro', 'numero', 'complemento',
                'bairro', 'cidade', 'estado', 'cep'
            ),
            'classes': ('collapse',)
        }),
        ('Status', {
            'fields': ('ativo', 'observacoes')
        }),
        ('Alertas', {
            'fields': ('alertas_vencimento',),
            'classes': ('collapse',)
        }),
        ('Metadados', {
            'fields': ('id', 'criado_em', 'atualizado_em'),
            'classes': ('collapse',)
        })
    )

    def status_documentos(self, obj):
        """Mostra status visual dos documentos."""
        docs_vencendo = obj.get_documentos_vencendo(dias=30)

        if not docs_vencendo:
            return format_html('<span style="color: green;">✓ OK</span>')

        vencidos = [d for d in docs_vencendo if d['vencido']]
        if vencidos:
            return format_html(
                '<span style="color: red;">✗ {} vencido(s)</span>',
                len(vencidos)
            )

        return format_html(
            '<span style="color: orange;">⚠ {} vencendo</span>',
            len(docs_vencendo)
        )

    status_documentos.short_description = 'Status Docs'

    def alertas_vencimento(self, obj):
        """Mostra alertas de vencimento formatados."""
        docs_vencendo = obj.get_documentos_vencendo(dias=30)

        if not docs_vencendo:
            return "Todos os documentos estão válidos."

        html = "<ul>"
        for doc in docs_vencendo:
            cor = 'red' if doc['vencido'] else 'orange'
            status = 'VENCIDO' if doc['vencido'] else 'Vence em breve'
            html += f"<li style='color: {cor};'><strong>{doc['documento']}</strong>: {doc['validade']} ({status})</li>"
        html += "</ul>"

        return format_html(html)

    alertas_vencimento.short_description = 'Alertas de Vencimento'
```

#### 6.3 Atualizar `transport/admin/vehicles.py`

```python
# Adicionar import
from ..models import Veiculo, ManutencaoVeiculo, CompartimentacaoVeiculo

# Inline para Compartimentação
class CompartimentacaoVeiculoInline(admin.TabularInline):
    """Inline para edição de compartimentos do veículo."""
    model = CompartimentacaoVeiculo
    extra = 1
    fields = ['numero_boca', 'capacidade_m3']
    ordering = ['numero_boca']


# Atualizar VeiculoAdmin
@admin.register(Veiculo)
class VeiculoAdmin(admin.ModelAdmin):
    # ... campos existentes ...

    inlines = [CompartimentacaoVeiculoInline]  # ADICIONAR

    fieldsets = (
        # ... fieldsets existentes ...
        ('Documentação', {  # NOVO FIELDSET
            'fields': (
                'civ_validade', 'cipp_validade', 'afericao_validade',
                'crlv_validade', 'cronotacografo_validade'
            )
        }),
        ('Capacidade', {  # NOVO FIELDSET
            'fields': ('capacidade_m3',)
        }),
        # ... resto dos fieldsets ...
    )
```

#### 6.4 Atualizar `transport/admin/__init__.py`

```python
# Adicionar imports
from .cliente import ClienteAdmin
from .motorista import MotoristaAdmin
```

---

### **FASE 7: TESTES** ⏱️ 1.5 horas

#### 7.1 Criar `transport/tests/test_cliente.py`

```python
# transport/tests/test_cliente.py

from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from ..models import Cliente

User = get_user_model()


class ClienteModelTest(TestCase):
    """Testes para o modelo Cliente."""

    def test_create_cliente(self):
        """Testa criação de cliente."""
        cliente = Cliente.objects.create(
            razao_social="Empresa Teste Ltda",
            cnpj="12345678000190",
            tipo_frete="CIF"
        )
        self.assertEqual(cliente.razao_social, "Empresa Teste Ltda")
        self.assertTrue(cliente.ativo)

    def test_cnpj_formatado(self):
        """Testa __str__ com CNPJ."""
        cliente = Cliente.objects.create(
            razao_social="Empresa Teste",
            cnpj="12345678000190"
        )
        self.assertIn("12345678000190", str(cliente))


class ClienteAPITest(TestCase):
    """Testes para a API de Cliente."""

    def setUp(self):
        """Setup inicial."""
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='testuser',
            password='testpass123'
        )
        self.client.force_authenticate(user=self.user)

    def test_list_clientes(self):
        """Testa listagem de clientes."""
        Cliente.objects.create(
            razao_social="Cliente 1",
            cnpj="12345678000190"
        )
        Cliente.objects.create(
            razao_social="Cliente 2",
            cnpj="98765432000110"
        )

        response = self.client.get('/api/clientes/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)

    def test_create_cliente(self):
        """Testa criação via API."""
        data = {
            'razao_social': 'Nova Empresa Ltda',
            'cnpj': '11222333000144',
            'tipo_frete': 'FOB'
        }

        response = self.client.post('/api/clientes/', data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Cliente.objects.count(), 1)

    def test_filter_by_tipo_frete(self):
        """Testa filtro por tipo de frete."""
        Cliente.objects.create(
            razao_social="Cliente CIF",
            cnpj="12345678000190",
            tipo_frete="CIF"
        )
        Cliente.objects.create(
            razao_social="Cliente FOB",
            cnpj="98765432000110",
            tipo_frete="FOB"
        )

        response = self.client.get('/api/clientes/?tipo_frete=CIF')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
```

#### 7.2 Criar testes similares para Motorista e Compartimentação

#### 7.3 Executar testes
```bash
python manage.py test transport.tests.test_cliente
python manage.py test transport.tests.test_motorista
python manage.py test transport.tests.test_compartimentacao
```

---

### **FASE 8: DOCUMENTAÇÃO** ⏱️ 30 minutos

#### 8.1 Atualizar `doc/API_ENDPOINTS.md`

Adicionar seções:
- **Clientes** - CRUD completo
- **Motoristas** - CRUD completo + vencimentos
- **Veículos** - Atualizar com novos campos + compartimentação

#### 8.2 Criar `doc/CADASTROS_BASICOS.md`

Documentação de uso dos novos cadastros:
- Como cadastrar clientes
- Como cadastrar motoristas
- Como adicionar compartimentação a veículos
- Sistema de alertas de vencimento

---

### **FASE 9: VALIDAÇÃO E AJUSTES** ⏱️ 1 hora

#### 9.1 Testes Manuais via Swagger
- Acessar `/api/swagger/`
- Testar cada endpoint criado
- Validar filtros
- Testar exportações CSV

#### 9.2 Testes de Integração
- Criar cliente via API
- Criar motorista via API
- Criar veículo com compartimentação
- Verificar alertas de vencimento

#### 9.3 Validação de Admin
- Acessar `/admin/`
- Testar CRUD de Clientes
- Testar CRUD de Motoristas
- Testar inline de Compartimentação em Veículos

---

## 📝 CHECKLIST DE IMPLEMENTAÇÃO

### **Pré-Requisitos**
- [ ] Ambiente de desenvolvimento ativo
- [ ] Banco de dados funcionando
- [ ] Usuário admin criado

### **Fase 1 - Modelos**
- [ ] Criar modelo Cliente
- [ ] Criar modelo Motorista
- [ ] Atualizar modelo Veiculo
- [ ] Criar modelo CompartimentacaoVeiculo
- [ ] Adicionar métodos `get_documentos_vencendo()`

### **Fase 2 - Migrations**
- [ ] Criar migration
- [ ] Revisar migration gerada
- [ ] Aplicar migration
- [ ] Verificar banco de dados

### **Fase 3 - Serializers**
- [ ] Criar `cliente_serializers.py`
- [ ] Criar `motorista_serializers.py`
- [ ] Atualizar `vehicle_serializers.py`
- [ ] Atualizar `__init__.py`

### **Fase 4 - Views**
- [ ] Criar `cliente_views.py`
- [ ] Criar `motorista_views.py`
- [ ] Atualizar `vehicle_views.py`
- [ ] Atualizar `__init__.py`

### **Fase 5 - URLs**
- [ ] Registrar rotas no `api_urls.py`
- [ ] Testar URLs no navegador

### **Fase 6 - Admin**
- [ ] Criar `cliente.py` admin
- [ ] Criar `motorista.py` admin
- [ ] Atualizar `vehicles.py` admin
- [ ] Testar interface admin

### **Fase 7 - Testes**
- [ ] Criar testes de modelo
- [ ] Criar testes de API
- [ ] Executar todos os testes
- [ ] Corrigir falhas

### **Fase 8 - Documentação**
- [ ] Atualizar `API_ENDPOINTS.md`
- [ ] Criar `CADASTROS_BASICOS.md`
- [ ] Atualizar Swagger

### **Fase 9 - Validação**
- [ ] Testes via Swagger
- [ ] Testes manuais
- [ ] Validação de alertas
- [ ] Code review

---

## 🔍 VALIDAÇÕES E REGRAS DE NEGÓCIO

### **Cliente**
- ✓ CNPJ obrigatório e único
- ✓ Formato: 14 dígitos numéricos
- ✓ UF válida (27 estados + DF)
- ✓ Tipo frete: CIF ou FOB
- ✓ Distância em KM (positivo)

### **Motorista**
- ✓ CPF obrigatório e único (11 dígitos)
- ✓ CNH obrigatória e única
- ✓ Categoria CNH válida (A-E, AB-AE)
- ✓ Datas de validade não podem ser no passado (warning)
- ✓ Sistema de alertas (30 dias antes)

### **Veículo**
- ✓ Placa obrigatória e única
- ✓ Datas de documentação opcionales
- ✓ Capacidade M³ positiva
- ✓ Sistema de alertas (30 dias antes)

### **Compartimentação**
- ✓ Número de boca: 1-9
- ✓ Capacidade positiva
- ✓ Único por veículo (unique_together)
- ✓ Soma das bocas ≤ capacidade total (validação futura)

---

## 🚀 PRÓXIMOS PASSOS (Fases Futuras)

### **Fase 10 - Dashboard de Vencimentos**
- [ ] Criar endpoint `/api/dashboard/vencimentos/`
- [ ] Agregar alertas de Veículos + Motoristas
- [ ] Interface visual de alertas

### **Fase 11 - Integração com CT-e/MDF-e**
- [ ] Vincular Cliente a CTeRemetente/Destinatario
- [ ] Vincular Motorista a CTeMotorista/MDFeCondutor
- [ ] Auto-preenchimento de dados

### **Fase 12 - Notificações**
- [ ] Sistema de notificações email
- [ ] Alertas automáticos de vencimento
- [ ] Relatórios periódicos

### **Fase 13 - Validações Avançadas**
- [ ] Validação de dígitos verificadores (CPF, CNPJ, CNH)
- [ ] Integração com API de CEP
- [ ] Validação de IE por UF

---

## 📊 MÉTRICAS DE SUCESSO

- ✅ Migration aplicada sem erros
- ✅ Todos os testes unitários passando
- ✅ APIs respondendo corretamente
- ✅ Admin funcional
- ✅ Swagger atualizado
- ✅ Documentação completa
- ✅ Sistema de alertas funcionando
- ✅ Performance aceitável (< 500ms por request)

---

## ⚠️ RISCOS E MITIGAÇÕES

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| Migration falhar | Baixa | Alto | Backup do banco antes, teste em dev |
| Dados existentes incompatíveis | Média | Médio | Campos novos nullable, migration reversível |
| Performance degradada | Baixa | Médio | Índices corretos, queries otimizadas |
| Validações muito restritivas | Média | Baixo | Validações em serializers, não em models |
| Conflito de CNPJs/CPFs | Baixa | Alto | Unique constraints, tratamento de erro |

---

## 📚 REFERÊNCIAS

- Mockups: `nova implementação/*.jpg`
- Documentação Django: https://docs.djangoproject.com/
- DRF: https://www.django-rest-framework.org/
- Estrutura atual: Análise do agente Explore

---

**Plano criado em:** 26/11/2024
**Versão:** 1.0
**Estimativa total:** 6-8 horas
**Prioridade:** Alta

---

## 🎯 COMEÇAR IMPLEMENTAÇÃO?

Para iniciar, execute:

```bash
# 1. Criar branch de desenvolvimento
git checkout -b feature/cadastros-basicos

# 2. Começar pela Fase 1 (Modelos)
# Editar: transport/models.py

# 3. Seguir o plano passo a passo
```

Está pronto para começar? Posso auxiliar em qualquer fase! 🚀
