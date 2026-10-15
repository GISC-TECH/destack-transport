"""
Coleta de XMLs de CT-e e MDF-e (documentos e eventos) pela API interna do EGS, sem Selenium.

Fluxo:
  1. login na API (reusa token em cache; derruba UMA sessao ociosa se faltar vaga)
  2. lista CT-e (odata/CTeTelaXml) e MDF-e (odata/MDFe) emitidos no periodo
  3. eventos do periodo:
       CT-e  -> cancelamentos (odata/CTeCancelamento) e cartas de correcao (odata/CTeCartaCorrecao)
       MDF-e -> todos os eventos homologados de cada MDF-e (encerramento, cancelamento,
                inclusao de condutor, ...) via MDFeApi/GetMDFeEventos + DownloadXmlEvento
  4. pergunta ao Destack o que ja existe (documento por chave; evento por chave+tipo+sequencia)
  5. baixa so o que falta, grava em DOWNLOAD_DIR/xmls_DD-MM-YYYY/ e envia ao Destack
     (documentos antes dos eventos, via xml_upload)

Uso:
    python daily_download_api.py              # ultimos DAYS_LOOKBACK dias
    python daily_download_api.py 30           # ultimos 30 dias
    python daily_download_api.py --tudo       # carga historica completa (desde 2015)
"""
import os
import re
import sys
import time
from datetime import date, datetime, timedelta
from typing import Callable, Dict, Iterable, List, Optional

from config import DAYS_LOOKBACK, DOWNLOAD_DIR
from destack_client import DestackClient
from egs_api_client import EGSApiClient, EGSApiError, from_env
from logger_setup import setup_logger
from xml_upload import upload_xmls_to_api

logger = setup_logger('daily_download_api')

BATCH_SIZE = int(os.getenv('EGS_DOWNLOAD_BATCH', '150'))  # mesmo teto do front (TAMANHO_LOTE)
BATCH_ATTEMPTS = 3
INICIO_HISTORICO = date(2015, 1, 1)
# MDF-e emitidos ha ate N dias tem os eventos consultados (encerramento costuma vir dias depois)
MDFE_EVENTOS_DIAS = int(os.getenv('EGS_MDFE_EVENTOS_DIAS', '30'))

_RE_CHAVE = re.compile(r'<ch(?:CTe|MDFe)>(\d{44})</ch(?:CTe|MDFe)>')
_RE_TP = re.compile(r'<tpEvento>\s*(\d{6})\s*</tpEvento>')
_RE_SEQ = re.compile(r'<nSeqEvento>\s*(\d+)\s*</nSeqEvento>')


def evento_key(xml: str) -> Optional[str]:
    """'<chave>:<tpEvento>:<nSeqEvento>' do primeiro <infEvento> do XML, ou None."""
    ch, tp, seq = _RE_CHAVE.search(xml), _RE_TP.search(xml), _RE_SEQ.search(xml)
    if not (ch and tp):
        return None
    return f'{ch.group(1)}:{tp.group(1)}:{int(seq.group(1)) if seq else 1}'


def _token_cache_path() -> str:
    state_dir = os.getenv('SCRAPER_STATE_DIR') or os.path.dirname(os.getenv('PROCESSED_FILE', '')) or 'data'
    return os.path.join(state_dir, 'egs_token.json')


def _chunks(items: List, size: int) -> Iterable[List]:
    for i in range(0, len(items), size):
        yield items[i:i + size]


def _com_retentativa(nome: str, func: Callable[[], Dict[str, bytes]]) -> Optional[Dict[str, bytes]]:
    for tentativa in range(1, BATCH_ATTEMPTS + 1):
        try:
            return func()
        except (EGSApiError, OSError) as e:
            logger.warning(f'{nome} falhou ({tentativa}/{BATCH_ATTEMPTS}): {e}')
            if tentativa < BATCH_ATTEMPTS:
                time.sleep(10 * tentativa)
    return None


def _gravar(pasta: str, arquivos: Dict[str, bytes]) -> int:
    os.makedirs(pasta, exist_ok=True)
    for nome, conteudo in arquivos.items():
        with open(os.path.join(pasta, nome), 'wb') as fh:
            fh.write(conteudo)
    return len(arquivos)


