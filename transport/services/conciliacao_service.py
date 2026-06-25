# transport/services/conciliacao_service.py
"""
Serviço de conciliação bancária.
Faz parse de arquivos OFX e CSV e retorna transações normalizadas.
"""

import csv
import io
import logging
from datetime import datetime
from decimal import Decimal, InvalidOperation

try:
    from ofxparse import OfxParser
    HAS_OFXPARSE = True
except ImportError:  # pragma: no cover
    HAS_OFXPARSE = False

logger = logging.getLogger(__name__)


def _parse_date(value):
    """Tenta converter uma string/datetime em date."""
    if value is None:
        return None
    if hasattr(value, 'date'):
        return value.date()
    if isinstance(value, datetime):
        return value.date()
    for fmt in ('%Y%m%d', '%Y-%m-%d', '%d/%m/%Y', '%m/%d/%Y', '%Y-%m-%d %H:%M:%S'):
        try:
            return datetime.strptime(str(value).strip(), fmt).date()
        except ValueError:
            continue
    return None


def _to_decimal(value):
    """Converte valor monetário em Decimal."""
    if value is None:
        return Decimal('0.00')
    if isinstance(value, Decimal):
        return value
    try:
        cleaned = str(value).replace('R$', '').replace(' ', '').strip()
        # Detecta formato com separador de milhar
        if ',' in cleaned and '.' in cleaned:
            # Formato brasileiro: 1.234,56
            if cleaned.rfind(',') > cleaned.rfind('.'):
                cleaned = cleaned.replace('.', '').replace(',', '.')
            else:
                # Formato americano: 1,234.56
                cleaned = cleaned.replace(',', '')
        elif ',' in cleaned:
            # Pode ser 1234,56 ou 1,234 (ambíguo)
            parts = cleaned.split(',')
            if len(parts) == 2 and len(parts[1]) <= 2:
                cleaned = cleaned.replace('.', '').replace(',', '.')
            else:
                cleaned = cleaned.replace(',', '')
        return Decimal(cleaned)
    except (InvalidOperation, ValueError):
        return Decimal('0.00')


def _detect_tipo(valor, descricao=''):
    """Detecta se a transação é crédito ou débito."""
    desc_lower = str(descricao).lower()
    if valor > 0:
        return 'credito'
    if valor < 0:
        return 'debito'
    # Valor zero: tenta inferir pela descrição
    if any(term in desc_lower for term in ('pagamento', 'débito', 'debito', 'transferência enviada', 'envio')):
        return 'debito'
    return 'credito'


def _ofx_fallback(content):
    """Parser simplificado de OFX caso ofxparse não esteja instalado."""
    text = content.decode('utf-8', errors='ignore') if isinstance(content, bytes) else content
    transactions = []
    import re
    # Separa blocos <STMTTRN>...</STMTTRN>
    for block in re.findall(r'<STMTTRN>(.*?)</STMTTRN>', text, re.DOTALL | re.IGNORECASE):
        data = re.search(r'<DTPOSTED>([^<]+)', block, re.IGNORECASE)
        desc = re.search(r'<MEMO>([^<]+)', block, re.IGNORECASE)
        if not desc:
            desc = re.search(r'<NAME>([^<]+)', block, re.IGNORECASE)
        tipo_ofx = re.search(r'<TRNTYPE>([^<]+)', block, re.IGNORECASE)
        valor_match = re.search(r'<TRNAMT>([^<]+)', block, re.IGNORECASE)

        valor = _to_decimal(valor_match.group(1)) if valor_match else Decimal('0.00')
        data_tx = _parse_date(data.group(1)) if data else None
        descricao = (desc.group(1).strip() if desc else (tipo_ofx.group(1).strip() if tipo_ofx else 'Transação OFX'))

        if data_tx is None:
            continue

        tipo = _detect_tipo(valor, descricao)
        transactions.append({
            'data': data_tx,
            'descricao': descricao,
            'valor': abs(valor),
            'tipo': tipo,
        })
    return transactions


