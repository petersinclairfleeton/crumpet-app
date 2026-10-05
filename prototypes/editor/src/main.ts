import { type Doc, makeBlock } from '@crumpet/editor/model';
import type { BlockType, Mark } from '@crumpet/editor/model';
import { Editor } from '@crumpet/editor/editor';
import { Recorder } from '@crumpet/editor/recorder';

const STORAGE_KEY = 'crumpet-editor-prototype-doc';

function sampleDoc(): Doc {
  return {
    blocks: [
      makeBlock('heading1', 'Opening scene, first pass'),
      {
        ...makeBlock('paragraph'),
        runs: [
          { text: 'She counted the steps every night: ', marks: [] },
          { text: 'one hundred and twelve', marks: ['bold'] },
          { text: ', and the last one always creaked as if it had ', marks: [] },
          { text: 'something to say', marks: ['italic'] },
          { text: '.', marks: [] },
        ],
      },
      makeBlock('quote', 'Maybe the visitor is her brother, the one the village thinks drowned.'),
      makeBlock('heading2', 'Things to work out'),
      makeBlock('todo', 'Why does she stay on the island?', [], { checked: true }),
      makeBlock('todo', 'Who climbed the stairs?', [], { checked: false }),
      makeBlock('paragraph'),
    ],
  };
}

function loadDoc(): Doc {
  const params = new URLSearchParams(location.search);
  if (params.has('blank')) return { blocks: [makeBlock('paragraph')] };
  if (params.has('fresh')) return sampleDoc();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const doc = JSON.parse(raw) as Doc;
      if (doc.blocks?.length) return doc;
    }
  } catch {
    /* storage unavailable: start from the sample */
  }
  return sampleDoc();
}

const root = document.getElementById('editor')!;
const editor = new Editor(root, loadDoc());
(window as unknown as { editor: Editor }).editor = editor;

const modelEl = document.getElementById('model')!;
const opsEl = document.getElementById('ops')!;
const debugEl = document.getElementById('debug')!;
const opLog: string[] = [];

function describeDoc(doc: Doc): string {
  return doc.blocks
    .map((b) => {
      const runs = b.runs.map((r) => (r.marks.length ? `[${r.marks.join('+')}]${JSON.stringify(r.text)}` : JSON.stringify(r.text))).join(' ');
      const check = b.type === 'todo' ? (b.checked ? ' ☑' : ' ☐') : '';
      return `${b.id} ${b.type}${check}: ${runs || '∅'}`;
    })
    .join('\n');
}

function refresh() {
  const s = editor.state;
  const sel = s.selection;
  modelEl.textContent = `${describeDoc(s.doc)}\n\nselection ${sel.anchor.block}:${sel.anchor.offset} → ${sel.focus.block}:${sel.focus.offset}${s.storedMarks ? `\nstored marks: ${s.storedMarks.join(', ') || 'none'}` : ''}`;
  opsEl.textContent = opLog.slice(-25).join('\n');
  for (const btn of document.querySelectorAll<HTMLButtonElement>('[data-mark]')) {
    btn.classList.toggle('active', editor.isMarkActive(btn.dataset.mark as Mark));
  }
  const type = editor.currentBlock().type;
  for (const btn of document.querySelectorAll<HTMLButtonElement>('[data-block]')) {
    btn.classList.toggle('active', btn.dataset.block === type);
  }
  document.querySelector<HTMLButtonElement>('[data-cmd="undo"]')!.disabled = !editor.history.canUndo;
  document.querySelector<HTMLButtonElement>('[data-cmd="redo"]')!.disabled = !editor.history.canRedo;
}

editor.onChange((state, change) => {
  if (change) {
    for (const op of change.ops) opLog.push(`${change.source}: ${JSON.stringify(op)}`);
    if (opLog.length > 200) opLog.splice(0, opLog.length - 200);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.doc));
    } catch {
      /* not persisted; fine for a prototype */
    }
  }
  refresh();
});

