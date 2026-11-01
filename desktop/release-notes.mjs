// The words on a desktop release's GitHub page: how to install it on a Mac
// and on Windows, then the newest entries of the app's What's new
// (app/src/data/whatsnew.ts). Run by .github/workflows/desktop.yml:
//   node --experimental-strip-types desktop/release-notes.mjs 1.1.3 > notes.md

import { WHATS_NEW } from '../app/src/data/whatsnew.ts';

const version = process.argv[2] ?? '';
const NEWEST = 4;

const lines = [
  `Crumpet ${version}: notes and writing, free for Mac and Windows.`,
  '',
  '## Install it',
  '',
  '**Mac** (Apple silicon and Intel): download **Crumpet-Mac.dmg**, open it, and drag Crumpet into Applications. The first time you open it, macOS says it can’t check it: open System Settings → Privacy & Security, scroll down, and click **Open Anyway**. (It isn’t signed with an Apple Developer ID yet.)',
  '',
  '**Windows** (Windows 10 and 11): download **Crumpet-Windows.exe** and open it; Crumpet installs itself (no administrator needed) and opens, with shortcuts on the Start menu and the desktop. The first time, Windows may say “Windows protected your PC”: click **More info**, then **Run anyway**. (It isn’t signed with a code-signing certificate yet.)',
  '',
  'Already have Crumpet? Install the new one over it: your notes stay as they are. The app tells you when a newer version is out (Help → Check for a Newer Version).',
  '',
  'Your notes are kept on the computer. To have them on your other devices too, choose Settings → Sync and storage → **Continue with Google** (the same Google Drive folder as the website), or “A folder on this computer”.',
  '',
  '**Claude and other AIs:** open **Crumpet.mcpb** with Claude for desktop to let Claude search and read your notes and books and write new notes, from the folder Crumpet syncs to. Other AI apps that support MCP can run **crumpet-mcp.mjs** (`node crumpet-mcp.mjs /path/to/folder`).',
  '',
  '## What’s new lately',
  '',
];
for (const entry of WHATS_NEW.slice(0, NEWEST)) {
  lines.push(`### ${entry.title} (${entry.date})`, '');
  for (const point of entry.points) lines.push(`- ${point}`);
  lines.push('');
}
process.stdout.write(lines.join('\n'));
