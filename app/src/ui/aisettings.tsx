// Settings: using Crumpet's notes with Claude and other AI apps, through
// Crumpet's MCP server (src/mcp/, built by mcp/build.mjs and published with
// the Mac app's release). It reads the folder Crumpet syncs to.

import { SettingGroup, SettingRow } from './settingrows';

const RELEASE = 'https://github.com/petersinclairfleeton/crumpet-app/releases/latest/download';
/** Claude for desktop's extension: opening it installs Crumpet there. */
export const MCP_DOWNLOAD = `${RELEASE}/Crumpet.mcpb`;
export const MCP_HELP = 'https://github.com/petersinclairfleeton/crumpet-app/blob/main/docs/mcp.md';

export function AiSettings() {
  return (
    <SettingGroup title="Claude and other AIs">
      <SettingRow
        title="Use your notes with Claude"
        hint="Claude for desktop can search and read your notes and books, and write new notes; it never changes or deletes what you’ve written. Open the download to add it, then choose the folder Crumpet syncs to (A folder on this computer, in sync settings)."
      >
        <a className="btn" href={MCP_DOWNLOAD}>
          Add to Claude
        </a>
      </SettingRow>
      <SettingRow title="Other AI apps" hint="ChatGPT, Gemini, Cursor and other apps that support MCP can use Crumpet’s server too (crumpet-mcp.mjs, which needs Node.js).">
        <a className="btn quiet" href={MCP_HELP} target="_blank" rel="noreferrer">
          How to set it up
        </a>
      </SettingRow>
    </SettingGroup>
  );
}
