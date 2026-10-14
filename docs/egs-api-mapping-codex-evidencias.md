> Relatorio gerado pelo agente Codex (analise estatica dos bundles, sem requisicoes).
> Atencao: as URLs abaixo usam a base `EGSWEB/`; em execucao a base correta e a `URLAPI` devolvida
> por `GetServerUrlByChaveAcessoV1` (`EGSAPP3/` para a Destack). O resumo validado esta em `egs-api-mapping.md`.

# API interna EGS — engenharia reversa estática

Data da análise: 2026-10-14. Escopo: bundles locais indicados; nenhuma requisição à EGS, login, consulta de dados, encerramento de sessão ou alteração no repositório. O único artefato criado é este relatório.

**Confirmado no código** significa que o front constrói/consome esse contrato; não significa que o servidor foi testado. **Inferido** identifica extrapolação para um cliente HTTP. **Não determinado** identifica algo que depende de resposta, template ou biblioteca não incluída.

## Fontes e rastreabilidade

Diretório: `/private/tmp/claude-501/-Users-italocosta-workspace-projects-destack-transport/f20dc49c-df00-4806-afbf-5d260e3d4813/scratchpad/egs_static/`

| Fonte | Bytes | SHA-256 |
|---|---:|---|
| `appCore.min.js` | 720185 | `ad6e300660490d09eaa196bf32546c0c8a223bb193283bdb9637209974f2fb0a` |
| `appCtrl.min.js` | 5210946 | `bd246a88694061be4bb5150845af75cb7de277256afc0bb429a61cea8b862d34` |
| `producao.min.js` | 130 | `b6ffc196c7f44e045510e5eca72fe17d442939d27777a8344860d787228d3508` |
| `index.html` | 27480 | `09959ce0930b2f02567a11e21ed747133e520134c85bbbbb4876f3c1377f37db` |

A leitura usou buscas e recortes com Node, sem despejar os bundles inteiros. As evidências abaixo têm até três linhas por bloco.

## Convenção de URLs: descoberta obrigatória e barras

`B` é a base retornada em `URLAPI` pela descoberta de servidor; o fallback é `https://api.egssistemas.com.br/EGSWEB/`. `buscaUrlBase=true` está no bundle de produção, e o controller de login chama a descoberta antes de `egsAuth.login`. Logo, a URL efetiva após a descoberta pode ter outro host/caminho.

As URLs completas abaixo usam a base de produção e uma barra entre segmentos para facilitar leitura. **A concatenação literal frequentemente usa `B + "/api/..."` ou `B + "/odata/..."`; com a base terminando em `/`, produz `/EGSWEB//api/...` ou `/EGSWEB//odata/...`.** Esse comportamento está confirmado no código; aceitar ou normalizar a barra dupla no servidor não foi testado. O login usa `B + "token"`, sem barra inicial. Para reproduzir fielmente, preserve as fórmulas indicadas.

Evidência: `producao.min.js`, offset de caracteres UTF-16 37 (base zero; recorte literal).

```js
.constant("baseUrlApi","https://api.egssistemas.com.br/EGSWEB/").constant("buscaUrlBase",!0);
```

Evidência: `appCore.min.js`, offset de caracteres UTF-16 204897 (base zero; recorte literal).

```js
function l(){return i.baseUrlApi?i.baseUrlApi:s}
```

Evidência: `appCtrl.min.js`, offset de caracteres UTF-16 37618 (base zero; recorte literal).

```js
function ot(){let i=t.defer(),u=function(n){i.reject(n)},f=function(n){r.baseUrlApi=n.data.URLAPI;r.auxtokenApi=n.data.AUXTOKEN;i.resolve()};return o.getBaseUrlFromDefaultApi(n.CHAVEACESSO).then(f,u),i.promise}
```

## 1. Login `/login`

Controller: `loginCtrl`; template: `Views/login.html`. Não confundir com `loginSuporteCtrl`, login externo, portal ou PDV, que usam outros grants.

Evidência: `appCore.min.js`, offset de caracteres UTF-16 562462 (base zero; recorte literal).

```js
t.state("login",{url:"/login",controller:"loginCtrl",templateUrl:"Views/login.html"})
```

### 1.1 Descoberta do servidor

**GET** `https://api.egssistemas.com.br/EGSWEB/api/Sistema/GetServerUrlByChaveAcessoV1?CHAVEACESSO={chave}&EGSERP=true`

Sem body. Query: `CHAVEACESSO` e `EGSERP=true`. Base fixa da constante de produção, não a base já descoberta. O controller lê `response.data.URLAPI` e `response.data.AUXTOKEN`, armazenando-os em `$sessionStorage.baseUrlApi` e `.auxtokenApi`. **Confirmado no código.**

Evidência: `appCore.min.js`, offset de caracteres UTF-16 61437 (base zero; recorte literal).

```js
function a(t){return n.get(f+"api/Sistema/GetServerUrlByChaveAcessoV1?CHAVEACESSO="+t+"&EGSERP=true")}
```

### 1.2 Autenticação

**POST** `https://api.egssistemas.com.br/EGSWEB/token`

URL efetiva: `B + "token"`. Body **form URL-encoded**, serializado por `$httpParamSerializerJQLike`, com os campos:

| Campo | Origem/valor |
|---|---|
| `grant_type` | `password` |
| `username` | `$scope.LOGIN` |
| `password` | `$scope.SENHA` |
| `captcha` | `$scope.RECAPTCHA`, quando definido |
| `auxtoken` | `AUXTOKEN` da descoberta, quando definido |
| `codigo2fa` | `$scope.CODIGO2FA`, quando definido |

