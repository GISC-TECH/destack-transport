"""
Coleta de XMLs de CT-e e MDF-e pela API interna do EGS (sem Selenium).

Fluxo:
  1. login na API (reusa token em cache; derruba sessao concorrente se preciso)
  2. lista CT-e (odata/CTeTelaXml) e MDF-e (odata/MDFe) dos ultimos DAYS_LOOKBACK dias
  3. pergunta ao Destack quais chaves ja existem e pula as que nao mudam
  4. baixa os XMLs em lotes (zip descompactado em memoria) para DOWNLOAD_DIR/xmls_DD-MM-YYYY/
  5. envia para a API do Destack com o mesmo xml_upload do coletor Selenium

Uso:
    python daily_download_api.py            # DAYS_LOOKBACK do ambiente
    python daily_download_api.py 3          # ultimos 3 dias
"""
import os
import sys
import time
from datetime import date, datetime, timedelta
from typing import Callable, Dict, List

from config import DAYS_LOOKBACK, DOWNLOAD_DIR
from destack_client import DestackClient
from egs_api_client import EGSApiClient, EGSApiError, from_env
from logger_setup import setup_logger
from xml_upload import upload_xmls_to_api

logger = setup_logger('daily_download_api')

BATCH_SIZE = int(os.getenv('EGS_DOWNLOAD_BATCH', '150'))  # mesmo teto do front (TAMANHO_LOTE)
BATCH_ATTEMPTS = 3
# Status cujo download pode trazer evento novo mesmo com a chave ja no Destack.
# CT-e cancelado: DownloadExportacaoXml devolve zip com <chave>.xml + <chave>_Canc.xml.
# MDF-e: DownloadXml nunca inclui evento (cancelado vem so o <MDFe> cru), entao nao vale rebaixar.
STATUS_COM_EVENTO = {'CHAVECTE': {'CANCELADO'}, 'CHAVEMDFE': set()}


def _token_cache_path() -> str:
    state_dir = os.getenv('SCRAPER_STATE_DIR') or os.path.dirname(os.getenv('PROCESSED_FILE', '')) or 'data'
    return os.path.join(state_dir, 'egs_token.json')


def _chaves_existentes(chaves: List[str]) -> set:
    """Consulta o Destack; em falha devolve vazio (baixa tudo, o upload deduplica)."""
    if not chaves:
        return set()
    destack = DestackClient()
    if not destack.login():
        logger.warning('Destack indisponivel para pre-check; baixando todos os documentos')
        return set()
    return destack.check_existing_chaves(chaves, incluir_eventos=True)['existing']


def _filtrar_novos(docs: List[dict], chave_campo: str, existentes: set) -> List[dict]:
    com_evento = STATUS_COM_EVENTO.get(chave_campo, set())
    novos = []
    for doc in docs:
        chave = doc.get(chave_campo)
        if chave in existentes and doc.get('STATUSNOME') not in com_evento:
            continue
        novos.append(doc)
    return novos


def _baixar_em_lotes(nome: str, ids: List[int], download: Callable[[List[int]], Dict[str, bytes]], pasta: str) -> int:
    """Baixa em lotes com retentativa. Retorna arquivos gravados ou -1 se algum lote falhou."""
    os.makedirs(pasta, exist_ok=True)
    gravados = 0
    for inicio in range(0, len(ids), BATCH_SIZE):
        lote = ids[inicio:inicio + BATCH_SIZE]
        for tentativa in range(1, BATCH_ATTEMPTS + 1):
            try:
                arquivos = download(lote)
                for nome_arquivo, conteudo in arquivos.items():
                    with open(os.path.join(pasta, nome_arquivo), 'wb') as fh:
                        fh.write(conteudo)
                gravados += len(arquivos)
                logger.info(f'{nome}: lote {inicio // BATCH_SIZE + 1} ({len(lote)} ids) -> {len(arquivos)} arquivos')
                break
            except (EGSApiError, OSError) as e:
                logger.warning(f'{nome}: lote {inicio // BATCH_SIZE + 1} falhou ({tentativa}/{BATCH_ATTEMPTS}): {e}')
                if tentativa == BATCH_ATTEMPTS:
                    return -1
                time.sleep(10 * tentativa)
    return gravados


