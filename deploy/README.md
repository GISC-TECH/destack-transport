# Deploy

Arquivos de referência para a configuração de produção do Destack.

- `nginx/destack.conf`: server blocks usados pelo reverse proxy público para `destacktransporte.site`.
- `certbot/reload-docker-nginx.sh`: hook de renovação do Certbot para recarregar o Nginx em Docker após troca de certificado.

Credenciais reais ficam somente no `.env` do servidor e não devem ser versionadas.
