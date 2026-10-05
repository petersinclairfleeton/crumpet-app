// Device-test recorder: logs every input-related event the browser sends,
// whether the editor cancelled it, and checks after each one that the page
// still shows exactly what the model holds. On a real phone this is how we
// find out what its keyboard does and whether anything slipped past us.

import type { Editor } from './editor';
import { runsText } from './model';

export interface TraceEntry {
  t: number;
  ev: string;
  inputType?: string;
  data?: string | null;
  key?: string;
  composing?: boolean;
  prevented?: boolean;
  problem?: string;
}

const MAX = 400;

export class Recorder {
  readonly entries: TraceEntry[] = [];
  problems = 0;
  private start = performance.now();
  private composing = false;
  private checkQueued = false;
  private listeners: (() => void)[] = [];

  constructor(private editor: Editor) {
    const root = editor.view.root;
    // Registered after the editor's own listeners, so defaultPrevented tells us whether it cancelled the event.
    root.addEventListener('beforeinput', (e) => {
      this.push({ ev: 'beforeinput', inputType: e.inputType, data: e.data, composing: e.isComposing, prevented: e.defaultPrevented });
      this.queueCheck();
    });
    root.addEventListener('input', (e) => {
      const ie = e as InputEvent;
      this.push({ ev: 'input', inputType: ie.inputType, data: ie.data, composing: ie.isComposing });
      this.queueCheck();
    });
    root.addEventListener('keydown', (e) => {
      this.push({ ev: 'keydown', key: e.key === ' ' ? 'Space' : e.key, composing: e.isComposing, prevented: e.defaultPrevented });
    });
    for (const type of ['compositionstart', 'compositionupdate', 'compositionend'] as const) {
      root.addEventListener(type, (e) => {
        this.composing = type !== 'compositionend';
        this.push({ ev: type, data: (e as CompositionEvent).data });
        if (type === 'compositionend') this.queueCheck();
      });
    }
    for (const type of ['paste', 'cut', 'copy'] as const) {
      root.addEventListener(type, () => {
        this.push({ ev: type });
        this.queueCheck();
      });
    }
  }

  onUpdate(fn: () => void): void {
    this.listeners.push(fn);
  }

  clear(): void {
    this.entries.length = 0;
    this.problems = 0;
    this.start = performance.now();
    this.emit();
  }

  private push(e: Omit<TraceEntry, 't'>): void {
    this.entries.push({ t: Math.round(performance.now() - this.start), ...e });
    if (this.entries.length > MAX) this.entries.splice(0, this.entries.length - MAX);
    this.emit();
  }

  private emit(): void {
    for (const fn of this.listeners) fn();
  }

  /** Runs after the editor has finished reacting (including the IME read-back microtask). */
  private queueCheck(): void {
    if (this.checkQueued) return;
    this.checkQueued = true;
    setTimeout(() => {
      this.checkQueued = false;
      this.check();
    }, 0);
  }

  check(): void {
    if (this.composing) return;
    const { state, view } = this.editor;
    if (!view.structureIntact(state.doc)) {
      this.problem('Page blocks no longer match the model blocks');
      return;
    }
    for (const b of state.doc.blocks) {
      const dom = view.blockText(b.id);
      const model = runsText(b.runs);
      if (dom !== model) this.problem(`Text differs in ${b.id}: page ${JSON.stringify(dom)} vs model ${JSON.stringify(model)}`);
    }
    const sel = view.readSelection();
    const m = state.selection;
    if (sel && (sel.focus.block !== m.focus.block || sel.focus.offset !== m.focus.offset)) {
      this.problem(`Caret differs: page ${sel.focus.block}:${sel.focus.offset} vs model ${m.focus.block}:${m.focus.offset}`);
    }
  }

  private problem(text: string): void {
    this.problems += 1;
    this.push({ ev: 'PROBLEM', problem: text });
  }

  report(): string {
    return JSON.stringify(
      {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        maxTouchPoints: navigator.maxTouchPoints,
        language: navigator.language,
        problems: this.problems,
        doc: this.editor.state.doc.blocks.map((b) => ({ type: b.type, text: runsText(b.runs) })),
        events: this.entries,
      },
      null,
      1,
    );
  }

  /** One short line per event for the on-screen log. */
  static describe(e: TraceEntry): string {
    if (e.problem) return `${e.t} ⚠ ${e.problem}`;
    const parts = [String(e.t), e.ev];
    if (e.inputType) parts.push(e.inputType);
    if (e.key) parts.push(e.key);
    if (e.data != null) parts.push(JSON.stringify(e.data));
    if (e.composing) parts.push('(composing)');
    if (e.prevented) parts.push('✓handled');
    return parts.join(' ');
  }
}