Headers: `Content-Type: application/x-www-form-urlencoded`; `Authorization: Basic base64(CHAVEACESSO + ":" + clientSecret)`; `X-User-Agent` pelo interceptor Angular. O `clientSecret` literal embarcado em `appCore.min.js` é `eg$ystem`; trata-se de uma constante distribuída pelo próprio front, não de uma credencial de usuário obtida nesta análise.

**Confirmado:** a chave de acesso não é enviada como `chave`/`chaveAcesso` no body deste login: vai na descoberta e no header Basic. `withCredentials:true` é explicitado. Ausência de campo opcional no wire quando seu valor é `undefined` depende do serializer Angular, não incluído nestes bundles; envie os opcionais apenas quando disponíveis e faça URL-encoding de todos os valores.

Evidência: `appCore.min.js`, offset de caracteres UTF-16 61539 (base zero; recorte literal).

```js
function v(i,f,e,o,s){h.clearSessionLogin();let c=r.defer(),a=function(n){c.reject(n)},v=function(n){let t=n.data.access_token,r=h.buildSession(i,e,t);c.resolve(r)},y=l(e),p=u.auxtokenApi,w=t({grant_type:"password",username:i,password:f,captcha:o,auxtoken:p,codigo2fa:s});return n({method:"POST",url:h.getUrlBase()+"token",data:w,headers:{"Content-Type":"application/x-www-form-urlencoded",Authorization:"Basic "+y},withCredentials:!0}).then(v,a),c.promise}
```

Evidência: `appCore.min.js`, offset de caracteres UTF-16 62977 (base zero; recorte literal).

```js
function l(n){return n||(n=h.getSession().chaveAcesso),i.encode(n+":"+e)}
```

Evidência: `appCtrl.min.js`, offset de caracteres UTF-16 41048 (base zero; recorte literal).

```js
o.login(n.LOGIN,n.SENHA,n.CHAVEACESSO,n.RECAPTCHA,n.CODIGO2FA).then(tt,rt)
```

Evidência: `appCore.min.js`, offset de caracteres UTF-16 7939 (base zero; recorte literal).

```js
.constant("clientSecret","eg$ystem")
```

**Resposta consumida:** `data.access_token`. O front passa esse valor a `buildSession`, depois guarda `egsSession.token` em `$sessionStorage`. **JWT não determinado:** não há decodificação/validação de estrutura JWT neste fluxo. OAuth-style `grant_type=password` e Bearer estão confirmados; JWT é apenas uma hipótese. O código não comprova `refresh_token`, expiração ou o schema completo da resposta.

**Cookie não determinado:** `withCredentials:true` permite cookies/credenciais no request, mas os bundles não mostram `Set-Cookie` da resposta nem um cookie de autenticação obrigatório. Requisições REST seguintes recebem Bearer. Não foi identificado refresh automático de token; o interceptor trata 401 emitindo `egsTokenExpirado`.

Evidência: `appCore.min.js`, offset de caracteres UTF-16 206107 (base zero; recorte literal).

```js
t.IDACESSO=n.data.IDACESSO,t.userName=s,t.idUsuario=n.data.idUsuario,t.nomeUsuario=y,t.chaveAcesso=h,t.token=a,
```

### 1.3 Construção da sessão após autenticação

**GET** `https://api.egssistemas.com.br/EGSWEB/api/Sistema/GetUserSession`

URL literal: `B + "/api/Sistema/GetUserSession"`. Sem query/body. Header explícito `Authorization: Bearer {access_token}`. **Confirmado.**

O front consome `nomeUsuario`, `idUsuario`, `empresas`, `codEmpresa`, `IDACESSO`, `menuJson`, `parametrosSistema`, permissões, `alteraSenha`, `usaNovoOdata`, `signalrCore` e outros dados. Seleciona uma empresa cujo `CODIGO==codEmpresa`, ou a primeira. Ausência de empresas/menu utilizáveis pode reprovar a criação de sessão. O nome retornado `codEmpresa` não autoriza assumir um header `empresa`.

Evidência: `appCore.min.js`, offset de caracteres UTF-16 207401 (base zero; recorte literal).

```js
return n.get(l()+"/api/Sistema/GetUserSession",{headers:{Authorization:"Bearer "+a}}).then(p,y),v.promise}
```

### 1.4 reCAPTCHA e 2FA condicionais

**Confirmado:** `gerouCaptcha` começa em `false`. `setCaptchaResponse` guarda o token em `RECAPTCHA`; expiração o apaga. `egsAuth.login` inclui esse valor no campo **`captcha`**, não em `g-recaptcha-response`. `oauthGerouCaptcha` ativa `gerouCaptcha`; nova falha de geração pode recarregar a página. `oauthCaptchaIncorreto` recarrega. `oauth2faRequest` ativa a entrada 2FA e o código vai em `codigo2fa` ao repetir login.

O controller confirma a condicionalidade por resposta do backend; o template `Views/login.html` não foi fornecido, portanto tipo/versão/site-key do widget e condição exata de renderização não são determinados. `index.html` inclui `angular-recaptcha`. Um cliente HTTP precisa tratar o desafio quando exigido; não há evidência de que todos os logins exijam captcha.

Evidência: `appCtrl.min.js`, offset de caracteres UTF-16 40714 (base zero; recorte literal).

```js
n.gerouCaptcha=!1;n.setCaptchaResponse=function(t){n.RECAPTCHA=t};n.setCaptchaExpiration=function(){delete n.RECAPTCHA};
```

Evidência: `appCtrl.min.js`, offset de caracteres UTF-16 35818 (base zero; recorte literal).

