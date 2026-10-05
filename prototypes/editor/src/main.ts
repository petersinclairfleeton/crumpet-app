import { type Doc, makeBlock } from './model';
import type { BlockType, Mark } from './model';
import { Editor } from './editor';

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
const inputsEl = document.getElementById('inputs')!;
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
  inputsEl.textContent = editor.inputLog.slice(-20).join('\n');
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
    else if (btn.dataset.cmd === 'undo') editor.undo();
    else if (btn.dataset.cmd === 'redo') editor.redo();
    else if (btn.dataset.cmd === 'reset') {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* ignore */
      }
      location.search = '?fresh';
    } else if (btn.dataset.cmd === 'debug') {
      debugEl.hidden = !debugEl.hidden;
      btn.setAttribute('aria-pressed', String(!debugEl.hidden));
    }
  });
}

refresh();
editor.focus();
