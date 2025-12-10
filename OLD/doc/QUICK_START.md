# 🚀 DESTACK - Quick Start Local

## Para Windows

### 1. Instale o Docker Desktop
- Download: https://www.docker.com/products/docker-desktop
- Instale e inicie o Docker Desktop

### 2. Abra o PowerShell ou CMD na pasta do projeto

```powershell
cd destack
```

### 3. Execute o script de início

**PowerShell:**
```powershell
bash scripts/start-local.sh
```

**Git Bash (recomendado):**
```bash
./scripts/start-local.sh
```

### 4. Acesse a aplicação

Aguarde 1-2 minutos e acesse:
- 🌐 http://localhost:8001
- 👤 Login: `admin` / `admin123`

---

## Para Mac/Linux

### 1. Instale o Docker

**Mac:**
- Download: https://www.docker.com/products/docker-desktop

**Linux (Ubuntu/Debian):**
```bash
sudo apt-get update
sudo apt-get install docker.io docker-compose
sudo systemctl start docker
sudo usermod -aG docker $USER
# Faça logout e login novamente
```

### 2. Execute o script de início

```bash
cd destack
./scripts/start-local.sh
```

### 3. Acesse a aplicação

- 🌐 http://localhost:8001
- 👤 Login: `admin` / `admin123`

---

## 📦 Restaurar Backup de Produção

Se você tem um backup do banco (.dump file na pasta `backups/`):

```bash
./scripts/restore-backup.sh
```

---

## 🛑 Parar o Ambiente

```bash
./scripts/stop-local.sh
```

---

## 📋 Comandos Úteis

```bash
# Ver logs
./scripts/logs-local.sh

# Parar tudo
./scripts/stop-local.sh

# Django shell
./scripts/shell-local.sh

# Executar manage.py
./scripts/manage-local.sh <comando>
```

---

## ❓ Problemas?

Veja a documentação completa em: **README_LOCAL.md**