```js
if(t.data.error=="oauth2faRequest"){n.gerou2fa=!0;i(function(){$("#codigo2fa").focus()},100);r.indexOf("não foi informado")==-1&&e.alert(r);return}if(t.data.error=="oauthGerouCaptcha"){if(n.gerouCaptcha){e.alert(r,function(){window.location.reload()});return}n.gerou2fa&&e.alert(r);n.gerouCaptcha=!0;return}if(t.data.error=="oauthCaptchaIncorreto"){window.location.reload();return}
```

## 2. Sessões concorrentes e desconexão

O erro de login `oauthErrorLimiteAcesso` contém `error_description` separado por `|`: mensagem, `IDEMPRESA`, `IDUSUARIO`. O controller abre `usuariosLogadosCtrl`. **Confirmado:** trata limite de acessos; não prova que todo texto “usuário já conectado” use o mesmo código de erro.

Evidência: `appCtrl.min.js`, offset de caracteres UTF-16 36199 (base zero; recorte literal).

```js
if(t.data.error=="oauthErrorLimiteAcesso"){let n=t.data.error_description,r=n.split("|")[0],i=n.split("|")[1],u=n.split("|")[2];b.getUsuariosLogados(i).then(function(n){e.alert(r,function(){k.openCommon({controller:"usuariosLogadosCtrl",templateUrl:"Views/usuariosLogados.html",size:"lg",resolve:{modal:{id:i,IDUSUARIO:u,vm:n}}})})});return}
```

### 2.1 Listar sessões no conflito de login

**GET** `https://api.egssistemas.com.br/EGSWEB/api/Sistema/GetUsuariosLogados?IDEMPRESA={idEmpresa}`

URL literal: `B + "/api/Sistema/GetUsuariosLogados?IDEMPRESA=" + idEmpresa`. Sem body. Usa `egsApi.getNoAuth`: Basic fixo do wrapper `base64("590196:eg$ystem")`, `withCredentials:true`; não o Bearer do usuário ainda sem sessão. **Confirmado.**

A tabela usa `CODUSUARIO`, `DATACREATE`, `MINUTOSATIVIDADE`, `DATAHORAMONITOR` e `IP`. O nome sugere sessões, mas o schema completo e o vínculo do identificador de ação na coluna dependem também do template ausente.

Evidência: `appCore.min.js`, offset de caracteres UTF-16 220529 (base zero; recorte literal).

```js
function w(n){let i="/api/Sistema/GetUsuariosLogados?IDEMPRESA="+n;return t.getNoAuth(i)}
```

Evidência: `appCore.min.js`, offset de caracteres UTF-16 10596 (base zero; recorte literal).

```js
function ht(i){var r=t.defer();let u=function(n){r.resolve(n.data);o.close()},f=function(n){r.reject(n);o.close()};return o.open(),n.get(e.getUrlBase()+i,{headers:{Authorization:"Basic "+k},withCredentials:!0}).then(u,f),r.promise}
```

Evidência: `appCore.min.js`, offset de caracteres UTF-16 52236 (base zero; recorte literal).

```js
var k=i.encode("590196:eg$ystem")
```

### 2.2 Consultar limite/quantidade de acessos

**GET** `https://api.egssistemas.com.br/EGSWEB/api/Sistema/GetQtdAcessos?IDEMPRESA={idEmpresa}`

Sem body. URL literal `B + "/api/Sistema/GetQtdAcessos?IDEMPRESA=" + idEmpresa`. Mesmo Basic fixo/`withCredentials:true` de `getNoAuth`. A resposta é atribuída a `vm.QTDACESSOS`. **Confirmado.**

Evidência: `appCore.min.js`, offset de caracteres UTF-16 220618 (base zero; recorte literal).

```js
function b(n){let i="/api/Sistema/GetQtdAcessos?IDEMPRESA="+n;return t.getNoAuth(i)}
```

### 2.3 Encerrar sessão pelo modal de conflito

**POST** `https://api.egssistemas.com.br/EGSWEB/api/Sistema/PostDerrubaUsuario`

URL literal `B + "/api/Sistema/PostDerrubaUsuario"`. Body JSON: `{"IDUSUARIO": <idUsuarioDoErro>, "IDEMPRESA": <idEmpresaDoErro>, "CODACESSO": <idSelecionado>}`. Usa `postNoAuth`, Basic fixo e `withCredentials:true`. Após sucesso, recarrega a lista. **Confirmado.**

O controller recebe o `CODACESSO` como argumento `t` de `disconnect(t,i)`; o template ausente impede confirmar qual propriedade da linha preenche esse argumento. Não executar encerramento automaticamente: este levantamento não encerrou nenhuma sessão.

Evidência: `appCore.min.js`, offset de caracteres UTF-16 220702 (base zero; recorte literal).

```js
function k(n){return t.postNoAuth("/api/Sistema/PostDerrubaUsuario",n)}
```

Evidência: `appCore.min.js`, offset de caracteres UTF-16 12234 (base zero; recorte literal).

```js
function yt(i,r){var u=t.defer();let f=function(n){u.resolve(n.data);o.close()},s=function(n){u.reject(n);o.close()};return o.open(),n.post(e.getUrlBase()+i,r,{headers:{Authorization:"Basic "+k},withCredentials:!0}).then(f,s),u.promise}
```

Evidência: `appCtrl.min.js`, offset de caracteres UTF-16 45568 (base zero; recorte literal).

```js
n.disconnect=function(t,i){t&&o.msg.confirm(`Você deseja desconectar o usuário selecionado "${i}"`,function(){let i={IDUSUARIO:n.vm.IDUSUARIO,IDEMPRESA:n.vm.idEmpresa,CODACESSO:t};e.postDerrubaUsuario(i).then(function(){r.alert("Desconectado!",function(){s()})})})};
```

