/* eslint-disable no-undef */
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'child_process'

// Detecta se está rodando dentro do Docker
const isDocker = process.env.DOCKER_ENV;

function resolveApiTarget() {
  if (!isDocker) return 'http://localhost:8001';

  // Usa o nginx como gateway unificado. Resolve para IP no startup para
  // evitar falhas de DNS intermitentes no Vite proxy com muitas requisições.
  const url = process.env.VITE_API_URL || 'http://nginx:80';
  try {
    const parsed = new URL(url);
    const output = execSync(`getent hosts ${parsed.hostname}`, { encoding: 'utf8', timeout: 2000 }).trim();
    const ip = output.split(/\s+/)[0];
    if (!ip) throw new Error('IP não encontrado');
    return `http://${ip}:${parsed.port || 80}`;
  } catch {
    return url;
  }
}

const apiTarget = resolveApiTarget();

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) {
              return 'vendor-react';
            }
            if (/node_modules\/(recharts|d3|victory)/.test(id)) {
              return 'vendor-charts';
            }
            if (/node_modules\/(react-router|react-router-dom|@remix-run)/.test(id)) {
              return 'vendor-router';
            }
            return 'vendor';
          }
        }
      }
    }
  },
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
      },
      '/media': {
        target: apiTarget,
        changeOrigin: true,
        secure: false
      },
      '/static': {
        target: apiTarget,
        changeOrigin: true,
        secure: false
      }
    }
  }
})
