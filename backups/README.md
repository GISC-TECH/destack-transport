# Backups do Banco de Dados

Esta pasta contém os backups do banco de dados de produção.

## Arquivos

- `*.dump` - Backup em formato binário (PostgreSQL custom format)
- `*.sql` - Backup em formato SQL texto

## ⚠️ IMPORTANTE

- **NÃO commitar arquivos de backup no Git!**
- Arquivos .dump e .sql estão no .gitignore
- Mantenha os backups seguros e privados
- Use apenas para desenvolvimento local

## Como Usar

1. Coloque o arquivo de backup nesta pasta
2. Execute o script de restauração:
   ```bash
   ./scripts/restore-backup.sh
   ```

## Informações

- Banco: `destack_db`
- Usuário: `destack_user`
- Formato: PostgreSQL 15
