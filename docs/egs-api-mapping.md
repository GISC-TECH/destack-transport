# Mapeamento da API interna do EGS Sistemas

Levantado em 2026-10-14 por engenharia reversa do front AngularJS
(`https://app.egssistemas.com.br`, bundles `appCore.min.js`, `appCtrl.min.js`,
`app/constant/producao.min.js`) e validado com chamadas reais contra producao
usando as credenciais do `.env.local`. Objetivo: substituir o scraper Selenium
(`scraper/egs_client.py`, `scraper/download_xmls.py`) por um cliente HTTP
(`scraper/egs_api_client.py`).

Legenda: **[OK]** validado em producao; **[JS]** confirmado no bundle mas nao
executado; **[?]** inferido.

## 1. Topologia

| Host | Papel |
|------|-------|
| `https://api.egssistemas.com.br/EGSWEB/` | `baseUrlApi` (constante do bundle). Usado so para descobrir o tenant. |
| `https://api.egssistemas.com.br/EGSAPP3/` | `URLAPI` do tenant Destack (chave 57226). Token, `api/*` e `odata/*`. |
| `https://odata.egssistemas.com.br` | "novo OData", usado so quando `usaNovoOdata=true` na sessao. Para a Destack vem `false`. |
| `https://signalr.egssistemas.com.br` | SignalR (notificacoes). Nao e necessario. |

Cabecalhos que o front manda em toda chamada e que o cliente deve copiar:
`User-Agent` de navegador, `X-User-Agent` (interceptor `$http`),
`Accept: application/json, text/plain, */*`. Sem `User-Agent` de navegador a
Cloudflare devolve 403 na descoberta.

## 2. Autenticacao

### 2.1 Descobrir tenant e auxtoken [OK]

```
GET https://api.egssistemas.com.br/EGSWEB/api/Sistema/GetServerUrlByChaveAcessoV1?CHAVEACESSO=57226&EGSERP=true
-> {"URLAPI":"https://api.egssistemas.com.br/EGSAPP3/","AUXTOKEN":"<base64 '57226|<utc>|<assinatura>'>"}
```

Evidencia: `loginCtrl.ot()` chama `egsAuth.getBaseUrlFromDefaultApi(CHAVEACESSO)`
e guarda `URLAPI` em `$sessionStorage.baseUrlApi` e `AUXTOKEN` em `auxtokenApi`.
O auxtoken e obrigatorio no login (`oauthError: Auxtoken inválido!` sem ele).

### 2.2 Token OAuth2 (password grant) [OK]

```
POST {URLAPI}token
Authorization: Basic base64("57226:eg$ystem")        # chaveAcesso:clientSecret
Content-Type: application/x-www-form-urlencoded

grant_type=password&username=DESTACK&password=***&auxtoken=<AUXTOKEN>
-> {"access_token":"<opaco, ~600 chars>","token_type":"bearer","expires_in":86399}
```

Evidencia (`egsAuth.login`):
```js
y=l(e)  // l(n){return i.encode(n+":"+e)}  e="eg$ystem" (constant clientSecret)
w=t({grant_type:"password",username:i,password:f,captcha:o,auxtoken:p,codigo2fa:s})
n({method:"POST",url:h.getUrlBase()+"token",data:w,headers:{"Content-Type":"application/x-www-form-urlencoded",Authorization:"Basic "+y}})
```

- `captcha` e `codigo2fa` sao `undefined` no fluxo normal e o serializer os omite.
  Nao enviar string vazia.
- Token nao e JWT (ticket OWIN opaco). Vale 24h. Nao ha cookie de sessao.
- Depois do login, tudo usa `Authorization: Bearer <access_token>`.
- Nao existe logout server-side; o front so limpa o `sessionStorage`. Reusar o
  token em cache evita acumular sessoes.

Erros do `token` (campo `error`, tratados em `loginCtrl.rt`):

