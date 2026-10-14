"""
Envio de XMLs para a API do Destack (compartilhado pelo coletor Selenium e pelo coletor HTTP).
"""
import glob
import os
import re

from lxml import etree

from destack_client import DestackClient
from logger_setup import setup_logger

logger = setup_logger('xml_upload')


def extract_chave_from_filename(filename: str):
    """Extrai chave de 44 dígitos do nome do arquivo."""
    match = re.search(r'(\d{44})', filename)
    return match.group(1) if match else None


def is_event_xml_file(file_path: str) -> bool:
    """
    Identifica XML de evento fiscal (cancelamento, CC-e, retorno SEFAZ).

    Primeiro verifica padroes no nome do arquivo; se nao identificar,
    le a tag raiz do XML (com suporte a namespaces).
    """
    filename = os.path.basename(file_path).lower()
    name_markers = ('_canc', 'procevento', 'retevento', 'evento')
    if any(marker in filename for marker in name_markers):
        return True

    try:
        tree = etree.parse(file_path)
        root_tag = etree.QName(tree.getroot()).localname.lower()
    except Exception as e:
        logger.debug(f"Nao foi possivel parsear {file_path}: {e}")
        return False

    event_roots = {
        'proceventocte',
        'proceventomdfe',
        'reteventocte',
        'reteventomdfe',
        'eventocte',
        'eventomdfe',
    }
    return root_tag in event_roots


def sort_xml_upload_order(file_paths: list) -> list:
    """Garante que XMLs principais sejam enviados antes dos eventos da mesma chave."""
    def upload_order(file_path):
        filename = os.path.basename(file_path).lower()
        is_event = is_event_xml_file(file_path)
        is_return = is_event and 'retevento' in filename
        chave = extract_chave_from_filename(filename) or ''
        return (chave, 2 if is_return else 1 if is_event else 0, filename)

    return sorted(file_paths, key=upload_order)


def upload_xmls_to_api(folder_path: str) -> dict:
    """
    Envia XMLs novos de uma pasta para a API do Destack.
    Pré-verifica quais chaves já existem para evitar reprocessamento.
    Retorna estatísticas do envio.
    """
    result = {'success': 0, 'failed': 0, 'duplicates': 0, 'skipped': 0, 'total': 0}

    # Encontrar todos os XMLs na pasta
    xml_files = glob.glob(os.path.join(folder_path, "**/*.xml"), recursive=True)
    result['total'] = len(xml_files)

    if not xml_files:
        logger.info("Nenhum arquivo XML encontrado para enviar")
        return result

    logger.info(f"Encontrados {len(xml_files)} arquivos XML")

    # Fase 1: Extrair chaves dos filenames
    files_with_chaves = {}  # chave -> [file_paths]
    files_without_chaves = []

    for xml_path in xml_files:
        filename = os.path.basename(xml_path)
        chave = extract_chave_from_filename(filename)
        if chave:
            files_with_chaves.setdefault(chave, []).append(xml_path)
        else:
            files_without_chaves.append(xml_path)

    logger.info(f"Chaves extraídas: {len(files_with_chaves)} únicas, {len(files_without_chaves)} sem chave")

    # Conectar à API
    destack = DestackClient()
    if not destack.login():
        logger.error("Falha ao conectar na API do Destack")
        result['failed'] = len(xml_files)
        return result

    # Fase 2: Consultar API para saber quais já existem
    all_chaves = list(files_with_chaves.keys())
    check_result = destack.check_existing_chaves(all_chaves)
    existing_chaves = check_result['existing']
    missing_chaves = check_result['missing']

    # Fase 3: Filtrar - separar novos dos existentes.
    # Eventos devem ser enviados mesmo quando a chave principal ja existe: cancelamentos
    # podem chegar depois da CT-e/MDF-e original.
    files_to_upload = []
    for chave in missing_chaves:
        files_to_upload.extend(files_with_chaves[chave])

    skipped_count = 0
    for chave in existing_chaves:
        for xml_path in files_with_chaves[chave]:
            if is_event_xml_file(xml_path):
                files_to_upload.append(xml_path)
            else:
                skipped_count += 1

    result['skipped'] = skipped_count

    # Arquivos sem chave sempre são enviados (a API decidirá)
    files_to_upload.extend(files_without_chaves)
    files_to_upload = sort_xml_upload_order(files_to_upload)

    logger.info(
        f"Pré-verificação: {skipped_count} XMLs ignorados (já existem), "
        f"{len(files_to_upload)} XMLs para enviar"
    )

    if not files_to_upload:
        logger.info("Todos os XMLs já existem na API. Nada a enviar.")
        return result

    # Fase 4: Upload dos novos
    for xml_path in files_to_upload:
        filename = os.path.basename(xml_path)
        try:
            upload_result = destack.upload_xml(xml_path)

            if upload_result.get('success'):
                result['success'] += 1
            elif upload_result.get('duplicate'):
                result['duplicates'] += 1
            else:
                result['failed'] += 1
                logger.warning(f"Falha ao enviar {filename}: {upload_result.get('error')}")

        except Exception as e:
            result['failed'] += 1
            logger.error(f"Erro ao enviar {filename}: {e}")

    logger.info(
        f"Upload concluído: {result['success']} enviados, "
        f"{result['skipped']} ignorados (pré-check), "
        f"{result['duplicates']} duplicados, {result['failed']} falhas"
    )
    return result
