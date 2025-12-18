import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: "./",
  plugins: [react()],
  server: {
    port: 5173,
    host: '0.0.0.0',
    allowedHosts: ['beratkaragol.xyz', 'www.beratkaragol.xyz'],
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
        // target: 'https://api.beratkaragol.xyz/api',
        changeOrigin: true,
        secure: false
      }
    }
  }
})
