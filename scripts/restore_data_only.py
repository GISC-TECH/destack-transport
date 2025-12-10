#!/usr/bin/env python3
"""
Script para extrair apenas os dados (COPY) do backup SQL
Exclui: django_migrations, auth_permission, django_content_type (para não conflitar)
"""
import re
import sys

# Tabelas a ignorar (já existem e podem conflitar)
SKIP_TABLES = {
    'django_migrations',
    'auth_permission', 
    'django_content_type',
    'auth_group',  # Já existe
}

def extract_copy_statements(sql_file, output_file):
    with open(sql_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Regex para encontrar blocos COPY ... \.
    pattern = r'(COPY public\.(\w+)[^\n]*\n)(.*?)(\n\\.)'
    
    with open(output_file, 'w', encoding='utf-8') as out:
        out.write("-- Restauração de dados apenas\n")
        out.write("SET session_replication_role = 'replica';\n\n")
        
        for match in re.finditer(pattern, content, re.DOTALL):
            copy_header = match.group(1)
            table_name = match.group(2)
            data = match.group(3)
            end_marker = match.group(4)
            
            if table_name in SKIP_TABLES:
                print(f"Ignorando: {table_name}")
                continue
            
            # Verifica se tem dados (não é só espaço em branco)
            if data.strip():
                out.write(f"-- Limpando {table_name}\n")
                out.write(f"TRUNCATE TABLE public.{table_name} CASCADE;\n")
                out.write(copy_header + data + end_marker + "\n\n")
                print(f"Incluindo: {table_name}")
            else:
                print(f"Vazio: {table_name}")
        
        out.write("\nSET session_replication_role = 'origin';\n")
        
        # Atualizar sequences
        out.write("\n-- Atualizar sequences\n")
        out.write("SELECT setval(pg_get_serial_sequence('cte_documento', 'id'), COALESCE(MAX(id), 1)) FROM cte_documento;\n")
        out.write("SELECT setval(pg_get_serial_sequence('mdfe_documento', 'id'), COALESCE(MAX(id), 1)) FROM mdfe_documento;\n")
        out.write("SELECT setval(pg_get_serial_sequence('transport_veiculo', 'id'), COALESCE(MAX(id), 1)) FROM transport_veiculo;\n")
        out.write("SELECT setval(pg_get_serial_sequence('transport_endereco', 'id'), COALESCE(MAX(id), 1)) FROM transport_endereco;\n")
        out.write("SELECT setval(pg_get_serial_sequence('auth_user', 'id'), COALESCE(MAX(id), 1)) FROM auth_user;\n")

if __name__ == '__main__':
    extract_copy_statements(
        'backups/destack_backup_20251122_010706.sql',
        'backups/data_only_restore.sql'
    )
    print("\nArquivo gerado: backups/data_only_restore.sql")
