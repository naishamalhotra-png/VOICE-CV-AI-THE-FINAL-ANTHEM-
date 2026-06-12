import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },

  server: {
    allowedHosts: ['voice-cv-ai-the-final-anthem.onrender.com'],
  },

  preview: {
    allowedHosts: ['voice-cv-ai-the-final-anthem.onrender.com'],
  },
});