| `error` | Significado | Como tratar |
|---------|-------------|-------------|
| `invalid_client` | Basic ausente/errado | revisar chave e secret |
| `oauthError` | `Auxtoken inválido!` etc. | refazer 2.1 (auxtoken expira) |
| `oauthErrorLimiteAcesso` | limite de usuarios simultaneos. `error_description` = `"msg|IDEMPRESA|IDUSUARIO"` | ver 2.4 |
| `oauthGerouCaptcha` / `oauthCaptchaIncorreto` | backend passou a exigir reCAPTCHA (apos falhas) | parar e alertar; nao e automatizavel |
| `oauth2faRequest` | exige codigo 2FA | parar e alertar |
| `oauthRedirect` | redirect externo | nao se aplica |

### 2.3 Sessao do usuario [OK]

```
GET {URLAPI}api/Sistema/GetUserSession      (Bearer)
-> idUsuario, nomeUsuario, empresas[], codEmpresa, usaNovoOdata, menuJson,
   permissaoFormularios, permissaoFuncoes, parametrosSistema, signalrCore, ...
```

Para a Destack: `codEmpresa=1`, `empresas=[{CODIGO:1, IDENT:12216, CNPJ 24.633.774/0001-18}]`,
`usaNovoOdata=false`. Chamada opcional para o scraper (so precisa de `CODEMPRESA` se
algum endpoint exigir).

### 2.4 Conflito de sessao (outro usuario logado) [JS]

O front abre o modal `usuariosLogadosCtrl` quando o `token` devolve
`oauthErrorLimiteAcesso`. Endpoints usados, ambos sem Bearer, com
`Authorization: Basic base64("590196:eg$ystem")` (constante `k` do `egsApi`):

```
GET  {URLAPI}api/Sistema/GetUsuariosLogados?IDEMPRESA=<IDEMPRESA>   -> [{CODUSUARIO, DATACREATE, CODACESSO,...}]
GET  {URLAPI}api/Sistema/GetQtdAcessos?IDEMPRESA=<IDEMPRESA>        -> inteiro   [OK: devolve 0 para IDEMPRESA=1]
POST {URLAPI}api/Sistema/PostDerrubaUsuario  {IDUSUARIO, IDEMPRESA, CODACESSO}
```

Evidencia: `n.disconnect=function(t,i){... let i={IDUSUARIO:n.vm.IDUSUARIO,IDEMPRESA:n.vm.idEmpresa,CODACESSO:t};e.postDerrubaUsuario(i)...`.
O nome exato do campo com o codigo da sessao na lista (`CODACESSO` ou `IDACESSO`) so
sera confirmado quando o erro acontecer; o cliente tenta os dois.

Colunas do modal de sessoes (`usuariosLogadosCtrl`): `CODUSUARIO`, `DATACREATE`,
`MINUTOSATIVIDADE`, `DATAHORAMONITOR`, `IP`, mais o codigo da sessao usado como
`CODACESSO`.

Fluxo alternativo, ja autenticado (tela de administracao de usuarios online) [JS]:
`POST api/Global/BuscarUsuariosLogados` e `POST api/sistema/DisconnectUsers`
(array de sessoes). Serve se o conflito aparecer depois do login.

Ha tambem `GET api/Sistema/GetExpirarToken` [OK, 200 vazio], chamado a cada troca
de rota para checar se o token ainda vale (401 => `egsDisconnectHandling`).

Evidencias detalhadas com offsets nos bundles: `docs/egs-api-mapping-codex-evidencias.md`.

## 3. Listagem (OData v4)

Os grids DevExpress usam `DevExpress.data.ODataContext({version:4, url: baseUrlApi+"/odata/"})`
com `beforeSend` injetando o Bearer. Filtro, ordenacao e paginacao sao OData
padrao. Datas no fuso `-03:00`.

### 3.1 CT-e, tela `/cte-tela-xml` (`cteTelaXmlCtrl`, view `VW_CTETELAXML`) [OK]

```
GET {URLAPI}odata/CTeTelaXml?$filter=DATAEMISSAO ge 2026-10-08T00:00:00-03:00&$orderby=DATAEMISSAO desc&$top=200&$skip=0&$count=true
    &$select=IDCTE,NUMCTE,DATAEMISSAO,STATUSNOME,CHAVECTE,DEST_NOME,CODEMPRESA,MODELO
```

