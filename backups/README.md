# Backups do Destack

Os dumps PostgreSQL locais ficam em `backups/daily/`. Backups de pré-deploy
ficam em `backups/predeploy/`; esse diretório não é montado nos containers da
aplicação. Nunca versione dumps, chaves ou arquivos `.env`.

## Camadas de proteção

- O Celery cria diariamente um dump custom do PostgreSQL, valida com
  `pg_restore --list`, grava SHA-256 e só então publica o arquivo final.
- `scripts/backup-offsite.sh` cria um dump novo, copia o bucket MinIO e também
  o volume legado `destack_media_volume`. Os três artefatos são criptografados
  com uma chave pública GPG cuja chave privada não fica nos servidores. A cópia usa um diretório remoto
  `.partial-*`, valida todos os checksums e só depois o promove atomicamente e
  grava `COMPLETE`.
- `scripts/monitor-producao.sh` valida containers, zumbis, health composto,
  disco e idade/integridade dos backups local e externo.
- Falhas criam alertas no próprio Destack e no journal do systemd. E-mail e
  webhook são opcionais e precisam ser configurados explicitamente.

Meta operacional atual: RPO de até 24 horas e RTO de até 4 horas. Retenção
offsite padrão: 30 dias. Um restore de ensaio deve ser executado ao menos uma
vez por trimestre.

## Configuração protegida

Crie `/etc/destack/backup-offsite.env` como `root`, modo `0600`:

```bash
MINIO_BUCKET_NAME=destack-media
OFFSITE_HOST=backup.example.com
OFFSITE_USER=destack-backup
OFFSITE_PATH=/srv/destack-backup/incoming
OFFSITE_SSH_KEY=/root/.ssh/destack_backup_ed25519
OFFSITE_RETENTION_DAYS=30
BACKUP_GPG_RECIPIENT=impressao-digital-da-chave
BACKUP_GNUPGHOME=/etc/destack/backup-gpg
# BACKUP_ALERT_WEBHOOK_URL=https://...
```

O usuário remoto deve ser dedicado, sem sudo, com senha bloqueada e chave SSH
exclusiva. No destino, `destack-seal-offsite.timer` move as releases concluídas
da área `incoming` para um arquivo pertencente a `root`; assim, a chave da
origem não consegue alterar ou excluir backups já selados. Snapshots imutáveis
do provedor continuam recomendados.

Para alertas de e-mail do backup Celery, configure no `.env` de produção:

```bash
BACKUP_NOTIFICATION_EMAIL=operacoes@example.com
DJANGO_EMAIL_HOST=smtp.example.com
DJANGO_EMAIL_PORT=587
DJANGO_EMAIL_USE_TLS=True
DJANGO_EMAIL_HOST_USER=...
DJANGO_EMAIL_HOST_PASSWORD=...
DJANGO_DEFAULT_FROM_EMAIL=destack@example.com
```

O canal externo não deve ser considerado ativo enquanto um destinatário real
ou `BACKUP_ALERT_WEBHOOK_URL`/`MONITOR_ALERT_WEBHOOK_URL` não estiver definido
e testado.

## Instalação e operação

O deploy canônico instala e habilita os timers. Para inspecioná-los:

```bash
systemctl list-timers 'destack-*'
systemctl status destack-backup-offsite.timer destack-monitor.timer
journalctl -u destack-backup-offsite.service -u destack-monitor.service
```

Execução e verificação manuais:

```bash
systemctl start destack-backup-offsite.service
systemctl start destack-monitor.service
cat /var/lib/destack-monitor/backup-offsite.success
cat /var/lib/destack-monitor/monitor.success
```

## Restore de ensaio

Copie uma release concluída (`COMPLETE` presente), valide `SHA256SUMS`,
descriptografe com a chave privada de recuperação e faça o restore somente em
ambiente isolado:

```bash
sha256sum -c SHA256SUMS
gpg --output database.dump --decrypt database.dump.gpg
gpg --output media.tar.gz --decrypt media.tar.gz.gpg
gpg --output media-volume.tar.gz --decrypt media-volume.tar.gz.gpg
createdb destack_restore_test
pg_restore --clean --if-exists --no-owner --no-acl \
  --dbname=destack_restore_test database.dump
```

Depois valide migrações, contagens fiscais/financeiras e abertura dos anexos do
MinIO e de `media-volume.tar.gz`. Nunca restaure automaticamente o banco durante
rollback de aplicação; use o dump pré-deploy apenas após decisão operacional.
