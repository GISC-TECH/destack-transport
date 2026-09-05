import subprocess
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from django.contrib.auth.models import Permission, User
from django.contrib.contenttypes.models import ContentType
from django.test import TestCase, override_settings
from rest_framework import status
from rest_framework.test import APIClient

from transport.models import RegistroBackup


class BackupAPITests(TestCase):
    def setUp(self):
        self.tempdir = TemporaryDirectory()
        self.addCleanup(self.tempdir.cleanup)
        self.settings_override = override_settings(MEDIA_ROOT=self.tempdir.name)
        self.settings_override.enable()
        self.addCleanup(self.settings_override.disable)

        self.client = APIClient()
        self.user = User.objects.create_user(
            username="backup_admin",
            password="test-only-password",
        )
        content_type = ContentType.objects.get_for_model(RegistroBackup)
        self.user.user_permissions.add(*Permission.objects.filter(
            content_type=content_type,
            codename__in=["view_registrobackup", "change_registrobackup"],
        ))
        self.client.force_authenticate(self.user)

        self.backup_dir = Path(self.tempdir.name) / "backups"
        self.backup_dir.mkdir(parents=True)
        self.backup_path = self.backup_dir / "backup_test.sql"
        self.backup_path.write_bytes(b"backup-content")
        self.registro = RegistroBackup.objects.create(
            nome_arquivo=self.backup_path.name,
            tamanho_bytes=self.backup_path.stat().st_size,
            md5_hash="0" * 32,
            localizacao=str(self.backup_path),
            usuario=self.user.username,
            status="completo",
        )

    def test_authorized_user_can_list_backups_without_internal_path(self):
        response = self.client.get("/api/backup/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertTrue(response.data[0]["disponivel"])
        self.assertNotIn("localizacao", response.data[0])

    def test_authorized_user_can_stream_backup_download(self):
        response = self.client.get(f"/api/backup/{self.registro.id}/download/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(b"".join(response.streaming_content), b"backup-content")
        self.assertIn("attachment", response["Content-Disposition"])
        self.assertEqual(response["Cache-Control"], "private, no-store")

    @patch("transport.views.config_views.subprocess.run")
    def test_generate_backup_can_return_json_for_streaming_download(self, mock_run):
        def create_fake_backup(command, **kwargs):
            if "-f" in command:
                output_path = Path(command[command.index("-f") + 1])
                output_path.write_bytes(b"generated-backup")
            else:
                kwargs["stdout"].write("generated-backup")
            return subprocess.CompletedProcess(command, 0, stdout="", stderr="")

        mock_run.side_effect = create_fake_backup

        response = self.client.post("/api/backup/gerar/?response=json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data["success"])
        self.assertTrue(response.data["backup"]["disponivel"])
        self.assertNotIn("localizacao", response.data["backup"])

    def test_missing_backup_is_marked_unavailable_and_returns_404(self):
        self.backup_path.unlink()

        list_response = self.client.get("/api/backup/")
        download_response = self.client.get(
            f"/api/backup/{self.registro.id}/download/"
        )

        self.assertFalse(list_response.data[0]["disponivel"])
        self.assertEqual(download_response.status_code, status.HTTP_404_NOT_FOUND)

    def test_backup_path_outside_media_backup_directory_is_rejected(self):
        outside_path = Path(self.tempdir.name) / "outside.sql"
        outside_path.write_bytes(b"must-not-be-downloaded")
        self.registro.localizacao = str(outside_path)
        self.registro.save(update_fields=["localizacao"])

        response = self.client.get(f"/api/backup/{self.registro.id}/download/")

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_user_without_backup_permission_is_denied(self):
        unauthorized = User.objects.create_user(
            username="no_backup_access",
            password="test-only-password",
        )
        self.client.force_authenticate(unauthorized)

        response = self.client.get("/api/backup/")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
