#!/bin/bash

# Script para tentar corrigir o problema de 404 no frontend Vite.
# Este script DEVE SER EXECUTADO DE DENTRO da pasta 'destack-transport-frontend'.

FRONTEND_DIR_NAME="destack-transport-frontend"
CURRENT_DIR_BASENAME=$(basename "$PWD")

if [ "$CURRENT_DIR_BASENAME" != "$FRONTEND_DIR_NAME" ]; then
  echo "❌ ERRO: Este script deve ser executado de DENTRO da pasta '$FRONTEND_DIR_NAME'."
  echo "   Por favor, navegue até './$FRONTEND_DIR_NAME' e execute o script:"
  echo "   cd $FRONTEND_DIR_NAME && sh ../fix-vite-entry.sh  (ou o caminho correto para o script)"
  exit 1
fi

echo "🚀 Tentando corrigir a configuração de entrada do Vite na pasta '$PWD'..."
echo ""

# 1. Remover o index.html da pasta public, se existir, para usar o da raiz.
if [ -f "public/index.html" ]; then
    echo "🗑️ Removendo 'public/index.html' existente..."
    rm -f "public/index.html"
    echo "✅ 'public/index.html' removido."
fi
echo ""

# 2. Criar/Sobrescrever 'index.html' na raiz do projeto frontend.
echo "📄 Criando/Atualizando 'index.html' na raiz do projeto ($PWD/index.html)..."
cat > index.html << 'EOF'
<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8">
    <link rel="icon" href="/favicon.ico">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Destack Transport</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.js"></script>
  </body>
</html>
EOF
echo "✅ 'index.html' criado/atualizado na raiz do projeto."
echo ""

# 3. Garantir que 'public/favicon.ico' exista para o link no index.html
#    (O script anterior, setup-frontend.sh, não criava um favicon).
if [ ! -f "public/favicon.ico" ]; then
    echo "⚠️ 'public/favicon.ico' não encontrado. Criando um placeholder..."
    mkdir -p public # Garante que a pasta public existe
    # Criar um SVG placeholder simples para o favicon
    cat > public/favicon.ico << 'EOF_FAVICON'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><text x="0" y="14" font-size="14">DT</text></svg>
EOF_FAVICON
    echo "✅ Placeholder 'public/favicon.ico' criado."
else
    echo "✅ 'public/favicon.ico' já existe."
fi
echo ""

# 4. Verificar arquivos essenciais criados pelo script setup-frontend.sh
echo "🔎 Verificando arquivos essenciais..."
FILES_TO_CHECK=("src/main.js" "src/App.vue" "vite.config.js" "package.json")
ALL_FILES_EXIST=true

for FILE_PATH in "${FILES_TO_CHECK[@]}"; do
    if [ ! -f "$FILE_PATH" ]; then
        echo "❌ ERRO: Arquivo essencial '$FILE_PATH' não encontrado."
        echo "   Por favor, execute o script 'setup-frontend.sh' completo primeiro para criar toda a estrutura."
        ALL_FILES_EXIST=false
    else
        echo "✅ Arquivo '$FILE_PATH' encontrado."
    fi
done

if [ "$ALL_FILES_EXIST" = false ]; then
    exit 1
fi
echo ""

echo "🎉 Script de correção concluído."
echo "‼️ IMPORTANTE: Pare o servidor de desenvolvimento Vite (Ctrl+C) se estiver rodando."
echo "   Depois, execute novamente no terminal (dentro da pasta '$FRONTEND_DIR_NAME'):"
echo "   npm run dev"
echo ""
echo "Após reiniciar o servidor, tente acessar http://localhost:8081/ novamente no seu navegador."
echo "Se o problema da página em branco ou 404 persistir, verifique o console do navegador (F12) e o terminal do Vite para mais mensagens de erro."