def _baixar_em_lotes(nome: str, ids: List[int], download: Callable[[List[int]], Dict[str, bytes]], pasta: str) -> int:
    """Baixa em lotes com retentativa. Retorna arquivos gravados ou -1 se algum lote falhou."""
    gravados = 0
    for n, lote in enumerate(_chunks(ids, BATCH_SIZE), 1):
        arquivos = _com_retentativa(f'{nome} lote {n}', lambda: download(lote))
        if arquivos is None:
            return -1
        gravados += _gravar(pasta, arquivos)
        logger.info(f'{nome}: lote {n} ({len(lote)} ids) -> {len(arquivos)} arquivos')
    return gravados


def _documentos_existentes(destack: Optional[DestackClient], chaves: List[str]) -> set:
    if not destack or not chaves:
        return set()
    return destack.check_existing_chaves(chaves, incluir_eventos=False)['existing']


def _eventos_existentes(destack: Optional[DestackClient], keys: List[str]) -> set:
    if not destack or not keys:
        return set()
    return destack.check_existing_eventos_exatos(keys) or set()


def _coletar_eventos_mdfe(cli: EGSApiClient, mdfes: List[dict]) -> List[dict]:
    """[{key, ident, chave}] de todos os eventos homologados dos MDF-e informados."""
    eventos = []
    for i, m in enumerate(mdfes, 1):
        try:
            for e in cli.eventos_mdfe(m['IDMDFE']):
                key = evento_key(e.get('XMLENVIO') or '')
                if not key:
                    key = f"{m['CHAVEMDFE']}:{e.get('TIPOEVENTO')}:{int(e.get('SEQEVENTO') or 1)}"
                eventos.append({'key': key, 'ident': e['IDENT'], 'chave': m['CHAVEMDFE']})
        except EGSApiError as err:
            logger.warning(f"Eventos do MDF-e {m.get('NUMMDFE')} indisponiveis: {err}")
        if i % 100 == 0:
            logger.info(f'Eventos MDF-e: {i}/{len(mdfes)} manifestos consultados')
    return eventos


