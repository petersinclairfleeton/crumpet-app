import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `vite build --mode single` makes one self-contained HTML file, for trying the app on any device.
export default defineConfig(({ mode }) => ({
  plugins: mode === 'single' ? [react(), viteSingleFile()] : [react()],
  resolve: { alias: { '@crumpet/editor': resolve(__dirname, '../packages/editor/src') } },
  server: { fs: { allow: [resolve(__dirname, '..')] } },
  build: mode === 'single' ? { outDir: 'dist-single' } : {},
}));
