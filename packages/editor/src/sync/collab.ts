// A minimal sync setup: one server holding the authoritative, ordered list of
// ops, and a client per device. A client keeps the last state it knows the
// server agreed on ("confirmed"), plus its own edits the server hasn't
// accepted yet ("pending"). When it hears about other devices' edits it
// rewrites its pending edits to sit on top of them, then sends them.
//
// The server only accepts a batch built on its latest version, so every
// device applies the same ops in the same order and ends up identical.

import type { Doc } from '../model';
import { type Op, applyOps, compressOps } from '../ops';
import { type Step, rebase } from './transform';

export interface LoggedOp {
  op: Op;
  client: string;
}

export class SyncServer {
  readonly log: LoggedOp[] = [];
  doc: Doc;

  constructor(doc: Doc) {
    this.doc = doc;
  }

  get version(): number {
    return this.log.length;
  }

  /** Accepts ops built on `version`; returns false if the client is behind and must pull first. */
  receive(client: string, version: number, ops: Op[]): boolean {
    if (version !== this.version) return false;
    this.doc = applyOps(this.doc, ops); // throws (and rejects the batch) if an op doesn't apply
    for (const op of ops) this.log.push({ op, client });
    return true;
  }

  since(version: number): LoggedOp[] {
    return this.log.slice(version);
  }
}

export class SyncClient {
  confirmed: Doc;
  version: number;
  pending: Op[] = [];
  doc: Doc;
  online = true;

  constructor(
    readonly id: string,
    private server: SyncServer,
  ) {
    this.confirmed = server.doc;
    this.version = server.version;
    this.doc = server.doc;
  }

  /** Record edits made on this device (already applied to `doc` by the editor). */
  local(ops: Op[], docAfter: Doc): void {
    this.pending = compressOps([...this.pending, ...ops]);
    this.doc = docAfter;
  }

  /**
   * Fetches other devices' ops and rebases pending edits on top of them.
   * Returns the steps that turn this device's old document into the new one
   * (for moving the caret and the undo history), or null if nothing arrived.
   */
  pull(): Step[] | null {
    if (!this.online) return null;
    const incoming = this.server.since(this.version).map((l) => l.op);
    if (!incoming.length) return null;
    const result = rebase(this.confirmed, this.pending, incoming);
    this.confirmed = applyOps(this.confirmed, incoming);
    this.version += incoming.length;
    this.pending = result.local;
    this.doc = result.doc;
    this.dropped += result.dropped;
    return result.steps;
  }

  /** Pending ops that had to be dropped because they no longer applied (should stay 0). */
  dropped = 0;

  /** Sends pending edits. Returns true when everything is confirmed. */
  push(): boolean {
    if (!this.online) return false;
    if (!this.pending.length) return true;
    if (!this.server.receive(this.id, this.version, this.pending)) return false;
    this.confirmed = applyOps(this.confirmed, this.pending);
    this.version += this.pending.length;
    this.pending = [];
    return true;
  }

  /** Pull then push until confirmed (another device may push in between). Returns all the steps pulled. */
  sync(): Step[] | null {
    const steps: Step[] = [];
    let pulled = false;
    for (let i = 0; i < 10; i++) {
      const s = this.pull();
      if (s) {
        steps.push(...s);
        pulled = true;
      }
      if (this.push()) break;
    }
    return pulled ? steps : null;
  }
}
