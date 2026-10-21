import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // Renderer content is loaded from file:// in packaged Electron builds.
  // Keep generated resource URLs relative to index.html in both modes.
  base: './',
  plugins: [tailwindcss()],
});
