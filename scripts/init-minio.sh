#!/bin/sh

set -eu

: "${MINIO_ROOT_USER:?MINIO_ROOT_USER não definido}"
: "${MINIO_ROOT_PASSWORD:?MINIO_ROOT_PASSWORD não definido}"
: "${MINIO_ACCESS_KEY:?MINIO_ACCESS_KEY não definido}"
: "${MINIO_SECRET_KEY:?MINIO_SECRET_KEY não definido}"
: "${MINIO_BUCKET_NAME:?MINIO_BUCKET_NAME não definido}"

if [ "$MINIO_ROOT_USER" = "$MINIO_ACCESS_KEY" ]; then
    echo "ERRO: a credencial da aplicação não pode ser a credencial root do MinIO." >&2
    exit 1
fi

until mc alias set local http://minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null 2>&1; do
    sleep 2
done

mc mb --ignore-existing "local/$MINIO_BUCKET_NAME"

policy_file="$(mktemp)"
trap 'rm -f "$policy_file"' EXIT

printf '%s\n' "{
  \"Version\": \"2012-10-17\",
  \"Statement\": [
    {
      \"Effect\": \"Allow\",
      \"Action\": [\"s3:GetBucketLocation\", \"s3:ListBucket\", \"s3:ListBucketMultipartUploads\"],
      \"Resource\": [\"arn:aws:s3:::$MINIO_BUCKET_NAME\"]
    },
    {
      \"Effect\": \"Allow\",
      \"Action\": [\"s3:GetObject\", \"s3:PutObject\", \"s3:DeleteObject\", \"s3:AbortMultipartUpload\", \"s3:ListMultipartUploadParts\"],
      \"Resource\": [\"arn:aws:s3:::$MINIO_BUCKET_NAME/*\"]
    }
  ]
}" > "$policy_file"

mc admin user add local "$MINIO_ACCESS_KEY" "$MINIO_SECRET_KEY"
mc admin policy create local destack-media-rw "$policy_file"
mc admin policy attach local destack-media-rw --user "$MINIO_ACCESS_KEY"
mc anonymous set none "local/$MINIO_BUCKET_NAME"

echo "MinIO inicializado com usuário de aplicação restrito e bucket privado."
