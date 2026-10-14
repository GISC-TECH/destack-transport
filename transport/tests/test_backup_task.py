import os
import subprocess
import tempfile
import time
from pathlib import Path
from unittest.mock import MagicMock, patch

from django.test import TestCase, override_settings

from transport.models import AlertaSistema
from transport.tasks import backup_database


class BackupTaskTests(TestCase):
    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmpdir.cleanup)

    @override_settings(BACKUP_NOTIFICATION_EMAIL="admin@example.com")
    @patch("transport.tasks.subprocess.run")
    @patch("transport.tasks.send_mail")
    def test_backup_database_success_and_cleans_old_files(self, mock_send_mail, mock_run):
        def run_command(command, **kwargs):
            if command[0] == "pg_dump":
                Path(command[-1]).write_bytes(b"valid-dump")
            return MagicMock(returncode=0, stderr="")

        mock_run.side_effect = run_command

        backup_dir = Path(self.tmpdir.name) / "backups" / "daily"
        backup_dir.mkdir(parents=True)

        # Cria arquivo antigo para validar a remocao.
        old_file = backup_dir / "20260101_000000.dump"
        old_file.write_text("old backup")
        old_checksum = backup_dir / "20260101_000000.dump.sha256"
        old_checksum.write_text("stale")
        old_time = time.time() - 8 * 24 * 3600
        os.utime(old_file, (old_time, old_time))

        with override_settings(BASE_DIR=self.tmpdir.name):
            result = backup_database()

        self.assertEqual(result["status"], "success")
        self.assertIn("backups/daily/", result["path"])
        self.assertEqual(result["removed"], 1)
        self.assertFalse(old_file.exists())
        self.assertFalse(old_checksum.exists())

        backup_path = Path(result["path"])
        checksum_path = backup_path.with_name(f"{backup_path.name}.sha256")
        self.assertTrue(backup_path.exists())
        self.assertTrue(checksum_path.exists())
        self.assertIn(result["sha256"], checksum_path.read_text())
        self.assertEqual(backup_path.stat().st_mode & 0o777, 0o600)

        self.assertEqual(mock_run.call_count, 2)
        for call in mock_run.call_args_list:
            self.assertEqual(call.kwargs.get("shell"), False)

        self.assertEqual(len(result["sha256"]), 64)

        mock_send_mail.assert_called_once()
        self.assertIn("concluido", mock_send_mail.call_args.kwargs["subject"])

    @override_settings(BACKUP_NOTIFICATION_EMAIL="admin@example.com")
    @patch("transport.tasks.subprocess.run")
    @patch("transport.tasks.send_mail")
    def test_backup_database_failure_sends_email(self, mock_send_mail, mock_run):
        mock_run.side_effect = subprocess.CalledProcessError(
            returncode=1, cmd=["pg_dump"], stderr="pg_dump failed"
        )

        with override_settings(BASE_DIR=self.tmpdir.name):
            with self.assertRaises(subprocess.CalledProcessError):
                backup_database()

        mock_send_mail.assert_called_once()
        self.assertIn("Falha", mock_send_mail.call_args.kwargs["subject"])

    @override_settings(BACKUP_NOTIFICATION_EMAIL=None)
    @patch("transport.tasks.subprocess.run")
    @patch("transport.tasks.send_mail")
    def test_backup_database_no_email_when_not_configured(self, mock_send_mail, mock_run):
        def run_command(command, **kwargs):
            if command[0] == "pg_dump":
                Path(command[-1]).write_bytes(b"valid-dump")
            return MagicMock(returncode=0, stderr="")

        mock_run.side_effect = run_command

        with override_settings(BASE_DIR=self.tmpdir.name):
            result = backup_database()

        self.assertEqual(result["status"], "success")
        mock_send_mail.assert_not_called()

    @override_settings(BACKUP_NOTIFICATION_EMAIL=None)
    @patch("transport.tasks.subprocess.run")
    def test_backup_failure_creates_single_operational_alert(self, mock_run):
        mock_run.side_effect = subprocess.CalledProcessError(
            returncode=1,
            cmd=["pg_dump"],
            stderr="database unavailable",
        )

        with override_settings(BASE_DIR=self.tmpdir.name):
            for _ in range(2):
                with self.assertRaises(subprocess.CalledProcessError):
                    backup_database()

        alertas = AlertaSistema.objects.filter(
            tipo="backup_diario_falhou",
            resolvido=False,
        )
        self.assertEqual(alertas.count(), 1)
        self.assertIn("database unavailable", alertas.get().mensagem)
