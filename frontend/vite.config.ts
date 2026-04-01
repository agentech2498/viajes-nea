import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // 1. Apagar los SourceMaps para que Chrome DevTools NO pueda reconstruir el código original .ts/.tsx
    sourcemap: false,
    
    // 2. Usar Esbuild nativo para minificar (Mangling) el código en producción (Nombres de variables ilegibles)
    minify: 'esbuild',
    
    // 3. Empaquetar todo destruyendo los nombres de archivos legibles
    rollupOptions: {
      output: {
        manualChunks: undefined,
        entryFileNames: 'assets/app.[hash].js',
        chunkFileNames: 'assets/chunk-[hash].js',
        assetFileNames: 'assets/media-[hash].[ext]'
      }
    }
  },
  esbuild: {
    // 4. Arrancar de raíz cualquier "console.log" o interrupciones de rastreo de código.
    drop: ['console', 'debugger'],
    // 5. Ofuscar nombres de clases si están en modo puro
    keepNames: false
  }
})
