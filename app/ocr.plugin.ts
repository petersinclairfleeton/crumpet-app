// Ships the OCR engine (Tesseract) and its English data with the app, under
// /ocr/, so reading text in pictures needs no other website: served from
// node_modules while developing, copied into the build otherwise.

import { createReadStream, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';

const FILES: Record<string, string> = {
  'worker.min.js': 'tesseract.js/dist/worker.min.js',
  'tesseract-core-simd-lstm.wasm.js': 'tesseract.js-core/tesseract-core-simd-lstm.wasm.js',
  'tesseract-core-lstm.wasm.js': 'tesseract.js-core/tesseract-core-lstm.wasm.js',
  'eng.traineddata.gz': '@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz',
};

export function ocrFiles(root: string): Plugin {
  const from = (name: string) => resolve(root, 'node_modules', FILES[name]);
  return {
    name: 'crumpet-ocr-files',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const m = /^\/(?:[^?]*\/)?ocr\/([^/?]+)/.exec(req.url ?? '');
        if (!m || !FILES[m[1]]) return next();
        res.setHeader('Content-Type', m[1].endsWith('.js') ? 'text/javascript' : 'application/octet-stream');
        createReadStream(from(m[1])).pipe(res);
      });
    },
    generateBundle() {
      for (const name of Object.keys(FILES)) this.emitFile({ type: 'asset', fileName: `ocr/${name}`, source: readFileSync(from(name)) });
    },
  };
}
