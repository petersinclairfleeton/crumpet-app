// The Model Context Protocol (modelcontextprotocol.io), as Crumpet speaks it:
// JSON-RPC messages, one per line over stdin and stdout. Any AI app that
// supports MCP (Claude, ChatGPT, Gemini, Cursor…) can start it and use its
// tools.

import { TOOLS, callTool } from './tools';
import type { Folder } from './vault';

export { TOOLS };

export const SERVER_NAME = 'crumpet';
export const SERVER_VERSION = '1.0.0';
const VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];

const INSTRUCTIONS =
  'Crumpet is a writing app. These tools reach the person’s notes (in notebooks and stacks, with tags; the Inbox holds notes in no notebook) and books (chapters in order, with parts, characters and places, and research notes). Search or list first, then read by path. create_note writes a new note; nothing can be changed or deleted.';

interface Message {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
}

type Reply = { jsonrpc: '2.0'; id: string | number | null; result?: unknown; error?: { code: number; message: string } };

/** Answers one message; null for notifications (which get no answer). */
export async function handle(msg: Message, folder: Folder): Promise<Reply | null> {
  const id = msg.id ?? null;
  const ok = (result: unknown): Reply => ({ jsonrpc: '2.0', id, result });
  const err = (code: number, message: string): Reply => ({ jsonrpc: '2.0', id, error: { code, message } });
  if (typeof msg !== 'object' || msg === null || typeof msg.method !== 'string') return msg && 'id' in msg ? err(-32600, 'Invalid request') : null;
  if (msg.id === undefined) return null;
  switch (msg.method) {
    case 'initialize': {
      const asked = typeof msg.params?.protocolVersion === 'string' ? msg.params.protocolVersion : '';
      return ok({
        protocolVersion: VERSIONS.includes(asked) ? asked : VERSIONS[0],
        capabilities: { tools: {} },
        serverInfo: { name: SERVER_NAME, title: 'Crumpet', version: SERVER_VERSION },
        instructions: INSTRUCTIONS,
      });
    }
    case 'ping':
      return ok({});
    case 'tools/list':
      return ok({ tools: TOOLS });
    case 'tools/call': {
      const name = typeof msg.params?.name === 'string' ? msg.params.name : '';
      if (!TOOLS.some((t) => t.name === name)) return err(-32602, `Unknown tool: ${name}`);
      const args = msg.params?.arguments && typeof msg.params.arguments === 'object' ? (msg.params.arguments as Record<string, unknown>) : {};
      return ok(await callTool(folder, name, args));
    }
    case 'resources/list':
      return ok({ resources: [] });
    case 'prompts/list':
      return ok({ prompts: [] });
    default:
      return err(-32601, `Method not found: ${msg.method}`);
  }
}

/** Reads newline-separated messages from `chunks` and writes each answer as a line. */
export async function serve(chunks: AsyncIterable<string>, write: (line: string) => void, folder: Folder): Promise<void> {
  let buf = '';
  const one = async (line: string) => {
    if (!line.trim()) return;
    let msg: Message;
    try {
      msg = JSON.parse(line) as Message;
    } catch {
      write(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }));
      return;
    }
    const reply = await handle(msg, folder).catch((e: unknown): Reply => ({ jsonrpc: '2.0', id: msg.id ?? null, error: { code: -32603, message: e instanceof Error ? e.message : String(e) } }));
    if (reply) write(JSON.stringify(reply));
  };
  for await (const chunk of chunks) {
    buf += chunk;
    let at: number;
    while ((at = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, at);
      buf = buf.slice(at + 1);
      await one(line);
    }
  }
  await one(buf);
}