for (const btn of document.querySelectorAll<HTMLButtonElement>('.toolbar button')) {
  // Keep focus (and the selection) in the editor when clicking toolbar buttons.
  btn.addEventListener('mousedown', (e) => e.preventDefault());
  btn.addEventListener('click', () => {
    if (btn.dataset.mark) editor.toggleMark(btn.dataset.mark as Mark);
    else if (btn.dataset.block) editor.setBlockType(btn.dataset.block as BlockType);
    else if (btn.dataset.cmd === 'link') openLinkBar();
    else if (btn.dataset.cmd === 'undo') editor.undo();
    else if (btn.dataset.cmd === 'redo') editor.redo();
    else if (btn.dataset.cmd === 'reset') {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* ignore */
      }
      editor.load(sampleDoc());
      recorder.clear();
    } else if (btn.dataset.cmd === 'debug') {
      debugEl.hidden = !debugEl.hidden;
      btn.setAttribute('aria-pressed', String(!debugEl.hidden));
    }
  });
}

// ---- link editor (⌘K or the toolbar button) ----
const linkBar = document.getElementById('linkbar') as HTMLFormElement;
const linkInput = document.getElementById('link-input') as HTMLInputElement;
const linkError = document.getElementById('link-error')!;

function openLinkBar() {
  const current = editor.currentLink();
  const sel = editor.currentSelection();
  const collapsed = sel.anchor.block === sel.focus.block && sel.anchor.offset === sel.focus.offset;
  if (collapsed && !current) {
    linkBar.hidden = false;
    linkInput.value = '';
    linkError.textContent = 'Select some text first, then add a link to it.';
    return;
  }
  linkBar.hidden = false;
  linkError.textContent = '';
  linkInput.value = current ?? '';
  linkInput.focus();
  linkInput.select();
}

function closeLinkBar() {
  linkBar.hidden = true;
  linkError.textContent = '';
  editor.focus();
}

linkBar.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!editor.setLink(linkInput.value || null)) {
    linkError.textContent = 'That doesn’t look like a web address. Try something like example.com.';
    return;
  }
  closeLinkBar();
});
document.getElementById('link-remove')!.addEventListener('click', () => {
  editor.setLink(null);
  closeLinkBar();
});
linkInput.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    e.preventDefault();
    closeLinkBar();
  }
});
root.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    openLinkBar();
  }
});

// ---- device-test recorder ----
const recorder = new Recorder(editor);
(window as unknown as { recorder: Recorder }).recorder = recorder;
const statusEl = document.getElementById('status')!;
const traceEl = document.getElementById('trace')!;
const reportEl = document.getElementById('report') as HTMLTextAreaElement;
let traceQueued = false;
recorder.onUpdate(() => {
  if (traceQueued) return;
  traceQueued = true;
  requestAnimationFrame(() => {
    traceQueued = false;
    traceEl.textContent = recorder.entries.slice(-40).map(Recorder.describe).reverse().join('\n');
    statusEl.textContent = recorder.problems ? `${recorder.problems} problem${recorder.problems === 1 ? '' : 's'} seen: see the log` : 'No problems seen yet';
    statusEl.className = `status ${recorder.problems ? 'bad' : 'ok'}`;
  });
});
document.getElementById('copy-report')!.addEventListener('click', async (e) => {
  const btn = e.currentTarget as HTMLButtonElement;
  try {
    await navigator.clipboard.writeText(recorder.report());
    btn.textContent = 'Copied';
  } catch {
    // Clipboard blocked (e.g. inside an embedded page): show it to select by hand instead.
    reportEl.hidden = false;
    reportEl.value = recorder.report();
    reportEl.select();
    btn.textContent = 'Select the text below';
  }
  setTimeout(() => (btn.textContent = 'Copy report'), 2500);
});
document.getElementById('show-report')!.addEventListener('click', () => {
  reportEl.hidden = !reportEl.hidden;
  reportEl.value = recorder.report();
});
document.getElementById('clear-log')!.addEventListener('click', () => recorder.clear());

refresh();
editor.focus();
