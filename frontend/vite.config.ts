import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss()
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://192.168.0.246:83',
        changeOrigin: true,
        secure: false
      },
      '/uploads': {
        target: 'http://192.168.0.246:83',
        changeOrigin: true,
        secure: false
      }
    }
  }
})
