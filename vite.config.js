import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: ['voice-cv-ai-the-final-anthem.onrender.com'],
  },
  preview: {
    allowedHosts: ['voice-cv-ai-the-final-anthem.onrender.com'],
  },
})
