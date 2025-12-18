# Guia de Configuração de Subdomínios

## Como adicionar subdomínios ao seu sistema

### 1. Configuração Local (para testes)

Edite o arquivo `/etc/hosts` para testar localmente:

```bash
sudo nano /etc/hosts
```

Adicione:
```
127.0.0.1   api.local
127.0.0.1   app.local
127.0.0.1   admin.local
```

### 2. Configuração em Produção

#### Passo 1: Configure o DNS
No seu provedor de DNS (Cloudflare, Route53, etc), crie registros A ou CNAME:
- `api.seudominio.com` → IP do servidor
- `app.seudominio.com` → IP do servidor
- `admin.seudominio.com` → IP do servidor

#### Passo 2: Configure o Nginx
1. Copie o arquivo de exemplo:
```bash
cp nginx/conf.d/subdomains.conf.example nginx/conf.d/subdomains.conf
```

2. Edite o arquivo e substitua `seudominio.com` pelos seus domínios reais

3. Reinicie o nginx:
```bash
docker-compose restart nginx
```

### 3. Exemplos de Configurações

#### Exemplo 1: Adicionar uma aplicação React
```nginx
upstream react_app {
    server react_container:3000;
}

server {
    listen 80;
    server_name app.seudominio.com;
    
    location / {
        return 301 https://$server_name$request_uri;
    }
}

server {
    listen 443 ssl;
    server_name app.seudominio.com;
    
    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    
    location / {
        proxy_pass http://react_app;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

#### Exemplo 2: Adicionar uma API Node.js
No `docker-compose.yml`, adicione:
```yaml
node_api:
  image: node:18
  working_dir: /app
  volumes:
    - ./node_api:/app
  command: npm start
  environment:
    - PORT=4000
  networks:
    - default
```

No nginx, adicione:
```nginx
upstream node_api {
    server node_api:4000;
}

server {
    listen 443 ssl;
    server_name nodeapi.seudominio.com;
    
    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    
    location / {
        proxy_pass http://node_api;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 4. SSL/TLS com Let's Encrypt

Para cada subdomínio, obtenha certificados SSL:

```bash
# Para um domínio
docker-compose run --rm certbot certonly \
  --webroot --webroot-path /var/www/certbot \
  -d api.seudominio.com

# Para múltiplos domínios
docker-compose run --rm certbot certonly \
  --webroot --webroot-path /var/www/certbot \
  -d api.seudominio.com \
  -d app.seudominio.com \
  -d admin.seudominio.com
```

### 5. Estrutura de Diretórios Recomendada

```
/root/cte_mdfe_api/
├── docker-compose.yml          # Aplicação principal
├── docker-compose.override.yml # Configurações de desenvolvimento
├── nginx/
│   └── conf.d/
│       ├── default.conf        # Configuração principal
│       └── subdomains.conf     # Configurações de subdomínios
├── app1/                       # Primeira aplicação
├── app2/                       # Segunda aplicação
└── static_sites/               # Sites estáticos
    ├── www/
    └── docs/
```

### 6. Comandos Úteis

```bash
# Verificar configuração do nginx
docker exec cte_mdfe_api_nginx_1 nginx -t

# Recarregar nginx sem parar
docker exec cte_mdfe_api_nginx_1 nginx -s reload

# Ver logs do nginx
docker logs -f cte_mdfe_api_nginx_1

# Listar todos os containers
docker ps

# Adicionar novo container ao docker-compose
docker-compose -f docker-compose.yml -f docker-compose-multi-app.yml up -d
```

### 7. Problemas Comuns

1. **Erro 502 Bad Gateway**: Verifique se o container/aplicação está rodando
2. **Erro de SSL**: Verifique os caminhos dos certificados
3. **Subdomínio não funciona**: Verifique configuração DNS e /etc/hosts
4. **Container não encontrado**: Verifique se está na mesma rede Docker

### 8. Segurança

- Use sempre HTTPS em produção
- Configure CORS adequadamente para cada aplicação
- Use rate limiting para APIs públicas
- Configure firewalls adequadamente
- Mantenha certificados SSL atualizados