Campos: `IDCTE` (chave), `IDEMPRESA`, `CODEMPRESA`, `MODELO` (57), `EMPRESA`,
`NUMCTE`, `DATAEMISSAO`, `STATUSNOME` (`AUTORIZADA`, `CANCELADO`, ...),
`CHAVECTE`, `DEST_NOME`, `CODCFOP`, `TIPOAMB`, `CSTATUS`, `ANO`, `MES`.
Total na base em 2026-10-14: 2485 CT-e.

Colunas visiveis da tela vem de
`GET api/Sistema/GetGridViewConfig?objectName=VW_CTETELAXML&stateName=cte-tela-xml` [OK].

Outras entidades uteis (de `odata/$metadata`): `CTe`, `CTe67`, `CTeCancelamento`,
`CTeCartaCorrecao`, `CTeFinanceiro`, `MDFeDoc`, `EmissaoCteComXml`.

### 3.2 MDF-e, tela `/mdfe` (`mdfeCtrl`, store `MDFe`) [OK]

```
GET {URLAPI}odata/MDFe?$filter=DATAEMISSAO ge 2026-10-08T00:00:00-03:00&$orderby=DATAEMISSAO desc&$top=200&$count=true
    &$select=IDMDFE,NUMMDFE,SERIE,DATAEMISSAO,STATUSNOME,CHAVEMDFE,PLACATRACAO,UFINI,UFFIM
```

Campos: `IDMDFE` (chave), `NUMMDFE`, `SERIE`, `DATAEMISSAO` (com hora),
`STATUSNOME`, `STATUS` (`J` autorizada, `I` cancelada, `K`), `CHAVEMDFE`,
`PLACATRACAO`, `PLACAREBOQUE`, `UFINI`, `UFFIM`, `MUNICIPIOORIG`, `MUNICIPIODEST`,
`NOMECONDUTOR`, `RNTC`, `TOTALVALORCARGA`, `TOTALQTDCARGA`, `QTDCTE`, `QTDNFE`,
`AVERBADO`, `DECLARADO`, `DATACREATE`, `USERCREATE`, `CODEMPRESA`.
Total na base em 2026-10-14: 974 MDF-e.

### 3.3 Portal do contador, tela `/Portal-Contador-xml` [JS]

`portalContadorXmlCtrl` usa `odata/CportalContadorXml` (chave `IDENT`, string) e
`POST api/CportalContadorXmlApi/DownloadXml`. Nao e necessario: as telas acima
ja cobrem CT-e e MDF-e.

## 4. Download de XML

Todos via `egsApi.downloadMethodPost`: `POST` JSON, resposta
`application/octet-stream` com o nome em `x-filename`. Um id devolve o `.xml`;
varios ids devolvem um `.zip` com um `.xml` por documento.

| Documento | Endpoint | Body | Resultado |
|-----------|----------|------|-----------|
| CT-e (tela XML) [OK] | `POST api/CteApi/DownloadExportacaoXml` | `{"IDENTArray":[2373022, ...]}` | `CTe<chave>.xml` ou `CTe_XML_<data>_<hora>.zip` |
| CT-e (tela /cte) [OK] | `POST api/CteApi/DownloadXml` | `{"IDCTE":[2373022, ...]}` | `CTe<chave>.xml` ou `CTe_XML.zip` |
| MDF-e [OK] | `POST api/MDFeApi/DownloadXml` | `{"IDMDFE":[353038, ...]}` **(sempre array)** | `MDFe<chave>.xml` ou `MDFe_XML.zip` |
| MDF-e eventos [JS] | `POST api/MDFeApi/DownloadXmlEvento` | objeto do evento | |
| CT-e cancelamento [JS] | `POST api/CteApi/DownloadCancelamentoXml` | `{"IDENTArray":[...]}` | |
| CT-e carta de correcao [JS] | `POST api/CteCartaCorrecaoApi/DownloadXml` | `{"IDENTArray":[...]}` | |

