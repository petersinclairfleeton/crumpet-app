# Crumpet with Claude and other AIs (MCP)

Crumpet has an MCP server: a small program on your computer that lets an AI
app (Claude, ChatGPT, Gemini, Cursor and others that support the Model
Context Protocol) work with your notes. The AI can:

- **search** your notes, book chapters and research notes;
- **list** notes (latest first, by notebook or tag), notebooks and tags, and books;
- **read** a note or chapter, and a book's outline (chapters in order with
  parts, status and synopses, characters and places, research);
- **write new notes**, in the Inbox, a notebook or a book's research.

It can't change or delete anything you've written. Notes locked with a
password stay locked.

## What it needs

The server reads the folder Crumpet syncs to, so first, in Crumpet's
Settings (Account & sync, or Sync and storage), choose **A folder on this
computer** (Chrome or Edge, or the Mac app). Crumpet keeps that folder up to
date, and notes the AI writes come into Crumpet at its next sync.

If you sync with Google Drive instead, and have Google Drive for desktop, the
AI can read your Crumpet folder in it (on a Mac under
`~/Library/CloudStorage/GoogleDrive-…/My Drive/`). But notes it writes there
won't show in Crumpet: Google only lets Crumpet see files Crumpet made.

## Claude for desktop

1. Download **[Crumpet.mcpb](https://github.com/petersinclairfleeton/crumpet-app/releases/latest/download/Crumpet.mcpb)**
   (also in Crumpet: Settings → Clipper & app, or Clipper and Mac app → Add to Claude).
2. Open it: Claude for desktop asks to install Crumpet.
3. Choose your Crumpet folder when it asks, and turn it on.
4. Ask Claude, for example: “What have I written about Rome?”, “Summarise
   chapter 3 of The Storm”, “Make a note in Travel with a packing list”.

## Claude Code

```sh
claude mcp add crumpet -- node /path/to/crumpet-mcp.mjs "/path/to/your/Crumpet folder"
```

## Other AI apps

Download **[crumpet-mcp.mjs](https://github.com/petersinclairfleeton/crumpet-app/releases/latest/download/crumpet-mcp.mjs)**
(it needs [Node.js](https://nodejs.org) 20 or later) and add it as a local
(stdio) MCP server in the app's settings. Most apps take this:

```json
{
  "mcpServers": {
    "crumpet": {
      "command": "node",
      "args": ["/path/to/crumpet-mcp.mjs", "/path/to/your/Crumpet folder"]
    }
  }
}
```

## Privacy

The server runs only on your computer and sends nothing to Crumpet. What it
reads goes to the AI app you connected it to, under that app's own privacy
policy.

## For developers

- `app/src/mcp/`: the server: `vault.ts` reads the folder (the layout in
  `sync/layout.ts`, files through `sync/notefile.ts`), `tools.ts` the tools,
  `server.ts` the protocol (JSON-RPC over stdin/stdout).
- `app/mcp/main.mjs`: the Node side (the folder, stdin and stdout).
- `cd app && node mcp/build.mjs` makes `dist-mcp/crumpet-mcp.mjs` and
  `dist-mcp/Crumpet.mcpb`; `.github/workflows/mac.yml` publishes both with
  the Mac app's release. `npx @anthropic-ai/mcpb validate dist-mcp/bundle/manifest.json`
  checks the extension.
- Tests: `tests/unit/mcp.test.ts` (including a note written by the server
  being synced into Crumpet).
- Try it: `node dist-mcp/crumpet-mcp.mjs <folder>` and type a line such as
  `{"jsonrpc":"2.0","id":1,"method":"tools/list"}`, or use the MCP Inspector
  (`npx @modelcontextprotocol/inspector node dist-mcp/crumpet-mcp.mjs <folder>`).
