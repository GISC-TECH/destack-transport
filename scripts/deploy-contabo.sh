#!/bin/bash
set -e
cd /root/apps/destack
docker compose -f docker-compose.contabo.yml pull
docker compose -f docker-compose.contabo.yml up -d --build
docker compose -f docker-compose.contabo.yml exec -T web python manage.py migrate --noinput
docker compose -f docker-compose.contabo.yml exec -T web python manage.py collectstatic --noinput