Observacoes:
- `MDFeApi/DownloadXml` com `IDMDFE` escalar, string ou outro nome de campo
  devolve 400 "Referência de objeto não definida".
- O XML do CT-e vem como `<cteProc versao="4.00">` completo (com `protCTe`).
  O do MDF-e como `<mdfeProc>`.
- O front limita a 150 ids por requisicao (`TAMANHO_LOTE`) e divide em lotes
  via `commonDownloadCtrl`. Manter esse teto.

## 5. Fluxo implementado no scraper (modo `EGS_MODE=api`)

Arquivos: `scraper/egs_api_client.py` (cliente), `scraper/egs_relay.py` (adapter
para o Worker Cloudflare), `scraper/daily_download_api.py` (orquestrador),
`scraper/xml_upload.py` (upload compartilhado com o modo Selenium),
`scraper/Dockerfile.api` + `requirements-api.txt` (imagem sem Chrome, ~240MB).
`scheduler.py` escolhe o orquestrador por `EGS_MODE` (`api` padrao, `selenium` legado).

Validacao ponta a ponta em 2026-10-14 contra o Destack local: 2 dias de lookback,
30 CT-e (3 cancelados, cada um com `_Canc.xml`) e 21 MDF-e baixados e enviados,
0 falhas, 11 s na segunda execucao com tudo ja existente.

Limitacao conhecida: `MDFeApi/DownloadXml` nunca inclui evento de cancelamento ou
encerramento (MDF-e cancelado vem como `<MDFe>` cru). O modo Selenium tinha a mesma
limitacao. `DownloadXmlEvento` existe mas exige o objeto do evento de
`GetMDFeEventos?IDMDFE=`; fica como evolucao.

### Fluxo original proposto

1. `GetServerUrlByChaveAcessoV1` -> `URLAPI`, `AUXTOKEN`.
2. `POST token`; guardar `access_token` em `data/egs_token.json` (0600) e reusar
   por ate 20h. Em 401 em qualquer chamada, relogar uma vez.
3. `odata/CTeTelaXml` e `odata/MDFe` com `$filter` por `DATAEMISSAO` nos ultimos
   `DAYS_LOOKBACK` dias, paginando com `$top/$skip`.
4. Comparar `CHAVECTE`/`CHAVEMDFE` com `data/processed_xmls.json`.
5. Baixar em lotes de ate 150 ids, descompactar o zip em memoria, salvar os `.xml`
   e seguir com `upload_xmls.py` como hoje.

Implementacao de referencia: `scraper/egs_api_client.py` (`python egs_api_client.py 7`).
Smoke test em 2026-10-14 (7 dias): login ok, 76 CT-e e 55 MDF-e listados, XML de
CT-e e de MDF-e baixados e descompactados do zip.

## 6. Riscos

- Bloqueio de IP continua valendo (Contabo bloqueada). Em producao o cliente sai
  pelo mesmo proxy HTTP com saida BR que o Chrome usa (`EGS_HTTP_PROXY`), validado
  em 2026-10-14 ate a etapa de autenticacao. O relay Cloudflare em
  `scraper/cloudflare-egs-relay/` NAO serve: o `token` recusa a saida dos Workers
  com "Seu usuário não tem acesso liberado para IP de fora do Brasil!".
- Licencas: a empresa tem 2 usuarios simultaneos no EGS e eles costumam estar
  ocupados por pessoas (ex. LINDA, LUANNA). Ao bater no limite o coletor derruba
  UMA sessao, a mais ociosa (`EGS_DERRUBAR_SESSAO=false` desliga). O coletor
  Selenium ja fazia isso a cada execucao; o modo api reusa o token por 20h e
  so precisa de vaga quando renova o login.
- API nao documentada; pode mudar sem aviso. Manter um smoke test de login +
  `$top=1` nas duas entidades.
- reCAPTCHA e 2FA sao acionados pelo backend apos falhas de login. Nunca
  insistir em login com senha errada.
- Nao existe logout; cada `POST token` cria uma sessao no EGS. Sempre reusar o
  token em cache.
