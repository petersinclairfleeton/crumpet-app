// Writes crumpet-web.json, the label on Crumpet's own files (the built web
// app): their version, and the fingerprint of the window around them (`shell`:
// every file in desktop/ that goes into the Mac and Windows apps). It goes
// inside the build (so each app knows its own window's fingerprint) and beside
// it in the release, so an app can tell whether the newest Crumpet needs only
// these files (the same window: a small download) or the whole app.
//
//   node desktop/web-manifest.mjs 1.1.40 > app/dist/crumpet-web.json

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Files in desktop/ that don't go into the apps. */
const LEFT_OUT = /(\.test\.cjs|release-notes\.mjs|web-manifest\.mjs|\.gitignore)$/;

const version = process.argv[2];
if (!/^\d+\.\d+\.\d+$/.test(version ?? '')) {
  console.error('Usage: node desktop/web-manifest.mjs <version>');
  process.exit(1);
}
// Git's own fingerprints of the files as committed (the same on every computer, whatever its line endings).
const files = execFileSync('git', ['ls-files', '-s', '--full-name', '--', '.'], { encoding: 'utf8', cwd: dirname(fileURLToPath(import.meta.url)) })
  .split('\n')
  .filter((line) => line && !LEFT_OUT.test(line));
if (!files.some((line) => line.endsWith('desktop/main.cjs'))) {
  console.error('The desktop app’s files weren’t found');
  process.exit(1);
}
const shell = createHash('sha256').update(files.join('\n')).digest('hex');
process.stdout.write(`${JSON.stringify({ version, shell })}\n`);
