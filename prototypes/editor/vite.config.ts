import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

const alias = { '@crumpet/editor': resolve(__dirname, '../../packages/editor/src') };

// Normal builds include both pages. `--mode single` and `--mode single-sync` each produce
// one self-contained HTML file (all JS and CSS inline) for testing on real devices.
export default defineConfig(({ mode }) => {
  const base = { resolve: { alias }, server: { fs: { allow: [resolve(__dirname, '../..')] } } };
  if (mode === 'single') return { ...base, plugins: [viteSingleFile()], build: { outDir: 'dist-single' } };
  if (mode === 'single-sync') {
    return { ...base, plugins: [viteSingleFile()], build: { outDir: 'dist-single-sync', rollupOptions: { input: resolve(__dirname, 'sync.html') } } };
  }
  return { ...base, build: { rollupOptions: { input: { main: resolve(__dirname, 'index.html'), sync: resolve(__dirname, 'sync.html') } } } };
});
