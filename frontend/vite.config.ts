import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // 1. Apagar sourcemaps para proteger el código original en producción
    sourcemap: false,

    // 2. Usar el minificador OXC (Rolldown nativo en Vite 8) — más rápido que esbuild
    // "oxc" es el default de Vite 8, no hace falta declararlo explícitamente

    // 3. Empaquetar con nombres de archivos ilegibles
    rollupOptions: {
      output: {
        manualChunks: undefined,
        entryFileNames: 'assets/app.[hash].js',
        chunkFileNames: 'assets/chunk-[hash].js',
        assetFileNames: 'assets/media-[hash].[ext]'
      }
    }
  },
  // 4. Configuración OXC para eliminar console.log y debugger (Vite 8 / Rolldown)
  oxc: {
    transform: {
      assumptions: {},
    }
  }
})
