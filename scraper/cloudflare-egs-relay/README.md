# Repasse EGS pela Cloudflare

**Validação de 14/10/2026: esta rota não passou na autenticação do EGS e foi
retirada do Compose de produção.** A saída pública mediu país `BR` e datacenter
`GRU`, mas o endpoint `token` retornou HTTP 400 com `oauthError`:
"Seu usuário não tem acesso liberado para IP de fora do Brasil!".
A API do EGS também usa Cloudflare. Em subrequisições entre zonas, a Cloudflare
apresenta um IP especial de Workers ao destino; estar na região de São Paulo
não garante que o EGS reconheça a conexão como brasileira.
Veja a [documentação de CF-Connecting-IP](https://developers.cloudflare.com/fundamentals/reference/http-headers/#cf-connecting-ip-in-worker-subrequests).
O scraper foi devolvido à conexão brasileira anterior. Não ativar esta rota
como substituta sem validar novamente o login e a coleta completos.

No experimento, o Chrome usou o proxy HTTP privado `destack_egs_worker_proxy:8080`.
O adaptador encaminha apenas as requisições para `app.egssistemas.com.br` e
`api.egssistemas.com.br` ao Worker `destack-egs-relay`, disponível em
`egs-relay.destacktransporte.com`.
O Worker tem posicionamento `aws:sa-east-1`, próximo da região de São Paulo.
O país de saída e a disponibilidade do EGS são verificados em tempo de execução;
o posicionamento não constitui garantia de IP fixo ou de um datacenter permanente.

## Restrições

- O Worker aceita apenas o IP público IPv4 da Contabo, `207.180.255.150`.
- O destino é limitado aos hosts app e api da EGS. `X-Relay-Host` seleciona o host;
  sua ausência mantém o app como padrão. URLs e redirecionamentos não permitem outros destinos.
- Cookies, status HTTP, múltiplos `Set-Cookie` e downloads binários são preservados.
- Não há credenciais do EGS armazenadas no código, nos bindings ou nos logs do Worker.
- O registro automático das invocações fica desativado. O código não registra corpos ou cabeçalhos.
- A ponte não publica portas no host; fica na rede Docker da Destack, sem privilégios de rede adicionais.
- A conexão da ponte ao Worker valida TLS. A ponte termina o TLS do Chrome internamente
  e reutiliza a configuração de certificados já existente no scraper; não instala certificados no Mac.
- Os serviços de site, API, banco, filas e mídia mantêm seus destinos e configurações.

## Testes locais

```sh
node --test worker.test.js
python3 -m unittest -v test_bridge_protocol.py
npx wrangler deploy --dry-run --outdir dist
```

`wrangler.jsonc` registra a conta, o domínio personalizado e o posicionamento.
Publicar pelo CLI exige autorização de escrita em Workers nessa conta; a
autorização antiga de leitura não permite publicar. Também é possível usar o painel.

## Cliente HTTP sem Chrome

`bridge_protocol.relay_request(method, url, headers, body)` usa somente urllib
e retorna `(status, headers_pairs, body)`. Os pares de headers são bytes,
assim como o corpo; múltiplos `Set-Cookie` e downloads binários são preservados.
`headers` aceita um mapping ou uma lista de pares; `body` aceita bytes ou `None`.
`EGS_WORKER_URL` seleciona a origem HTTPS do Worker, com o mesmo padrão do addon.
Erros HTTP do upstream são retornados; rejeições do Worker geram `ValueError`.
Os diagnósticos continuam verificando `/login` no host app.

## Estado de implantação

O Worker permanece publicado no domínio acima, restrito à Contabo. A ponte
experimental e o ponto de entrada alternativo do scraper foram removidos do
Compose de produção após a rejeição autenticada. Os arquivos deste diretório
preservam a implementação e seus testes; não representam uma rota EGS operacional.

## Verificação e retorno

`http://destack_egs_worker_proxy:8080/__relay_health` retorna o país, IP de saída,
datacenter observado, status público do EGS e contadores sem dados de requisições.
O healthcheck da ponte só aceita país `BR` com HTTP 200 na página pública de login.
Isso verifica conectividade; **não comprova autenticação nem coleta**.

Antes de qualquer nova ativação, verificar um ciclo real de login, download e envio
à API, além do site e dos demais containers. O experimento de 14/10/2026 mantém a
configuração anterior e o cache de downloads em
`/root/apps/destack/maintenance/worker-relay-20261014/rollback/`.
O retorno restaurou o Compose anterior, recriou somente o scraper e copiou o cache
verificado antes de iniciá-lo. O `.env` compartilhado permanece inalterado.
`authenticated-worker-result.json` registra a rejeição sem credenciais;
`failed-worker-compose.yml` preserva a configuração experimental na mesma pasta.
