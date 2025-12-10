# transport/serializers/__init__.py

# Importar todos os serializers para facilitar acesso
from .cliente_serializers import ClienteSerializer, ClienteListSerializer
from .motorista_serializers import MotoristaSerializer, MotoristaListSerializer
from .vehicle_serializers import (
    VeiculoSerializer,
    ManutencaoVeiculoSerializer,
    CompartimentacaoVeiculoSerializer,
    ManutencaoIndicadoresSerializer,
    ManutencaoGraficosSerializer
)
from .documento_serializers import (
    DocumentoAnexoSerializer,
    DocumentoAnexoListSerializer,
    DocumentoAnexoUploadSerializer
)

__all__ = [
    'ClienteSerializer',
    'ClienteListSerializer',
    'MotoristaSerializer',
    'MotoristaListSerializer',
    'VeiculoSerializer',
    'ManutencaoVeiculoSerializer',
    'CompartimentacaoVeiculoSerializer',
    'ManutencaoIndicadoresSerializer',
    'ManutencaoGraficosSerializer',
    'DocumentoAnexoSerializer',
    'DocumentoAnexoListSerializer',
    'DocumentoAnexoUploadSerializer',
]
