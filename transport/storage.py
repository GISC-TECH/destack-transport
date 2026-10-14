"""Backends de armazenamento privados usados pelo Destack."""

from functools import cached_property

import boto3
from botocore.client import Config
from django.conf import settings
from storages.backends.s3 import S3Storage


class PrivateMinioStorage(S3Storage):
    """Usa o endpoint interno para I/O e assina links no endpoint público."""

    @cached_property
    def public_client(self):
        return boto3.client(
            's3',
            endpoint_url=settings.MINIO_PUBLIC_URL,
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            region_name=settings.AWS_S3_REGION_NAME,
            verify=settings.AWS_S3_VERIFY,
            config=Config(signature_version='s3v4', s3={'addressing_style': 'path'}),
        )

    def url(self, name, parameters=None, expire=None, http_method=None):
        params = {'Bucket': self.bucket_name, 'Key': self._normalize_name(name)}
        if parameters:
            params.update(parameters)
        return self.public_client.generate_presigned_url(
            'get_object',
            Params=params,
            ExpiresIn=expire or settings.AWS_QUERYSTRING_EXPIRE,
            HttpMethod=http_method,
        )
