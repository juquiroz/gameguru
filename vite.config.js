import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://juquiroz.github.io/gameguru/
export default defineConfig({
  plugins: [react()],
  base: '/gameguru/',
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})
