import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // GitHub Pages serves project sites from /<repo>/ — the deploy workflow
  // sets VITE_BASE accordingly. Local dev stays at /.
  base: process.env.VITE_BASE ?? '/',
})
