module.exports = {
  root: true,
  env: {
    node: true,
    'vue/setup-compiler-macros': true, // Para defineProps/defineEmits
  },
  extends: [
    'plugin:vue/vue3-essential',
    'eslint:recommended',
  ],
  parserOptions: {
    ecmaVersion: 'latest', // Usar 'latest' para as funcionalidades mais recentes
    sourceType: 'module',
  },
  rules: {
    'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
    'no-debugger': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
    'vue/multi-word-component-names': 'off', // Desabilita regra de nomes de componentes com múltiplas palavras (comum para views)
    'no-unused-vars': process.env.NODE_ENV === 'production' ? 'warn' : ['warn', { 'argsIgnorePattern': '^_' }],
  },
};
