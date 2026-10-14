import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Force a single copy of React across the app AND react-three-fiber.
  // Without this, R3F's <Canvas> throws "Invalid hook call / two copies of React".
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
  // Pre-bundle the 3D libraries together with React up front.
  // They're lazy-loaded, so without this Vite discovers them late, re-bundles
  // mid-session, and the page ends up with two copies of React ("Invalid hook call").
  optimizeDeps: {
    include: ['react', 'react-dom', 'react/jsx-runtime', '@react-three/fiber', 'three'],
  },
  // On Windows the default file watcher sometimes misses saves, and the dev
  // server then keeps serving a stale copy of the file even after a hard reload.
  // Polling checks the disk every 300ms instead — a little CPU, no missed edits.
  server: {
    watch: { usePolling: true, interval: 300 },
  },
})
