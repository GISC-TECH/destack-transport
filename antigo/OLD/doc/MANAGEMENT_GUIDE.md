# Guia de Gerenciamento de Containers

## Ferramentas Instaladas

### 1. Portainer (Interface Web Completa)
- **Acesso**: http://localhost:9000 ou http://portainer.localhost
- **Primeira vez**: Crie uma senha para o usuário admin
- **Recursos**:
  - Gerenciar containers, imagens, volumes, redes
  - Ver logs em tempo real
  - Executar comandos dentro dos containers
  - Monitorar recursos (CPU, memória, etc)
  - Deploy de stacks (docker-compose)

### 2. Comandos Docker Úteis

```bash
# Listar containers
docker ps -a

# Ver logs
docker logs -f cte_mdfe_api_web_1

# Executar comando em container
docker exec -it cte_mdfe_api_web_1 bash

# Estatísticas em tempo real
docker stats

# Inspecionar container
docker inspect cte_mdfe_api_web_1

# Parar todos os containers
docker-compose stop

# Iniciar todos os containers
docker-compose up -d

# Reconstruir e reiniciar
docker-compose up -d --build

# Limpar sistema (cuidado!)
docker system prune -a
```

### 3. Outras Ferramentas Disponíveis

Execute o script para instalar mais ferramentas:
```bash
./install-management-tools.sh
```

**Opções**:
- **Dozzle**: Visualizador de logs leve
- **LazyDocker**: Interface terminal interativa
- **ctop**: Monitoramento tipo 'top' para containers
- **dive**: Analisador de camadas de imagens Docker

### 4. Monitoramento via Nginx

Adicione ao `/etc/hosts` para acesso local:
```bash
127.0.0.1 portainer.localhost
```

### 5. Backup e Restauração

```bash
# Backup de volumes
docker run --rm -v cte_mdfe_api_postgres_data:/data -v $(pwd):/backup alpine tar czf /backup/postgres_backup.tar.gz -C /data .

# Backup de todos os volumes
for volume in $(docker volume ls -q | grep cte_mdfe); do
    docker run --rm -v $volume:/data -v $(pwd)/backups:/backup alpine tar czf /backup/${volume}_$(date +%Y%m%d).tar.gz -C /data .
done

# Restaurar volume
docker run --rm -v cte_mdfe_api_postgres_data:/data -v $(pwd):/backup alpine tar xzf /backup/postgres_backup.tar.gz -C /data
```

### 6. Troubleshooting

**Container não inicia**:
```bash
docker logs <container_name>
docker inspect <container_name>
```

**Problemas de rede**:
```bash
docker network ls
docker network inspect cte_mdfe_api_default
```

**Problemas de espaço**:
```bash
docker system df
docker system prune -a  # Remove tudo não utilizado
```

### 7. Segurança

1. **Portainer**: Sempre defina uma senha forte
2. **Docker Socket**: Tenha cuidado ao expor `/var/run/docker.sock`
3. **Redes**: Use redes isoladas para diferentes aplicações
4. **Secrets**: Use Docker secrets para senhas sensíveis

### 8. Performance

```bash
# Ver uso de recursos
docker stats --no-stream

# Limitar recursos de um container
# Adicione ao docker-compose.yml:
# deploy:
#   resources:
#     limits:
#       cpus: '0.5'
#       memory: 512M
```

### 9. Logs Centralizados

Para ver todos os logs em um só lugar:
```bash
# Todos os logs
docker-compose logs -f

# Logs de um serviço específico
docker-compose logs -f web

# Últimas 100 linhas
docker-compose logs --tail=100
```

### 10. Aliases Úteis

Adicione ao seu `.bashrc`:
```bash
alias dc='docker-compose'
alias dps='docker ps'
alias dl='docker logs -f'
alias dex='docker exec -it'
alias dclean='docker system prune -a'
```