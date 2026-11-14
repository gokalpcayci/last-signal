import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      // logo.html = animated-logo lab (src/brand/playground.ts)
      input: { main: 'index.html', logo: 'logo.html' },
    },
  },
})
