/**
 * Utilitários centralizados de formatação de documentos e valores.
 */

/**
 * Remove todos os caracteres não numéricos de uma string.
 * Preserva zeros à esquerda (diferente de parseInt/Number).
 */
export const onlyDigits = (value) => {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\D/g, '');
};

/**
 * Formata uma string de CPF (11 dígitos) para o formato XXX.XXX.XXX-XX.
 * Preserva zeros à esquerda e limita a 11 dígitos.
 */
export const formatCPF = (value) => {
  const digits = onlyDigits(value).slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
};

/**
 * Formata uma string de CNPJ (14 dígitos) para o formato XX.XXX.XXX/XXXX-XX.
 * Preserva zeros à esquerda e limita a 14 dígitos.
 */
export const formatCNPJ = (value) => {
  const digits = onlyDigits(value).slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`;
};

/**
 * Formata CPF ou CNPJ automaticamente baseado no tamanho.
 */
export const formatCPForCNPJ = (value) => {
  const digits = onlyDigits(value);
  if (digits.length > 11) return formatCNPJ(digits);
  return formatCPF(digits);
};

/**
 * Formata uma string de CEP (8 dígitos) para o formato XXXXX-XXX.
 */
export const formatCEP = (value) => {
  const digits = onlyDigits(value).slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5, 8)}`;
};

/**
 * Handler para inputs de CPF que aplica a máscara gradualmente sem perder dígitos.
 * Deve ser usado no onChange de inputs controlados de CPF.
 *
 * A formatação é feita a cada mudança: remove caracteres inválidos, limita a
 * 11 dígitos e aplica a máscara. Diferente de parseInt/Number, onlyDigits
 * preserva zeros à esquerda.
 *
 * Não reposiciona o cursor manualmente: o setSelectionRange/repaint forçado
 * costumava causar perda de caracteres em digitação rápida e em alguns
 * navegadores móveis. O React mantém o cursor na posição padrão do input
 * conforme o value é atualizado.
 *
 * Para garantir a formatação final (ex.: usuário colou sem máscara), use
 * handleCPFInputBlur no onBlur do input.
 *
 * Exemplo:
 *   const handleCPFChange = (e) => handleCPFInputChange(e, (value) => setFormData(prev => ({ ...prev, cpf: value })));
 *   const handleCPFBlur = (e) => handleCPFInputBlur(e, (value) => setFormData(prev => ({ ...prev, cpf: value })));
 */
export const handleCPFInputChange = (e, setter) => {
  const input = e.target;
  const digits = onlyDigits(input.value).slice(0, 11);
  setter(formatCPF(digits));
};

/**
 * Handler para onBlur de inputs de CPF. Garante que o valor final esteja
 * formatado e sem caracteres inválidos.
 */
export const handleCPFInputBlur = (e, setter) => {
  const input = e.target;
  const digits = onlyDigits(input.value).slice(0, 11);
  setter(formatCPF(digits));
};