### 2.4 Segundo fluxo: administração de usuários online

`usuarioOnlineCtrl` é um modal autenticado distinto do conflito durante login. Lista online com `usuarioService.getOnline()` e desconecta uma lista contendo o terceiro argumento da ação (`u`, associado à sessão pela UI). A grid mostra `SESSIONID`; o binding do terceiro argumento está no template não fornecido. **Confirmado o array; inferida a associação do valor a SESSIONID.**

### 2.4.1 Listar usuários online

**GET** `https://api.egssistemas.com.br/EGSWEB/api/GusuarioApi/GetOnline`

URL literal `B + "/api/GusuarioApi/GetOnline"`. Sem body/query; Bearer pelo interceptor. **Confirmado.**

Evidência: `appCtrl.min.js`, offset de caracteres UTF-16 2908934 (base zero; recorte literal).

```js
var t="/api/GusuarioApi"
```

Evidência: `appCtrl.min.js`, offset de caracteres UTF-16 2909327 (base zero; recorte literal).

```js
getOnline:function(){return n.api.get(t+"/GetOnline")}
```

### 2.4.2 Desconectar usuários online

**POST** `https://api.egssistemas.com.br/EGSWEB/api/GusuarioApi/PostDisconnectUser`

URL literal `B + "/api/GusuarioApi/PostDisconnectUser"`. Body JSON: `[<identificador recebido como terceiro argumento da ação>]`; Bearer. **Confirmado.**

Evidência: `appCtrl.min.js`, offset de caracteres UTF-16 2909575 (base zero; recorte literal).

```js
postDisconnectUser:function(i){return n.api.post(t+"/PostDisconnectUser",i)}
```

Evidência: `appCtrl.min.js`, offset de caracteres UTF-16 2923529 (base zero; recorte literal).

```js
n.disconnect=function(n,t,u){u&&i.msg.confirm(`Você deseja desconectar o usuário selecionado "${t}"`,function(){let n=[u];r.postDisconnectUser(n).then(function(){f.alert("Desconectado!",function(){s()})})})};
```

## 3. Grids: OData v4, configuração e autenticação alternativa

As três telas usam `DevExpress.data.ODataContext({version:4,...})`, com filtros, paginação e ordenação remotos habilitados no grid compartilhado. Não usam um `CustomStore` REST com body `skip/take/filter` nesses controllers. A conversão em query OData (`$skip`, `$top`, `$filter`, `$orderby`, possivelmente `$count`, `$select`) é **inferida do adaptador OData v4**, pois a implementação da biblioteca DevExpress não está nos bundles analisados. Page size, consultas auxiliares e query exata não são observáveis sem a biblioteca/estado da grid ou tráfego.

Evidência: `appCore.min.js`, offset de caracteres UTF-16 164116 (base zero; recorte literal).

```js
remoteOperations:{filtering:!0,paging:!0,sorting:!0,groupPaging:!0,grouping:!1,summary:!0}
```

Evidência: `appCore.min.js`, offset de caracteres UTF-16 81343 (base zero; recorte literal).

```js
function at(){return new DevExpress.data.ODataContext({version:4,url:i()+"/odata/",
```

Evidência: `appCore.min.js`, offset de caracteres UTF-16 97759 (base zero; recorte literal).

```js
function ui(){return new DevExpress.data.ODataContext({version:4,url:i()+"/odata/",
```

### 3.1 Duas bases OData e dois tokens

**Caminho antigo:** store em `B + "/odata/"`, com `Authorization: Bearer {egsSession.token}`.

**Caminho novo, condicional:** se `egsSession.usaNovoOdata` for truthy, a URL contiver `/odata/` e existir `signalrCoreData.token`, o `beforeSend` troca o host/base para `https://odata.egssistemas.com.br` preservando tudo a partir de `/odata/`, e usa **`signalrCoreData.token`**, não o access_token inicial. Se falta o token secundário, permanece no caminho antigo. Timeout 180.000 ms em ambos. `beforeSend` DevExpress atribui apenas Authorization; `X-User-Agent` vem do interceptor Angular e não há evidência de que esse interceptor alcance o transporte DevExpress.

Evidência: `appCore.min.js`, offset de caracteres UTF-16 65293 (base zero; recorte literal).

```js
function r(i){if(ut()&&i.url.indexOf("/odata/")!==-1&&n.signalrCoreData&&n.signalrCoreData.token){var r=i.url.substring(i.url.indexOf("/odata/"));i.url=ft+r;i.headers={Authorization:"Bearer "+n.signalrCoreData.token};i.timeout=18e4}else et(i);t.slowRequestDetect()}
```

Evidência: `appCore.min.js`, offset de caracteres UTF-16 98747 (base zero; recorte literal).

```js
var ft="https://odata.egssistemas.com.br"
```

### 3.1.1 Obter o token usado pelo novo OData

**GET** `https://api.egssistemas.com.br/EGSWEB/api/Sistema/GetTokenSignalRCore`

URL literal `B + "/api/Sistema/GetTokenSignalRCore"`. Sem query/body. Bearer do login pelo interceptor. Resposta consumida: `token` e `url`; guardados em `signalrCoreData`. **Confirmado.**

O front reutiliza o token em cache se a data de criação tem até uma hora (política local, não validade criptográfica comprovada). `url` serve ao SignalR; o host do novo OData é a constante própria. SignalR antigo conecta em `B + "/signalr"`, com query `access_token`; não é endpoint de download XML. Necessidade de manter uma conexão SignalR para a vida útil de um cliente HTTP não é determinada.

Evidência: `appCore.min.js`, offset de caracteres UTF-16 213905 (base zero; recorte literal).