def download_daily_xmls_api(days_lookback: int = None, client: EGSApiClient = None,
                            inicio: Optional[date] = None, enviar: bool = True) -> bool:
    days = DAYS_LOOKBACK if days_lookback is None else days_lookback
    inicio = inicio or (date.today() - timedelta(days=days))
    output_folder = os.path.join(DOWNLOAD_DIR, f"xmls_{datetime.now().strftime('%d-%m-%Y')}")
    os.makedirs(output_folder, exist_ok=True)

    logger.info('=' * 60)
    logger.info(f'COLETA VIA API EGS - desde {inicio.strftime("%d/%m/%Y")}')
    logger.info(f'Pasta de destino: {output_folder}')
    logger.info('=' * 60)

    try:
        cli = client or from_env(token_cache=_token_cache_path())
        cli.login_derrubando_sessoes()
        logger.info('LOGIN OK!')

        destack = DestackClient()
        if not destack.login():
            logger.warning('Destack indisponivel para pre-check; baixando tudo do periodo')
            destack = None

        # ---------------- documentos
        ctes = cli.listar_ctes(inicio)
        mdfes = cli.listar_mdfes(inicio)
        existentes = _documentos_existentes(destack, [c['CHAVECTE'] for c in ctes] + [m['CHAVEMDFE'] for m in mdfes])
        ctes_novos = [c for c in ctes if c['CHAVECTE'] not in existentes]
        mdfes_novos = [m for m in mdfes if m['CHAVEMDFE'] not in existentes]
        logger.info(f'EGS: {len(ctes)} CT-e e {len(mdfes)} MDF-e no periodo; '
                    f'faltam {len(ctes_novos)} CT-e e {len(mdfes_novos)} MDF-e no Destack')

        cte_count = _baixar_em_lotes('CT-e', [c['IDCTE'] for c in ctes_novos], cli.download_cte_xml,
                                     os.path.join(output_folder, 'cte'))
        mdfe_count = _baixar_em_lotes('MDF-e', [m['IDMDFE'] for m in mdfes_novos], cli.download_mdfe_xml,
                                      os.path.join(output_folder, 'mdfe'))

        # ---------------- eventos CT-e (XML vem no proprio OData)
        evt_cte = cli.eventos_cte(inicio)
        for e in evt_cte:
            e['key'] = evento_key(e['xml'])
        ja_tem = _eventos_existentes(destack, [e['key'] for e in evt_cte if e['key']])
        evt_cte_novos = [e for e in evt_cte if not e['key'] or e['key'] not in ja_tem]
        evt_cte_count = _gravar(os.path.join(output_folder, 'eventos_cte'),
                                {e['nome']: e['xml'].encode('utf-8') for e in evt_cte_novos})

        # ---------------- eventos MDF-e
        limite_evt = min(inicio, date.today() - timedelta(days=MDFE_EVENTOS_DIAS))
        mdfes_evt = mdfes if limite_evt >= inicio else cli.listar_mdfes(limite_evt)
        # Encerramento (110112) e cancelamento (110111) sao finais: depois deles nao ha evento novo.
        finais = _eventos_existentes(destack, [f"{m['CHAVEMDFE']}:{tp}:1" for m in mdfes_evt for tp in ('110112', '110111')])
        chaves_finais = {k.split(':')[0] for k in finais}
        pendentes = [m for m in mdfes_evt if m['CHAVEMDFE'] not in chaves_finais]
        logger.info(f'Eventos MDF-e: {len(pendentes)} de {len(mdfes_evt)} manifestos ainda sem evento final no Destack')
        evt_mdfe = _coletar_eventos_mdfe(cli, pendentes)
        ja_tem = _eventos_existentes(destack, [e['key'] for e in evt_mdfe])
        evt_mdfe_novos = [e for e in evt_mdfe if e['key'] not in ja_tem]
        evt_mdfe_count = _baixar_em_lotes('Eventos MDF-e', [e['ident'] for e in evt_mdfe_novos],
                                          cli.download_eventos_mdfe, os.path.join(output_folder, 'eventos_mdfe'))

        logger.info(f'Eventos: CT-e {len(evt_cte)} no EGS / {len(evt_cte_novos)} novos; '
                    f'MDF-e {len(evt_mdfe)} no EGS / {len(evt_mdfe_novos)} novos')

        download_failed = min(cte_count, mdfe_count, evt_mdfe_count) < 0
        total = sum(max(n, 0) for n in (cte_count, mdfe_count, evt_cte_count, evt_mdfe_count))

        logger.info('=' * 60)
        logger.info('DOWNLOAD CONCLUIDO!' if not download_failed else 'DOWNLOAD INCOMPLETO!')
        logger.info(f'CT-e: {max(cte_count, 0)} | MDF-e: {max(mdfe_count, 0)} | '
                    f'Eventos CT-e: {evt_cte_count} | Eventos MDF-e: {max(evt_mdfe_count, 0)} | Total: {total}')
        logger.info('=' * 60)

        upload_failed = False
        if total > 0 and enviar:
            logger.info('Enviando XMLs para API do Destack...')
            upload_result = upload_xmls_to_api(output_folder)
            logger.info(
                f"Enviados: {upload_result['success']} | Ignorados (ja existem): {upload_result['skipped']} | "
                f"Duplicados: {upload_result['duplicates']} | Falhas: {upload_result['failed']}"
            )
            upload_failed = upload_result['failed'] > 0
        elif total == 0:
            logger.info('Nada novo para enviar')

        if download_failed:
            logger.error('Job incompleto: algum download falhou apos todas as tentativas')
        if upload_failed:
            logger.error('Job incompleto: houve falha no envio de XMLs para a API')
        return not download_failed and not upload_failed

    except Exception as e:
        logger.error(f'Erro durante a coleta via API: {e}')
        import traceback
        traceback.print_exc()
        return False


if __name__ == '__main__':
    args = sys.argv[1:]
    if args and args[0] == '--tudo':
        ok = download_daily_xmls_api(inicio=INICIO_HISTORICO)
    else:
        ok = download_daily_xmls_api(int(args[0]) if args else None)
    sys.exit(0 if ok else 1)
