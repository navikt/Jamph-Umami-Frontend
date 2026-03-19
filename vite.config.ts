import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/api/rag': {
        target: 'https://jamph-rag-api-umami.ekstern.dev.nav.no',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/rag/, ''),
      }
    }
  }
})
