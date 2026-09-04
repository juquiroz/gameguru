import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://gameguru.963bits.com/ — dominio personalizado servido en la raíz.
// Los assets deben usar rutas absolutas desde `/` (sin prefijo /gameguru/).
export default defineConfig({
  plugins: [react()],
  base: '/',
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})
