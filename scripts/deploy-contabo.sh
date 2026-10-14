#!/usr/bin/env bash
set -euo pipefail

echo "Este fluxo foi substituido pelo deploy de artefato versionado." >&2
echo "Execute, a partir da estacao de desenvolvimento:" >&2
echo "  PROD_SSH=root@servidor VERSION=vX.Y.Z SSH_KEY=/caminho/chave ./scripts/deploy-producao.sh" >&2
exit 2