```js
function f(){var i=n.defer();let u=function(n){i.resolve(n.data)},f=function(n){i.reject(n)};return t.get(r.getUrlBase()+"/api/Sistema/GetTokenSignalRCore").then(u,f),i.promise}
```

### 3.2 Configuração de colunas/estado das telas

**GET** `https://api.egssistemas.com.br/EGSWEB/api/Sistema/GetGridViewConfig?objectName={objeto}&stateName={rota}`

URL literal `B + "/api/Sistema/GetGridViewConfig?..."`. Sem body; Bearer. Pares confirmados:

| Tela | `objectName` | `stateName` |
|---|---|---|
| `/cte-tela-xml` | `VW_CTETELAXML` | `cte-tela-xml` |
| `/Portal-Contador-xml` | `VW_CPORTALCONTADORXML` | `Portal-Contador-xml` |
| `/mdfe` | `VW_MDFE` | `mdfe` |

Retorna `columns` e pode retornar `state`. O estado da grid também é recuperado de `sessionStorage["Grid-" + stateName]`, e filtros são persistidos pelo `egsFilter` no `$localStorage`. Portanto, o filtro de data visível não é necessariamente um intervalo fixo definido no controller.

Evidência: `appCore.min.js`, offset de caracteres UTF-16 16663 (base zero; recorte literal).

```js
function fi(n,t){t||(t=u.current.name);var i="/api/Sistema/GetGridViewConfig?objectName="+n+"&stateName="+t;return h(i)}
```

## 4. `/cte-tela-xml`

Controller `cteTelaXmlCtrl`, store `getContextFiscal().CTeTelaXml`, chave `IDCTE` Int32.

Evidência: `appCtrl.min.js`, offset de caracteres UTF-16 1993717 (base zero; recorte literal).

```js
function c(){i.getGridViewConfig(s).then(function(t){var i=u.getGridOptions(),f=r.getContextFiscal();i.dataSource={store:f.CTeTelaXml};i.columns=t.columns;i=u.setGridStateStoring(i,t);l(s,t.columns);n.gridViewOptions=i})}
```

Evidência: `appCore.min.js`, offset de caracteres UTF-16 82218 (base zero; recorte literal).

```js
CTeTelaXml:{key:"IDCTE",keyType:"Int32"}
```

### 4.1 Listar CT-e na tela XML

**GET** `https://api.egssistemas.com.br/EGSWEB/odata/CTeTelaXml`

URL antiga literal: `B + "/odata/CTeTelaXml"`. Alternativa nova completa: **`https://odata.egssistemas.com.br/odata/CTeTelaXml`**. Sem body. Filtros/paginação/ordenação como query OData (serialização exata inferida, ver seção 3). Bearer principal ou secundário conforme condição.

**Data de emissão:** o controller não fixa `dataInicio`, `dataFim`, `DATAEMISSAO` nem outro campo. `columns` vem de `GetGridViewConfig`. Logo, o nome exato da coluna de emissão de **CTeTelaXml não é determinado** nesses arquivos. `DATAEMISSAO` é um candidato consistente com outras telas fiscais, não uma confirmação deste entity set.

Evidência: `appCtrl.min.js`, offset de caracteres UTF-16 1994081 (base zero; recorte literal).

```js
function h(t){n.egsAppliedFilter=t;u.addFilter(o(),n.egsAppliedFilter.VALOR)}
```

### 4.2 Download acionado nesta tela: exportação de XML

**POST** `https://api.egssistemas.com.br/EGSWEB/api/CteApi/DownloadExportacaoXml`

URL literal `B + "/api/CteApi/DownloadExportacaoXml"`. Body JSON: `{"IDENTArray": [<IDCTE>, ...]}`. Uma seleção individual gera `[id]`; uma seleção múltipla gera lista. Bearer principal. Resposta binária (`arraybuffer`), com `content-type` e `x-filename` lidos do response. **Confirmado no código.**

**Lote confirmado; ZIP não determinado.** Não há extensão `.zip` ou MIME ZIP imposto no wrapper. Este endpoint é o efetivamente usado por `/cte-tela-xml`, apesar de existir outro DownloadXml no serviço.

Evidência: `appCtrl.min.js`, offset de caracteres UTF-16 1994248 (base zero; recorte literal).

```js
n.xml=function(){let t=u.getSelectedRows(o()),n=t.map(function(n){return n.IDCTE});n&&e.downloadExportacaoXml(n)}
```

Evidência: `appCtrl.min.js`, offset de caracteres UTF-16 1866314 (base zero; recorte literal).

```js
var e="/api/CteApi",o=function(){return i.getCodEmpresa()}
```

Evidência: `appCtrl.min.js`, offset de caracteres UTF-16 1882154 (base zero; recorte literal).

```js
downloadExportacaoXml:function(n){let t=e+"/DownloadExportacaoXml",r={IDENTArray:n};i.downloadMethodPost(t,r)}
```

### 4.3 Outro download de CT-e: XML de documentos selecionados

**POST** `https://api.egssistemas.com.br/EGSWEB/api/CteApi/DownloadXml`

URL literal `B + "/api/CteApi/DownloadXml"`. Body JSON: `{"IDCTE": [<id>, ...]}`. Individual via array de um item; lote via vários IDs. Bearer principal, retorno binário pelo mesmo wrapper. **Confirmado em `cteService` e no controller da tela CT-e.**

A tela principal CT-e divide grandes seleções em lotes de **150**, conforme o controller; isso é política do front, não limite comprovado do servidor nem regra confirmada para DownloadExportacaoXml. Tipo XML direto vs ZIP continua dependente da resposta.

