import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vuetify from 'vite-plugin-vuetify'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vuetify({
      autoImport: true,
      // styles: { configFile: 'src/styles/variables.scss' } // Opcional: se você for usar um arquivo de variáveis SASS
    }),
  ],
  define: { 'process.env': {} }, // Necessário para algumas dependências que esperam process.env
  resolve: {
    alias: {
      '@': '/src', // Permite importar componentes/módulos usando @/ em vez de caminhos relativos
    },
  },
  server: {
    port: 8081, // Porta para o servidor de desenvolvimento Vite
    proxy: {
      // Proxy para a API backend durante o desenvolvimento
      // Qualquer requisição para /api no frontend será redirecionada para http://localhost:8080/api
      '/api': {
        target: 'http://localhost:8080', // URL da sua API Go backend
        changeOrigin: true, // Necessário para virtual hosted sites
        // rewrite: (path) => path.replace(/^\/api/, '/api') // Mantém /api no caminho do backend.
                                                            // Se o seu backend Go já espera /api, então esta linha é redundante,
                                                            // mas não prejudicial. Se o backend não espera /api, ajuste conforme necessário.
      }
    }
  },
})