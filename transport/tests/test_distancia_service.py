"""
Testes para os serviços de geocodificação e cálculo de distância.
"""
from io import StringIO
from unittest.mock import patch, MagicMock

from django.core.cache import cache
from django.test import TestCase, override_settings

from transport.models import CTeDocumento
from transport.services import distancia_service, nominatim_service


@override_settings(
    NOMINATIM_BASE_URL="https://nominatim.test",
    NOMINATIM_USER_AGENT="TestAgent",
    NOMINATIM_DELAY_SECONDS=0,
)
class NominatimServiceTests(TestCase):
    def setUp(self):
        # Cada cenário deve exercitar o HTTP simulado, não um resultado Redis
        # persistido por outro teste que consultou a mesma cidade.
        cache.clear()

    @patch("transport.services.nominatim_service.requests.get")
    def test_geocodificar_retorna_coordenadas(self, mock_get):
        mock_get.return_value = MagicMock(
            status_code=200,
            raise_for_status=lambda: None,
            json=lambda: [
                {"lat": "-12.9714", "lon": "-38.5014"}
            ],
        )

        coords = nominatim_service.geocodificar("Salvador", "BA")

        self.assertIsNotNone(coords)
        self.assertAlmostEqual(coords["latitude"], -12.9714, places=4)
        self.assertAlmostEqual(coords["longitude"], -38.5014, places=4)

    @patch("transport.services.nominatim_service.requests.get")
    def test_geocodificar_sem_resultado_retorna_none(self, mock_get):
        mock_get.return_value = MagicMock(
            status_code=200,
            raise_for_status=lambda: None,
            json=lambda: [],
        )

        coords = nominatim_service.geocodificar("CidadeInexistente", "ZZ")

        self.assertIsNone(coords)

    @patch("transport.services.nominatim_service.requests.get")
    def test_geocodificar_erro_http_retorna_none(self, mock_get):
        import requests
        mock_get.side_effect = requests.exceptions.Timeout("Timeout")

        coords = nominatim_service.geocodificar("Salvador", "BA")

        self.assertIsNone(coords)


@override_settings(
    NOMINATIM_BASE_URL="https://nominatim.test",
    NOMINATIM_USER_AGENT="TestAgent",
    NOMINATIM_DELAY_SECONDS=0,
    OSRM_BASE_URL="https://router.test",
)
class DistanciaServiceTests(TestCase):
    @patch("transport.services.distancia_service.calcular_rota_osrm")
    @patch("transport.services.distancia_service.geocodificar")
    def test_calcular_distancia_cidade_uf(self, mock_geo, mock_rota):
        mock_geo.side_effect = [
            {"latitude": -12.9714, "longitude": -38.5014},
            {"latitude": -13.8317, "longitude": -40.0761},
        ]
        mock_rota.return_value = {
            "distancia_km": 350.75,
            "duracao_min": 240,
        }

        distancia = distancia_service.calcular_distancia_cidade_uf(
            "Salvador", "BA", "Barreiras", "BA"
        )

        self.assertEqual(distancia, 351)
        mock_geo.assert_any_call("Salvador", "BA")
        mock_geo.assert_any_call("Barreiras", "BA")

    @patch("transport.services.distancia_service.geocodificar")
    def test_calcular_distancia_retorna_none_se_geocodificacao_falhar(self, mock_geo):
        mock_geo.return_value = None

        distancia = distancia_service.calcular_distancia_cidade_uf(
            "Salvador", "BA", "Barreiras", "BA"
        )

        self.assertIsNone(distancia)

    @patch("transport.services.distancia_service.calcular_rota_osrm")
    @patch("transport.services.distancia_service.geocodificar")
    def test_calcular_distancia_retorna_none_se_osrm_falhar(self, mock_geo, mock_rota):
        mock_geo.side_effect = [
            {"latitude": -12.9714, "longitude": -38.5014},
            {"latitude": -13.8317, "longitude": -40.0761},
        ]
        mock_rota.return_value = {"erro": "Serviço indisponível"}

        distancia = distancia_service.calcular_distancia_cidade_uf(
            "Salvador", "BA", "Barreiras", "BA"
        )

        self.assertIsNone(distancia)


class RecalcularDistanciasCommandTests(TestCase):
    def setUp(self):
        self.cte = CTeDocumento.objects.create(
            chave="1" * 44,
            versao="4.00",
            processado=True,
        )
        from transport.models import CTeIdentificacao
        CTeIdentificacao.objects.create(
            cte=self.cte,
            numero="123",
            nome_mun_ini="Salvador",
            uf_ini="BA",
            nome_mun_fim="Barreiras",
            uf_fim="BA",
        )

    @patch(
        "transport.management.commands.recalcular_distancias_cte.calcular_distancia_cidade_uf"
    )
    def test_comando_atualiza_dist_km(self, mock_calcular):
        mock_calcular.return_value = 350

        from django.core.management import call_command

        out = StringIO()
        call_command("recalcular_distancias_cte", stdout=out)

        self.cte.identificacao.refresh_from_db()
        self.assertEqual(self.cte.identificacao.dist_km, 350)
        self.assertIn("CT-es a processar: 1", out.getvalue())
        self.assertIn("1 atualizados", out.getvalue())
