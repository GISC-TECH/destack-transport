from pathlib import Path

from django.conf import settings


def resolve_registered_backup_path(location):
    """Retorna somente arquivos regulares dentro do diretório oficial de backups."""
    if not location:
        return None

    try:
        backup_root = (Path(settings.MEDIA_ROOT) / "backups").resolve()
        candidate = Path(location).resolve(strict=False)
    except (OSError, RuntimeError, TypeError):
        return None

    try:
        candidate.relative_to(backup_root)
    except ValueError:
        return None

    try:
        return candidate if candidate.is_file() else None
    except OSError:
        return None
