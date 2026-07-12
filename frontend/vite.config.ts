import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// VITE_BASE_PATH must be set to the GitHub Pages repo subpath, e.g. /probe-adjust/
// Locally it defaults to '/' so the dev server works unchanged.
// HashRouter handles client-side routing; this base only affects asset URLs.
const base = process.env.VITE_BASE_PATH ?? '/'

export default defineConfig({
  base,
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