Evidência: `appCtrl.min.js`, offset de caracteres UTF-16 1881859 (base zero; recorte literal).

```js
downloadXml:function(n){let t=e+"/DownloadXml",r={IDCTE:n};i.downloadMethodPost(t,r)}
```

Evidência: `appCtrl.min.js`, offset de caracteres UTF-16 1895468 (base zero; recorte literal).

```js
n.configTela.downloadXml=function(){let n=ft();if(n){const t=150;if(n.length<=t){e.downloadXml(n);return}
```

## 5. `/Portal-Contador-xml`

Controller `portalContadorXmlCtrl`, store `getContextContabil().CportalContadorXml`, chave `IDENT` com `keyType:"string"`. A tela agrega documentos; os bundles não definem aqui como distinguir CT-e, MDF-e e outros tipos no schema retornado.

Evidência: `appCtrl.min.js`, offset de caracteres UTF-16 5141741 (base zero; recorte literal).

```js
function e(){t.api.getGridViewConfig(u).then(function(i){var r=t.gridView.getGridOptions(),f=t.context.getContextContabil();r.dataSource={store:f.CportalContadorXml};r.columns=i.columns;r=t.gridView.setGridStateStoring(r,i);o(u,i.columns);n.gridViewOptions=r})}
```

Evidência: `appCore.min.js`, offset de caracteres UTF-16 98272 (base zero; recorte literal).

```js
CportalContadorXml:{key:"IDENT",keyType:"string"}
```

### 5.1 Listar documentos no portal

**GET** `https://api.egssistemas.com.br/EGSWEB/odata/CportalContadorXml`

URL antiga literal `B + "/odata/CportalContadorXml"`. Alternativa nova completa: **`https://odata.egssistemas.com.br/odata/CportalContadorXml`**. Sem body; query OData e token conforme seção 3.

**Data de emissão:** nome exato não determinado, pois as colunas são remotas. O controller aplica o valor do filtro salvo à grid, sem adicionar parâmetros de data próprios. Não é seguro assumir que a coluna de emissão, o discriminador de documento ou o ID desse portal sejam iguais aos de CT-e/MDF-e.

Evidência: `appCtrl.min.js`, offset de caracteres UTF-16 5142159 (base zero; recorte literal).

```js
function f(i){n.egsAppliedFilter=i;t.gridView.addFilter(r(),n.egsAppliedFilter.VALOR)}
```

### 5.2 Download do portal: individual e lote

**POST** `https://api.egssistemas.com.br/EGSWEB/api/CportalContadorXmlApi/DownloadXml`

URL literal `B + "/api/CportalContadorXmlApi/DownloadXml"`. Body JSON: `{"PORTALCONTADORIDS": [<linha completa do grid>, ...]}`. **Confirmado:** o controller passa `getSelectedRows()` sem mapear para `IDENT` ou `IDCTE`. Nome PORTALCONTADORIDS não significa array de IDs escalares. Uma linha selecionada continua sendo array contendo um objeto.

Bearer principal; retorno binário pelo wrapper de downloads. Lote confirmado; ZIP e campos mínimos aceitos por objeto não determinados. Para reproduzir o front, enviar a linha retornada pela listagem; reduzir para `{IDENT:...}` ou IDs escalares exige validação posterior do servidor.

Evidência: `appCtrl.min.js`, offset de caracteres UTF-16 5142343 (base zero; recorte literal).

```js
n.download=function(){let n=t.gridView.getSelectedRows(r());if(n){let t={PORTALCONTADORIDS:n};i.downloadXml(t)}}
```

Evidência: `appCtrl.min.js`, offset de caracteres UTF-16 5141265 (base zero; recorte literal).

```js
let t="/api/CportalContadorXmlApi";return{downloadXml:function(i){n.api.downloadMethodPost(t+"/DownloadXml",i)}
```

## 6. `/mdfe`

Controller `mdfeCtrl`, store `getContextFiscal().MDFe`, chave `IDMDFE` Int32.

Evidência: `appCtrl.min.js`, offset de caracteres UTF-16 2179586 (base zero; recorte literal).

```js
f.api.getGridViewConfig(d).then(function(t){var i=f.gridView.getGridOptions(),e=f.context.getContextFiscal(),r,u;i.dataSource={store:e.MDFe};i.columns=t.columns;
```

Evidência: `appCore.min.js`, offset de caracteres UTF-16 81953 (base zero; recorte literal).

```js
MDFe:{key:"IDMDFE",keyType:"Int32"}
```

### 6.1 Pré-requisito usado pela tela: parâmetro ativo

**GET** `https://api.egssistemas.com.br/EGSWEB/api/MdfeParametrosApi/GetAtivo?CODEMPRESA={codigoEmpresa}`

URL literal `B + "/api/MdfeParametrosApi/GetAtivo?CODEMPRESA=" + getCodEmpresa()`. Sem body; Bearer. `getCodEmpresa()` retorna `egsSession.empresaSelecionada.CODIGO`, não `.IDEMPRESA`. **Confirmado.**

A tela lê o parâmetro ativo antes de montar o grid. Isso não comprova que a listagem HTTP exija esse GET como pré-condição. Não cadastrar/criar parâmetros em um leitor HTTP para imitar a tela.

Evidência: `appCtrl.min.js`, offset de caracteres UTF-16 2847205 (base zero; recorte literal).

```js
var i="/api/MdfeParametrosApi",r=function(){return t.getCodEmpresa()}
```

Evidência: `appCtrl.min.js`, offset de caracteres UTF-16 2847690 (base zero; recorte literal).

```js
getParametroAtivo:function(){return n.api.getWithNoLoading(i+"/GetAtivo?CODEMPRESA="+r())}
```

### 6.2 Listar MDF-e

