/* eslint-disable no-undef */
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Detecta se está rodando dentro do Docker
const isDocker = process.env.VITE_API_URL || process.env.DOCKER_ENV;
const apiTarget = isDocker ? 'http://web:8000' : 'http://localhost:8001';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: parseInt(process.env.PORT || '8000'),
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
        secure: false,
        cookieDomainRewrite: '',
        cookiePathRewrite: {
          '*': '/'
        }
      }
    }
  }
})
