# transport/management/commands/criar_bucket_minio.py
"""
Valida o bucket privado provisionado pelo serviço ``minio_init``.

Uso:
    python manage.py criar_bucket_minio
"""

import boto3
from botocore import UNSIGNED
from botocore.client import Config
from botocore.exceptions import ClientError
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = "Valida acesso da aplicação ao MinIO e bloqueio de acesso anônimo."

    def handle(self, *args, **options):
        if not getattr(settings, "MINIO_ENABLED", False):
            self.stdout.write(
                self.style.WARNING("USE_MINIO não está habilitado. Nada a fazer.")
            )
            return

        endpoint_url = settings.AWS_S3_ENDPOINT_URL
        access_key = settings.AWS_ACCESS_KEY_ID
        secret_key = settings.AWS_SECRET_ACCESS_KEY
        bucket_name = settings.AWS_STORAGE_BUCKET_NAME
        region = getattr(settings, "AWS_S3_REGION_NAME", "us-east-1")

        s3 = boto3.client(
            "s3",
            endpoint_url=endpoint_url,
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            region_name=region,
            verify=settings.AWS_S3_VERIFY,
        )

        try:
            s3.head_bucket(Bucket=bucket_name)
            self.stdout.write(self.style.SUCCESS(f"Bucket '{bucket_name}' já existe."))
        except ClientError as e:
            error_code = e.response["Error"]["Code"]
            if error_code == "404":
                raise CommandError(
                    f"Bucket '{bucket_name}' não existe. Execute o serviço minio_init."
                ) from e
            else:
                raise CommandError(
                    f"Erro ao verificar bucket '{bucket_name}': {error_code}"
                ) from e

        # Verificação efetiva: um objeto existente jamais pode responder a um
        # cliente sem assinatura. Assim também detectamos ACL pública residual.
        amostra = s3.list_objects_v2(Bucket=bucket_name, MaxKeys=1).get("Contents", [])
        if amostra:
            anonimo = boto3.client(
                "s3",
                endpoint_url=endpoint_url,
                region_name=region,
                verify=settings.AWS_S3_VERIFY,
                config=Config(signature_version=UNSIGNED),
            )
            try:
                anonimo.head_object(Bucket=bucket_name, Key=amostra[0]["Key"])
            except ClientError as e:
                codigo = e.response.get("Error", {}).get("Code", "")
                if codigo not in {"AccessDenied", "403", "InvalidAccessKeyId"}:
                    raise CommandError(
                        f"Não foi possível confirmar a privacidade do bucket: {codigo}"
                    ) from e
            else:
                raise CommandError(
                    "Falha de segurança: um objeto do bucket ainda aceita acesso anônimo."
                )
            self.stdout.write(self.style.SUCCESS("Acesso anônimo bloqueado (verificação 403)."))