**GET** `https://api.egssistemas.com.br/EGSWEB/odata/MDFe`

URL antiga literal `B + "/odata/MDFe"`. Alternativa nova completa: **`https://odata.egssistemas.com.br/odata/MDFe`**. Sem body; query OData e token conforme seção 3.

**Data de emissão:** `DATAEMISSAO` aparece explicitamente nas grids/comboboxes de MDF-e do bundle. **Confirmado nessas referências**, mas as colunas do grid principal `/mdfe` vêm de configuração remota; use `GetGridViewConfig(VW_MDFE,mdfe)` para confirmar o mesmo `dataField` no grid principal. Nenhum `dataInicio/dataFim` fixo aparece neste controller.

Evidência: `appCtrl.min.js`, offset de caracteres UTF-16 2173651 (base zero; recorte literal).

```js
{caption:"Numero",dataField:"NUMMDFE"},{caption:"Data Emissão",dataField:"DATAEMISSAO",type:"datetime"}
```

### 6.3 Download XML de MDF-e: individual e lote

**POST** `https://api.egssistemas.com.br/EGSWEB/api/MDFeApi/DownloadXml`

URL literal `B + "/api/MDFeApi/DownloadXml"`. Body JSON: `{"IDMDFE": [<id>, ...]}`; um item para individual, vários para lote. Bearer principal, resposta binária via wrapper. **Confirmado.**

ZIP não determinado. O limite de 100 documentos visível no controller é para **impressão**, não um limite confirmado de download XML.

Evidência: `appCtrl.min.js`, offset de caracteres UTF-16 2165909 (base zero; recorte literal).

```js
var i="/api/MDFeApi",r=function(){return t.api.getCodEmpresa()}
```

Evidência: `appCtrl.min.js`, offset de caracteres UTF-16 2177162 (base zero; recorte literal).

```js
downloadXml:function(n){let r=i+"/DownloadXml",u={IDMDFE:n};t.api.downloadMethodPost(r,u)}
```

Evidência: `appCtrl.min.js`, offset de caracteres UTF-16 2187646 (base zero; recorte literal).

```js
n.downloadXml=function(){let n=f.gridView.getSelectedRows(v());n&&e.downloadXml(n.map(function(n){return n.IDMDFE}))}
```

## 7. Filtros de emissão: contrato conhecido e lacunas

**Confirmado:** todos os três controllers aplicam `egsAppliedFilter.VALOR` a `grid.option("filterValue", valor)`, e as colunas vêm de `GetGridViewConfig`. Os filtros são expressões DevExpress, não payload REST customizado. A operação compartilhada “Neste mês” constrói limites `>=` no primeiro dia às 00:00:00 e `<=` no último dia às 23:59:59 usando `t.dataField` da coluna.

Evidência: `appCore.min.js`, offset de caracteres UTF-16 157481 (base zero; recorte literal).

```js
function s(n,t){n&&n.option("filterValue",t)}
```

Evidência: `appCore.min.js`, offset de caracteres UTF-16 158566 (base zero; recorte literal).

```js
{name:"NesteMes",caption:"Neste mês",dataTypes:["date"],icon:"find",hasValue:!1,calculateFilterExpression:function(n,t){let i=new Date(moment().startOf("month").format("MM/DD/YYYY")+" 00:00:00"),r=new Date(moment().endOf("month").format("MM/DD/YYYY")+" 23:59:59");return[[t.dataField,">=",i],"and",[t.dataField,"<=",r]]}},
```

**Exemplo inferido para cliente HTTP**, depois de confirmar o nome/tipo da coluna de emissão na configuração/schema:

```js
[["DATAEMISSAO", ">=", new Date(inicio)], "and", ["DATAEMISSAO", "<", new Date(fimExclusivo)]]
```

Conversão OData v4 esperada, não captura de tráfego:

```text
?$filter=DATAEMISSAO ge 2026-10-01T00:00:00Z and DATAEMISSAO lt 2026-11-01T00:00:00Z&$skip=0&$top=100&$orderby=DATAEMISSAO asc
```

`Z` é apenas exemplo. O front cria datas no fuso local; não há confirmação do tipo EDM/fuso efetivo desses três campos. Converter meia-noite local para UTC altera o instante. O uso de limite superior exclusivo é uma proposta para o cliente, não o filtro “Neste mês” exato do front. A sintaxe da data (Date vs DateTimeOffset), URL-encoding e disponibilidade de `$count/$select` precisam ser confirmadas com o contrato efetivo do adaptador/servidor. Não copie o exemplo como URL comprovada.

**Lacuna concreta:** estes arquivos não fornecem as respostas de `GetGridViewConfig`, o `$metadata` OData, o estado salvo do navegador ou tráfego das grids. Portanto, não é possível dar honestamente um campo de emissão exato e confirmado para CTeTelaXml/CportalContadorXml. Para MDF-e existe a referência explícita a DATAEMISSAO, com a ressalva acima.

## 8. Headers e download binário

| Caminho | Headers construídos no front |
|---|---|
| Descoberta pela chave | `X-User-Agent` via `$http`; normalmente sem sessão Bearer em primeiro login |
| POST token | `Authorization: Basic ...`, `Content-Type: application/x-www-form-urlencoded`, `X-User-Agent` |
| REST autenticado | `Authorization: Bearer {egsSession.token}`, `X-User-Agent`; body JSON pelos defaults Angular |
| getNoAuth/postNoAuth do conflito | `Authorization: Basic` fixo do wrapper, `X-User-Agent`, `withCredentials:true` |
| OData antigo | `Authorization: Bearer {egsSession.token}` via DevExpress `beforeSend` |
| OData novo | `Authorization: Bearer {signalrCoreData.token}` via DevExpress `beforeSend` |
| GET `$http` | também `If-Modified-Since`, `Cache-Control: no-cache`, `Pragma: no-cache` por defaults |

