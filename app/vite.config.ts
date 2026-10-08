import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { ocrFiles } from './ocr.plugin';

// `vite build --mode single` makes one self-contained HTML file, for trying the app on any device.
export default defineConfig(({ mode }) => ({
  plugins: mode === 'single' ? [react(), viteSingleFile()] : [react(), ocrFiles(__dirname)],
  resolve: { alias: { '@crumpet/editor': resolve(__dirname, '../packages/editor/src') } },
  server: { fs: { allow: [resolve(__dirname, '..')] } },
  // Prepared when the dev server starts, so loading them later never reloads the page.
  optimizeDeps: { include: ['katex', 'mermaid', 'pdfjs-dist', 'tesseract.js'] },
  build: mode === 'single' ? { outDir: 'dist-single' } : {},
}));
