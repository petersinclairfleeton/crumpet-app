// Crumpet's MCP server, for Node: `node crumpet-mcp.mjs <folder>` (or the
// folder in CRUMPET_FOLDER). The folder is the one Crumpet syncs to. Built
// into one file with the app's code by build.mjs.

import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { serve } from '../src/mcp/server';

let root = process.argv[2] || process.env.CRUMPET_FOLDER || '';
if (root.startsWith('~')) root = join(homedir(), root.slice(1));
root = resolve(root || '.');
if (!existsSync(root) || !statSync(root).isDirectory()) {
  process.stderr.write(`Crumpet: there's no folder at ${root}. Give the folder Crumpet syncs to: node crumpet-mcp.mjs /path/to/folder\n`);
  process.exit(1);
}

/** A path inside the folder, never outside it. */
function inside(path) {
  const full = resolve(root, path);
  if (full !== root && !full.startsWith(root + sep)) throw new Error('That path is outside the Crumpet folder.');
  return full;
}

const folder = {
  async list() {
    const out = [];
    const walk = async (dir) => {
      let items;
      try {
        items = await readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const it of items) {
        if (it.name.startsWith('.') || it.name === 'node_modules') continue;
        const full = join(dir, it.name);
        if (it.isDirectory()) await walk(full);
        else if (it.isFile() && /\.(md|json)$/i.test(it.name)) {
          const s = await stat(full).catch(() => null);
          if (s) out.push({ path: relative(root, full).split(sep).join('/'), mtime: s.mtimeMs });
        }
      }
    };
    await walk(root);
    return out;
  },
  read: (path) => readFile(inside(path), 'utf8'),
  async create(path, text) {
    const full = inside(path);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, text, { encoding: 'utf8', flag: 'wx' });
  },
};

process.stdin.setEncoding('utf8');
process.stderr.write(`Crumpet: serving the notes in ${root}\n`);
serve(process.stdin, (line) => process.stdout.write(`${line}\n`), folder).catch((e) => {
  process.stderr.write(`Crumpet: ${e?.stack ?? e}\n`);
  process.exit(1);
});
