// Where this device's notes live, and keeping them synced there.
//
// Without a connection, notes stay in this browser only. Connected to Google
// Drive, they're also Markdown files in a Drive folder: synced a moment after
// each change, every minute while the app is open, and when it comes back
// online or into view.

import type { Storage } from '../data/db';
import type { AppStore } from '../data/store';
import { DriveProvider, findOrCreateFolder } from './drive';
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
}

const CONFIG = 'config';
const STATE = 'state';
const POLL_MS = 60_000;

/** The Google OAuth client id built into this copy of Crumpet, if any (see docs/google-drive-setup.md). */
export const BUILT_IN_CLIENT_ID: string = (import.meta.env?.VITE_GOOGLE_CLIENT_ID as string | undefined) ?? '';

export class SyncConnection {
  private state: ConnectionState = { config: null, status: null, connecting: false };
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

  /** Connects to Google Drive. Call from a click: it opens Google's sign-in window. */
  async connectDrive(clientId: string, folderName: string): Promise<void> {
    this.set({ connecting: true });
    try {
      const auth = new GoogleAuth(clientId.trim());
      await auth.signIn().catch((e) => {
        throw new ProviderError(e instanceof Error ? e.message : String(e), 'auth');
      });
      const name = folderName.trim() || 'Crumpet';
      const folderId = await findOrCreateFolder(name, this.tokenFn(auth));
      const config: DriveConfig = { kind: 'drive', clientId: clientId.trim(), folderName: name, folderId };
      // A different folder means starting fresh: nothing agreed with it yet.
      const old = await this.storage.getSync<SyncConfig>(CONFIG);
      if (!old || old.folderId !== folderId) await this.storage.deleteSync(STATE);
      await this.storage.putSync(CONFIG, config);
      this.auth = auth;
      this.start(config);
    } finally {
      this.set({ connecting: false });
    }
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
