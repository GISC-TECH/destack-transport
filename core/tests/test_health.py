from unittest.mock import patch

from django.test import SimpleTestCase, override_settings


@override_settings(MINIO_ENABLED=False)
class HealthCheckTests(SimpleTestCase):
    databases = {"default"}

    def test_returns_healthy_when_required_dependencies_work(self):
        response = self.client.get("/api/health/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "healthy")
        self.assertEqual(response.json()["checks"]["cache"], "ok")
        self.assertEqual(response.json()["checks"]["storage"], "disabled")

    @patch("core.health.cache.set", side_effect=ConnectionError("redis unavailable"))
    def test_cache_failure_marks_service_unhealthy(self, _mock_cache_set):
        response = self.client.get("/api/health/")

        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json()["status"], "unhealthy")
        self.assertEqual(response.json()["checks"]["cache"], "error")

    @override_settings(MINIO_ENABLED=True)
    @patch("core.health.default_storage.exists", side_effect=OSError("storage unavailable"))
    def test_storage_failure_marks_service_unhealthy(self, _mock_exists):
        response = self.client.get("/api/health/")

        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json()["checks"]["storage"], "error")
