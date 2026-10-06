// Where this device's notes live, and keeping them synced there.
//
// Without a connection, notes stay in this browser only. Connected to Google
// Drive, they're also Markdown files in a Drive folder: synced a moment after
// each change, every minute while the app is open, and when it comes back
// online or into view.

import type { Storage } from '../data/db';
import type { AppStore } from '../data/store';
import { DriveProvider, findFolder, findOrCreateFolder } from './drive';
import { pickFolder } from './google-picker';
import { SyncEngine, type SyncState, type SyncStatus } from './engine';
import { GoogleAuth, SignInNeeded } from './google-auth';
import { type Provider, ProviderError } from './provider';

export interface DriveConfig {
  kind: 'drive';
  clientId: string;
  folderName: string;
  folderId: string;
}

export type SyncConfig = DriveConfig;

export interface ConnectionState {
  config: SyncConfig | null;
  status: SyncStatus | null;
  /** Connecting right now (signing in, finding the folder). */
  connecting: boolean;
  /** Signed in to Google and choosing a folder; `existing` is a Crumpet folder found from before. */
  choosing: { existing: { id: string; name: string } | null } | null;
}

const CONFIG = 'config';
const STATE = 'state';
const POLL_MS = 60_000;
const DEFAULT_FOLDER = 'Crumpet';

/** Crumpet's Google OAuth client id, set when the app is built (see docs/google-drive-setup.md). Public, not a secret. */
export const BUILT_IN_CLIENT_ID: string = (import.meta.env?.VITE_GOOGLE_CLIENT_ID as string | undefined) ?? '';

export class SyncConnection {
  private state: ConnectionState = { config: null, status: null, connecting: false, choosing: null };
  private listeners = new Set<() => void>();
  private engine: SyncEngine | null = null;
  private auth: GoogleAuth | null = null;
  private stopEngine: (() => void) | null = null;
  private poll: ReturnType<typeof setInterval> | null = null;

  constructor(
    private store: AppStore,
    private storage: Storage,
    /** For tests: build the provider instead of talking to Google. */
    private makeProvider?: (config: SyncConfig) => Provider,
  ) {}

  getState = (): ConnectionState => this.state;

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  private set(patch: Partial<ConnectionState>) {
    this.state = { ...this.state, ...patch };
    for (const fn of this.listeners) fn();
  }

  /** Picks up the saved connection, if there is one, and starts syncing. */
  async init(): Promise<void> {
    const config = await this.storage.getSync<SyncConfig>(CONFIG);
    if (config) this.start(config);
  }

  /**
   * Step 1 of connecting Google Drive: signing in. Call from a click, as it
   * opens Google's sign-in window. Then choose a folder with useFolder().
   */
  async signInToGoogle(): Promise<void> {
    if (!BUILT_IN_CLIENT_ID) throw new ProviderError('Google sign-in isn’t set up in this copy of Crumpet.', 'other');
    this.set({ connecting: true });
    try {
      const auth = new GoogleAuth(BUILT_IN_CLIENT_ID);
      await auth.signIn().catch((e) => {
        throw new ProviderError(e instanceof Error ? e.message : String(e), 'auth');
      });
      this.auth = auth;
      const id = await findFolder(DEFAULT_FOLDER, this.tokenFn(auth));
      this.set({ choosing: { existing: id ? { id, name: DEFAULT_FOLDER } : null } });
    } finally {
      this.set({ connecting: false });
    }
  }

  /** Step 2: keep the notes in a folder: the one found, one picked, or a new "Crumpet" folder. */
  async useFolder(folder: { id: string; name: string } | 'new'): Promise<void> {
    const auth = this.auth;
    if (!auth) throw new ProviderError('Sign in to Google first.', 'auth');
    this.set({ connecting: true });
    try {
      const chosen = folder === 'new' ? { id: await findOrCreateFolder(DEFAULT_FOLDER, this.tokenFn(auth)), name: DEFAULT_FOLDER } : folder;
      const config: DriveConfig = { kind: 'drive', clientId: auth.clientId, folderName: chosen.name, folderId: chosen.id };
      // A different folder means starting fresh: nothing agreed with it yet.
      const old = await this.storage.getSync<SyncConfig>(CONFIG);
      if (!old || old.folderId !== chosen.id) await this.storage.deleteSync(STATE);
      await this.storage.putSync(CONFIG, config);
      this.set({ choosing: null });
      this.start(config);
    } finally {
      this.set({ connecting: false });
    }
  }

  /** Opens Google's folder picker (call from a click). Picking a folder gives Crumpet access to it. */
  async pickFolder(): Promise<void> {
    if (!this.auth) throw new ProviderError('Sign in to Google first.', 'auth');
    const folder = await pickFolder(await this.auth.getToken());
    if (folder) await this.useFolder(folder);
  }

  /** Stops choosing a folder without connecting. */
  cancelChoosing(): void {
    if (!this.state.config) {
      this.auth?.signOut();
      this.auth = null;
    }
    this.set({ choosing: null });
  }

  /** Signs in again after Google asked (call from a click), then syncs. */
  async reconnect(): Promise<void> {
    if (!this.auth) return;
    await this.auth.signIn();
    await this.syncNow();
  }

  /** Stops syncing. Notes stay on this device, and the files stay where they are. */
  async disconnect(): Promise<void> {
    this.stop();
    this.auth?.signOut();
    this.auth = null;
    await this.storage.deleteSync(CONFIG);
    await this.storage.deleteSync(STATE);
    this.set({ config: null, status: null });
  }

  syncNow(): Promise<void> {
    return this.engine ? this.engine.sync().catch(() => {}) : Promise.resolve();
  }

  private start(config: SyncConfig): void {
    this.stop();
    let provider: Provider;
    if (this.makeProvider) provider = this.makeProvider(config);
    else {
      this.auth ??= new GoogleAuth(config.clientId);
      provider = new DriveProvider({ getToken: this.tokenFn(this.auth), rootId: config.folderId });
    }
    const engine = new SyncEngine(this.store, provider, {
      load: () => this.storage.getSync<SyncState>(STATE),
      save: (s) => this.storage.putSync(STATE, s),
    });
    this.engine = engine;
    const off = engine.subscribe(() => this.set({ status: engine.getStatus() }));
    engine.watch();
    const kick = () => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') engine.sync().catch(() => {});
    };
    this.poll = setInterval(kick, POLL_MS);
    if (typeof window !== 'undefined') {
      window.addEventListener('online', kick);
      document.addEventListener('visibilitychange', kick);
    }
    this.stopEngine = () => {
      off();
      engine.stop();
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', kick);
        document.removeEventListener('visibilitychange', kick);
      }
    };
    this.set({ config, status: engine.getStatus() });
    engine.sync().catch(() => {});
  }

  private stop(): void {
    this.stopEngine?.();
    this.stopEngine = null;
    if (this.poll) clearInterval(this.poll);
    this.poll = null;
    this.engine = null;
  }

  private tokenFn(auth: GoogleAuth) {
    return async (fresh?: boolean) => {
      try {
        return await auth.getToken(fresh);
      } catch (e) {
        if (e instanceof SignInNeeded) throw new ProviderError('Google Drive needs you to sign in again.', 'auth');
        throw new ProviderError(e instanceof Error ? e.message : String(e), 'offline');
      }
    };
  }
}