def download_daily_xmls_api(days_lookback: int = None, client: EGSApiClient = None) -> bool:
    days = DAYS_LOOKBACK if days_lookback is None else days_lookback
    inicio = date.today() - timedelta(days=days)
    output_folder = os.path.join(DOWNLOAD_DIR, f"xmls_{datetime.now().strftime('%d-%m-%Y')}")
    os.makedirs(output_folder, exist_ok=True)

    logger.info('=' * 60)
    logger.info(f'COLETA VIA API EGS - desde {inicio.strftime("%d/%m/%Y")} ({days} dias)')
    logger.info(f'Pasta de destino: {output_folder}')
    logger.info('=' * 60)

    try:
        cli = client or from_env(token_cache=_token_cache_path())
        cli.login_derrubando_sessoes()
        logger.info('LOGIN OK!')

        ctes = cli.listar_ctes(inicio)
        mdfes = cli.listar_mdfes(inicio)
        logger.info(f'EGS: {len(ctes)} CT-e e {len(mdfes)} MDF-e no periodo')

        existentes = _chaves_existentes([c['CHAVECTE'] for c in ctes] + [m['CHAVEMDFE'] for m in mdfes])
        ctes_novos = _filtrar_novos(ctes, 'CHAVECTE', existentes)
        mdfes_novos = _filtrar_novos(mdfes, 'CHAVEMDFE', existentes)
        logger.info(
            f'Para baixar: {len(ctes_novos)} CT-e e {len(mdfes_novos)} MDF-e '
            f'({len(ctes) - len(ctes_novos) + len(mdfes) - len(mdfes_novos)} ja existem no Destack)'
        )

        cte_count = _baixar_em_lotes('CT-e', [c['IDCTE'] for c in ctes_novos], cli.download_cte_xml, os.path.join(output_folder, 'cte'))
        mdfe_count = _baixar_em_lotes('MDF-e', [m['IDMDFE'] for m in mdfes_novos], cli.download_mdfe_xml, os.path.join(output_folder, 'mdfe'))
        download_failed = cte_count < 0 or mdfe_count < 0
        total = max(cte_count, 0) + max(mdfe_count, 0)

        logger.info('=' * 60)
        logger.info('DOWNLOAD CONCLUIDO!' if not download_failed else 'DOWNLOAD INCOMPLETO!')
        logger.info(f'CT-e: {max(cte_count, 0)} arquivos | MDF-e: {max(mdfe_count, 0)} arquivos | Total: {total}')
        logger.info('=' * 60)

        upload_failed = False
        if total > 0:
            logger.info('Enviando XMLs para API do Destack...')
            upload_result = upload_xmls_to_api(output_folder)
            logger.info(
                f"Enviados: {upload_result['success']} | Ignorados (ja existem): {upload_result['skipped']} | "
                f"Duplicados: {upload_result['duplicates']} | Falhas: {upload_result['failed']}"
            )
            upload_failed = upload_result['failed'] > 0
        else:
            logger.info('Nenhum XML novo para enviar')

        if download_failed:
            logger.error('Job incompleto: CT-e ou MDF-e falhou apos todas as tentativas')
        if upload_failed:
            logger.error('Job incompleto: houve falha no envio de XMLs para a API')
        return not download_failed and not upload_failed

    except Exception as e:
        logger.error(f'Erro durante a coleta via API: {e}')
        import traceback
        traceback.print_exc()
        return False


if __name__ == '__main__':
    dias = int(sys.argv[1]) if len(sys.argv) > 1 else None
    ok = download_daily_xmls_api(dias)
    sys.exit(0 if ok else 1)
