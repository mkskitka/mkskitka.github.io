import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // Expose the dev server on the local network so you can open it on a phone
    // (Vite prints the "Network:" URL when it starts).
    host: true,
  },
})