**Confirmado:** interceptor `oauthHttpInterceptor` registrado em `$httpProvider`. Só anexa Bearer quando há token, não há `impersonatorSession` e o request não possui Authorization. Sempre atribui `X-User-Agent=navigator.userAgent`. Não é `User-Agent` padrão; são headers distintos.

Evidência: `appCore.min.js`, offset de caracteres UTF-16 256288 (base zero; recorte literal).

```js
request:function(n){return i.egsSession&&i.egsSession.token&&!i.egsSession.impersonatorSession&&(n.headers.Authorization||(n.headers.Authorization="Bearer "+i.egsSession.token)),n.headers["X-User-Agent"]=navigator.userAgent,n||t.when(n)}
```

Evidência: `appCore.min.js`, offset de caracteres UTF-16 574215 (base zero; recorte literal).

```js
r.interceptors.push("oauthHttpInterceptor");r.defaults.headers.get||(r.defaults.headers.get={});r.defaults.headers.get["If-Modified-Since"]="Mon, 26 Jul 1997 05:00:00 GMT";r.defaults.headers.get["Cache-Control"]="no-cache";r.defaults.headers.get.Pragma="no-cache"
```

**Não encontrado nos interceptores/wrappers analisados:** header obrigatório de empresa, filial, `chave`, `chaveAcesso`, `X-Empresa`, `X-Filial` ou semelhante. `CODEMPRESA` aparece em query/body de operações específicas; não é acrescentado universalmente pelo interceptor. `IDEMPRESA` do conflito e `empresaSelecionada.CODIGO` são valores distintos.

**Obrigatoriedade do servidor não determinada:** X-User-Agent é sempre enviado pelo front Angular, mas não há prova de rejeição quando ausente. Para paridade em REST, reproduza-o. Não assuma que o interceptor Angular seja aplicado às requisições OData da biblioteca DevExpress.

**Wrapper de downloads confirmado:** POST em `B + caminho`, `data` igual ao objeto do serviço, `responseType:"arraybuffer"`. Lê o nome em **header de resposta `x-filename`**, não em header de request; usa `content-type` da resposta para criar Blob. Não depende de clicar em uma URL temporária do servidor ou de baixar via Selenium.

Evidência: `appCore.min.js`, offset de caracteres UTF-16 15300 (base zero; recorte literal).

```js
function ii(t,i){n({method:"POST",url:e.getUrlBase()+t,data:i,responseType:"arraybuffer"}).then(function(n){var f=n.headers()["x-filename"],e=n.headers()["content-type"],t=document.createElement("a"),i,r,u;try{i=new Blob([n.data],{type:e});r=window.URL.createObjectURL(i);t.setAttribute("href",r);t.setAttribute("download",f);u=new MouseEvent("click",{view:window,bubbles:!0,cancelable:!1});t.dispatchEvent(u)}catch(o){console.log(o)}})}
```

## 9. Sequência sugerida para substituir o scraper HTTP (inferida)

1. Descobrir URLAPI/AUXTOKEN com a chave, preservando a base retornada.
2. POST `token` com Basic da chave, form URL-encoded e AUXTOKEN; tratar captcha/2FA/redirect e conflito conforme erro.
3. GET GetUserSession com o access_token para obter permissões, empresas e usaNovoOdata.
4. Se usaNovoOdata, obter GetTokenSignalRCore e usar seu token apenas no host OData novo; downloads REST continuam com o token principal.
5. Confirmar colunas de emissão com GetGridViewConfig e paginar o entity set correspondente, aplicando filtro OData validado.
6. CT-e XML: DownloadExportacaoXml com IDENTArray; outro CT-e: DownloadXml com IDCTE; MDF-e: DownloadXml com IDMDFE; portal: PORTALCONTADORIDS contendo linhas inteiras.
7. Salvar os bytes e identificar XML/ZIP pelo content-type, x-filename e assinatura do arquivo retornado. Não presumir ZIP só porque há múltiplos IDs.

### O que falta validar em execução autorizada

- URLAPI realmente retornada para a chave; barra dupla aceita/normalizada; resposta e vida útil dos tokens; cookies se houver.
- Campos de emissão/tipo EDM e fuso, paginação e schema de cada entity set.
- Se o portal permite reduzir os objetos selecionados para identificadores mínimos.
- Tipo de arquivo individual/lote e eventuais limites do backend.
- Se manter SignalR ou alguma atualização de atividade é exigido para prolongar sessão.

Nenhum desses pontos foi promovido a fato confirmado apenas pelo nome dos endpoints. A verificação auxiliar Jev recebeu somente três afirmações e evidência mínima sanitizada (JWT, ZIP e colunas remotas); a classificação supports/contradicts/insufficient foi usada como apoio, mantendo as lacunas como não determinadas.

## Verificação do artefato

Foram executadas asserções offline de factories isoladas, com HTTP e DevExpress simulados, para conferir o body do login, Basic, descoberta, entity sets, bases e tokens OData, interceptor REST e body do download do portal. Todas passaram. Esses testes não exercitam o servidor EGS ou a serialização real das bibliotecas externas.

Os recortes foram comparados literalmente com os offsets dos arquivos locais, os blocos de evidência têm até três linhas e os hashes das fontes foram reconferidos. O estado Git já continha alterações de terceiros; apareceram também arquivos de implementação concorrente durante a análise, preservados sem leitura/edição por esta tarefa. Nenhum comando desta tarefa escreveu dentro do repositório.
