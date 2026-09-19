import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
// A base precisa corresponder ao nome do repositório no GitHub Pages.
// Repositório: https://github.com/kauan11-boop/Vessie-Lib
export default defineConfig({
  base: '/Vessie-Lib/',
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})