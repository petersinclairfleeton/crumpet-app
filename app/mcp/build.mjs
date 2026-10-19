// Builds Crumpet's MCP server: `node mcp/build.mjs` (from app/) makes
//   dist-mcp/crumpet-mcp.mjs   the server in one file, for any AI app (node crumpet-mcp.mjs <folder>)
//   dist-mcp/Crumpet.mcpb      the same as a Claude extension: open it with Claude for desktop to install
// The .mcpb is a zip of manifest.json (made here, with the tools from src/mcp/tools.ts), the icon and the server.

import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'rolldown';

const app = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(app, 'dist-mcp');
const pack = join(out, 'bundle');
rmSync(out, { recursive: true, force: true });
mkdirSync(join(pack, 'server'), { recursive: true });

const bundle = (input, file) => build({ input, platform: 'node', write: true, output: { file, format: 'esm', codeSplitting: false } });
await bundle(join(app, 'mcp/main.mjs'), join(out, 'crumpet-mcp.mjs'));
await bundle(join(app, 'src/mcp/server.ts'), join(out, 'tools.tmp.mjs'));
const { TOOLS, SERVER_VERSION } = await import(pathToFileURL(join(out, 'tools.tmp.mjs')).href);
rmSync(join(out, 'tools.tmp.mjs'));

const manifest = {
  manifest_version: '0.2',
  name: 'crumpet',
  display_name: 'Crumpet',
  version: SERVER_VERSION,
  description: 'Search and read your Crumpet notes and books, and write new notes.',
  long_description:
    'Lets Claude find and read the notes, notebooks, tags and books (chapters, characters and places, research) in the folder Crumpet syncs to, and write new notes there. It never changes or deletes what you have written. New notes show in Crumpet after its next sync with the folder.',
  author: { name: 'Peter Sinclair-Fleeton', url: 'https://petersinclairfleeton.github.io/crumpet-app/' },
  homepage: 'https://petersinclairfleeton.github.io/crumpet-app/',
  icon: 'icon.png',
  server: {
    type: 'node',
    entry_point: 'server/crumpet-mcp.mjs',
    mcp_config: { command: 'node', args: ['${__dirname}/server/crumpet-mcp.mjs'], env: { CRUMPET_FOLDER: '${user_config.folder}' } },
  },
  tools: TOOLS.map((t) => ({ name: t.name, description: t.description })),
  user_config: {
    folder: {
      type: 'directory',
      title: 'Crumpet folder',
      description: 'The folder Crumpet syncs your notes to (Settings → Account & sync).',
      required: true,
    },
  },
  compatibility: { platforms: ['darwin', 'win32', 'linux'], runtimes: { node: '>=20.0.0' } },
  privacy_policies: ['https://petersinclairfleeton.github.io/crumpet-app/privacy.html'],
};
writeFileSync(join(pack, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
copyFileSync(join(app, 'public/brand/mark.png'), join(pack, 'icon.png'));
copyFileSync(join(out, 'crumpet-mcp.mjs'), join(pack, 'server/crumpet-mcp.mjs'));
execFileSync('zip', ['-q', '-r', '-X', join(out, 'Crumpet.mcpb'), 'manifest.json', 'icon.png', 'server'], { cwd: pack });
console.log(`Built ${join(out, 'crumpet-mcp.mjs')} and ${join(out, 'Crumpet.mcpb')}`);
