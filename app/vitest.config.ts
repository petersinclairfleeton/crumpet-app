import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { alias: { '@crumpet/editor': resolve(__dirname, '../packages/editor/src') } },
  test: { include: ['tests/unit/**/*.test.ts'], setupFiles: ['fake-indexeddb/auto'] },
});
