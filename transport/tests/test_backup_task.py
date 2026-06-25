import os
import subprocess
import tempfile
import time
from pathlib import Path
from unittest.mock import MagicMock, patch

from django.test import TestCase, override_settings

from transport.tasks import backup_database


class BackupTaskTests(TestCase):
    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmpdir.cleanup)

    @override_settings(BACKUP_NOTIFICATION_EMAIL="admin@example.com")
    @patch("transport.tasks.subprocess.run")
    @patch("transport.tasks.send_mail")
    def test_backup_database_success_and_cleans_old_files(self, mock_send_mail, mock_run):
        mock_run.return_value = MagicMock(returncode=0, stderr="")

        backup_dir = Path(self.tmpdir.name) / "backups" / "daily"
        backup_dir.mkdir(parents=True)

        # Cria arquivo antigo para validar a remocao.
        old_file = backup_dir / "20260101_000000.dump"
        old_file.write_text("old backup")
        old_time = time.time() - 8 * 24 * 3600
        os.utime(old_file, (old_time, old_time))

        with override_settings(BASE_DIR=self.tmpdir.name):
            result = backup_database()

        self.assertEqual(result["status"], "success")
        self.assertIn("backups/daily/", result["path"])
        self.assertEqual(result["removed"], 1)
        self.assertFalse(old_file.exists())

        mock_run.assert_called_once()
        call_args = mock_run.call_args
        self.assertEqual(call_args.kwargs.get("shell"), False)

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
        mock_run.return_value = MagicMock(returncode=0, stderr="")

        with override_settings(BASE_DIR=self.tmpdir.name):
            result = backup_database()

        self.assertEqual(result["status"], "success")
        mock_send_mail.assert_not_called()
