import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Normal builds include both pages. `--mode single` and `--mode single-sync` each produce
// one self-contained HTML file (all JS and CSS inline) for testing on real devices.
export default defineConfig(({ mode }) => {
  if (mode === 'single') return { plugins: [viteSingleFile()], build: { outDir: 'dist-single' } };
  if (mode === 'single-sync') {
    return { plugins: [viteSingleFile()], build: { outDir: 'dist-single-sync', rollupOptions: { input: resolve(__dirname, 'sync.html') } } };
  }
  return { build: { rollupOptions: { input: { main: resolve(__dirname, 'index.html'), sync: resolve(__dirname, 'sync.html') } } } };
});