def parse_ofx(file_obj):
    """Parseia um arquivo OFX e retorna lista de transações normalizadas."""
    try:
        content = file_obj.read()
        if isinstance(content, str):
            content = content.encode('utf-8')

        if HAS_OFXPARSE:
            import io as _io
            try:
                ofx = OfxParser.parse(_io.BytesIO(content))
                transactions = []
                for account in ofx.accounts:
                    for tx in account.statement.transactions:
                        valor = _to_decimal(tx.amount)
                        data_tx = _parse_date(tx.date)
                        if data_tx is None:
                            continue
                        descricao = (getattr(tx, 'memo', None) or getattr(tx, 'name', '') or 'Transação OFX').strip()
                        tipo = _detect_tipo(tx.amount, descricao)
                        transactions.append({
                            'data': data_tx,
                            'descricao': descricao,
                            'valor': abs(valor),
                            'tipo': tipo,
                        })
                if transactions:
                    return transactions
            except Exception:
                logger.warning("ofxparse falhou, usando fallback próprio")

        return _ofx_fallback(content)
    except Exception as exc:
        logger.exception("Erro ao fazer parse do OFX")
        raise ValueError(f"Erro ao processar arquivo OFX: {exc}")


def parse_csv(file_obj, encoding='utf-8'):
    """Parseia um arquivo CSV e retorna lista de transações normalizadas."""
    try:
        if hasattr(file_obj, 'read'):
            content = file_obj.read()
            if isinstance(content, bytes):
                try:
                    text = content.decode(encoding)
                except UnicodeDecodeError:
                    text = content.decode('latin-1')
            else:
                text = content
        else:
            text = file_obj

        # Detecta delimitador
        sample = text[:2048]
        delimiter = ';' if sample.count(';') > sample.count(',') else ','

        reader = csv.DictReader(io.StringIO(text), delimiter=delimiter)
        transactions = []

        for row in reader:
            if not row:
                continue

            # Tenta encontrar colunas comuns
            data_col = _find_column(row, ['data', 'date', 'dtposted', 'data_movimento', 'data_transacao'])
            desc_col = _find_column(row, ['descricao', 'historico', 'memo', 'name', 'desc', 'lançamento'])
            valor_col = _find_column(row, ['valor', 'amount', 'trnamt', 'valor_transacao', 'valor_real'])
            tipo_col = _find_column(row, ['tipo', 'trntype', 'natureza', 'entrada_saida'])

            if not data_col or not valor_col:
                continue

            data_tx = _parse_date(row[data_col])
            if data_tx is None:
                continue

            valor = _to_decimal(row[valor_col])
            descricao = row.get(desc_col, 'Transação CSV').strip() if desc_col else 'Transação CSV'

            if tipo_col and row.get(tipo_col):
                tipo_raw = str(row[tipo_col]).lower().strip()
                if tipo_raw in ('c', 'credito', 'crédito', 'credit', 'entrada', 'recebimento'):
                    tipo = 'credito'
                elif tipo_raw in ('d', 'debito', 'débito', 'debit', 'saída', 'saida', 'pagamento'):
                    tipo = 'debito'
                else:
                    tipo = _detect_tipo(valor, descricao)
            else:
                tipo = _detect_tipo(valor, descricao)

            transactions.append({
                'data': data_tx,
                'descricao': descricao,
                'valor': abs(valor),
                'tipo': tipo,
            })

        return transactions
    except Exception as exc:
        logger.exception("Erro ao fazer parse do CSV")
        raise ValueError(f"Erro ao processar arquivo CSV: {exc}")


def _find_column(row, candidates):
    """Encontra a primeira coluna do CSV que corresponda aos candidatos."""
    keys = {k.lower().strip().replace(' ', '_'): k for k in row.keys()}
    for candidate in candidates:
        if candidate in keys:
            return keys[candidate]
    return None


def parse_arquivo(file_obj, filename):
    """Roteia para o parser correto baseado na extensão do arquivo."""
    name_lower = filename.lower()
    if name_lower.endswith('.ofx') or name_lower.endswith('.qfx'):
        return parse_ofx(file_obj)
    if name_lower.endswith('.csv'):
        return parse_csv(file_obj)
    raise ValueError("Formato de arquivo não suportado. Use OFX, QFX ou CSV.")


def salvar_transacoes(transacoes, arquivo_origem):
    """Persiste transações detectadas no banco e retorna os registros criados."""
    from ..models import TransacaoBancaria

    registros = []
    for tx in transacoes:
        registro = TransacaoBancaria.objects.create(
            data=tx['data'],
            descricao=tx['descricao'],
            valor=tx['valor'],
            tipo=tx['tipo'],
            arquivo_origem=arquivo_origem,
            conciliado=False,
        )
        registros.append(registro)
    return registros
