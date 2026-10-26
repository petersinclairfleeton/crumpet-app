// Crumpet's own right-click menu, everywhere the app hasn't a menu of its own
// (notes in the list, notebooks, tags, tabs and drafts have theirs), so the
// browser's never shows. In the writing: spelling suggestions, cut, copy,
// paste, link, comment and look up; in a box: cut, copy, paste; on a link or
// a picture: open, copy or save it; anywhere else: new note, find, commands,
// settings and the guide. A long press on a phone or tablet is left to it.
// In a table cell: rows, columns, merging and splitting too.

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Editor } from '@crumpet/editor/editor';
import type { Selection } from '@crumpet/editor/model';
import type { Tab } from '../data/panes';
import { speller } from '../data/spell';
import { applyFix, grammarAt, ignoreIssue } from './grammar';
import { useClips } from './clipboard';
import { openFontDialog } from './fontdialog';
import { isMac } from './editing';
import { openGuide } from './guide';
import { currentHelped } from './helpers';
import { useAppState, useAppStore } from './hooks';
import { usePanes } from './panes';
import { ParagraphDialog } from './paratools';
import { Popover } from './Sidebar';
import { ignoreWord, passedWords, useAddWord } from './spelling';
import { wordAtCaret } from './thesaurus';

const mod = isMac ? '⌘' : 'Ctrl+';

type At =
  | { kind: 'editor'; x: number; y: number; editor: Editor; word: { word: string; sel: Selection } | null; link: string | null; img: HTMLImageElement | null }
  | { kind: 'field'; x: number; y: number; field: HTMLElement; img: null; editor: Editor | null; cell: HTMLElement | null }
  | { kind: 'page'; x: number; y: number; link: string | null; img: HTMLImageElement | null; tab: Tab | null; text: string };

export interface ContextActions {
  newNote(): void;
  openFinder(): void;
  openCommands(): void;
  openSettings(): void;
}

/** A box typed in that isn't the writing: a text field, a text area, a table cell, a title. */
function fieldOf(el: Element): HTMLElement | null {
  const f = el.closest('input, textarea, [contenteditable=""], [contenteditable="true"], [data-widget] [contenteditable]') as HTMLElement | null;
  if (f instanceof HTMLInputElement && !/^(text|search|url|email|tel|password|number|)$/.test(f.type)) return null;
  return f;
}

/** What was right-clicked, and the menu for it (null leaves the browser's, which a long press needs). */
function whatsAt(e: MouseEvent): At | null {
  const el = e.target instanceof Element ? e.target : (e.target as Node | null)?.parentElement;
  if (!el) return null;
  const x = e.clientX;
  const y = e.clientY;
  const img = el.closest('img');
  const a = el.closest('a[href]') as HTMLAnchorElement | null;
  const link = a && !a.href.startsWith('javascript:') ? a.href : null;
  const h = currentHelped();
  const editor = h && h.editor.view.root.contains(el) ? h.editor : null;
  const field = fieldOf(el);
  // A table cell or a maths source in the text is a box of its own.
  if (editor && (!field || field === editor.view.root)) {
    // The caret goes where the click was, unless it was on the selected text.
    editor.currentSelection();
    const word = wordAtCaret(editor);
    return { kind: 'editor', x, y, editor, word, link: editor.currentLink() ?? link, img };
  }
  if (field) {
    const cell = editor ? (field.closest('.cell') as HTMLElement | null) : null;
    return { kind: 'field', x, y, field, img: null, editor, cell };
  }
  const tabEl = el.closest('[data-tab]');
  let tab: Tab | null = null;
  try {
    tab = tabEl ? (JSON.parse(tabEl.getAttribute('data-tab') ?? '') as Tab) : null;
  } catch {
    tab = null;
  }
  return { kind: 'page', x, y, link, img, tab, text: document.getSelection()?.toString() ?? '' };
}

/** Listens for right clicks across the app and shows Crumpet's menu. */
export function ContextMenuHost({ actions }: { actions: ContextActions }) {
  const [at, setAt] = useState<At | null>(null);
  const [para, setPara] = useState<Editor | null>(null);
  useEffect(() => {
    let touch = false;
    const onDown = (e: PointerEvent) => (touch = e.pointerType === 'touch' || e.pointerType === 'pen');
    const onMenu = (e: MouseEvent) => {
      // Menus of their own (a note in the list, a tab) have already taken it; a long press keeps the system's.
      if (e.defaultPrevented || touch) return;
      const next = whatsAt(e);
      if (!next) return;
      e.preventDefault();
      setAt(next);
    };
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('contextmenu', onMenu);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('contextmenu', onMenu);
    };
  }, []);
  useEffect(() => {
    if (!at) return;
    const close = () => setAt(null);
    window.addEventListener('resize', close);
    window.addEventListener('blur', close);
    document.addEventListener('scroll', close, true);
    return () => {
      window.removeEventListener('resize', close);
      window.removeEventListener('blur', close);
      document.removeEventListener('scroll', close, true);
    };
  }, [at]);
  return (
    <>
      {at && <ContextMenu key={`${at.x},${at.y}`} at={at} actions={actions} onParagraph={setPara} onClose={() => setAt(null)} />}
      {para && <ParagraphDialog editor={para} onClose={() => setPara(null)} />}
    </>
  );
}

/** A menu line. Pressing it doesn't take the focus, so the text's selection stays for the command. */
export function Item({ label, keys, onPick, danger }: { label: string; keys?: string; onPick(): void; danger?: boolean }) {
  return (
    <button type="button" role="menuitem" aria-label={label} className={`menu-item${danger ? ' danger' : ''}`} onMouseDown={(e) => e.preventDefault()} onClick={onPick}>
      <span className="grow ellipsis">{label}</span>
      {keys && <span className="menu-key">{keys}</span>}
    </button>
  );
}

export const Rule = () => <hr className="menu-rule" />;

/** A menu opened where the pointer is, kept on the screen: opened up or to the left when there isn't room below or to the right. */
export function MenuAtPoint({ x, y, label, onClose, children }: { x: number; y: number; label: string; onClose(): void; children: React.ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x, top: y });
  useLayoutEffect(() => {
    const el = box.current?.firstElementChild as HTMLElement | null;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const left = Math.max(8, Math.min(x, innerWidth - r.width - 8));
    const top = y + r.height + 8 > innerHeight ? Math.max(8, y - r.height) : y;
    if (left !== pos.left || top !== pos.top) setPos({ left, top });
  });
  return createPortal(
    <div className="context-menu app-menu" ref={box} style={{ left: pos.left, top: pos.top }} onContextMenu={(e) => e.preventDefault()}>
      <Popover label={label} onClose={onClose}>
        <div role="menu" aria-label={label} className="app-menu-items">
          {children}
        </div>
      </Popover>
    </div>,
    document.body,
  );
}

/** Reads the clipboard: its plain text and any HTML (null when the browser won't let Crumpet read it). */
async function readClipboard(): Promise<{ text: string; html: string } | null> {
  try {
    if (navigator.clipboard?.read) {
      const items = await navigator.clipboard.read();
      let text = '';
      let html = '';
      for (const item of items) {
        if (!text && item.types.includes('text/plain')) text = await (await item.getType('text/plain')).text();
        if (!html && item.types.includes('text/html')) html = await (await item.getType('text/html')).text();
      }
      return { text, html };
    }
    return { text: await navigator.clipboard.readText(), html: '' };
  } catch {
    return null;
  }
}

/** Copies a picture to the clipboard (as PNG, which every browser takes). */
async function copyPicture(img: HTMLImageElement): Promise<boolean> {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.getContext('2d')?.drawImage(img, 0, 0);
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/png'));
    if (!blob) return false;
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    return true;
  } catch {
    return false;
  }
}

function savePicture(img: HTMLImageElement): void {
  const a = document.createElement('a');
  a.href = img.currentSrc || img.src;
  const name = (img.alt || 'Picture').replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 60) || 'Picture';
  a.download = /\.[a-z0-9]{2,4}$/i.test(name) ? name : `${name}.png`;
  a.click();
}

function copyText(text: string): void {
  navigator.clipboard?.writeText(text).catch(() => undefined);
}

function ContextMenu({ at, actions, onParagraph, onClose }: { at: At; actions: ContextActions; onParagraph(ed: Editor): void; onClose(): void }) {
  const state = useAppState();
  const store = useAppStore();
  const panes = usePanes();
  const clips = useClips();
  const addWord = useAddWord();
  const [note, setNote] = useState('');
  const [spelling, setSpelling] = useState<{ word: string; suggestions: string[] } | null>(null);

  // A word the spelling check doesn't know: its suggestions at the top, as Word does (English only, like the Check tab).
  const sp = state.settings.spelling;
  const word = at.kind === 'editor' ? at.word?.word : undefined;
  useEffect(() => {
    if (!word || sp?.off || !/^[\p{L}'’-]+$/u.test(word) || (sp?.lang && !/^en/i.test(sp.lang))) return;
    const lower = word.toLowerCase();
    if (passedWords(state).some((w) => w.toLowerCase() === lower)) return;
    let live = true;
    speller(sp?.lang || navigator.language)
      .then((s) => {
        const w = word.replace(/’/g, "'");
        if (live && !s.correct(w)) setSpelling({ word, suggestions: s.suggest(w).slice(0, 5) });
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [word]); // eslint-disable-line react-hooks/exhaustive-deps

  const done = (fn: () => void) => () => {
    fn();
    onClose();
  };
  const cantPaste = () => setNote(`Your browser didn’t let Crumpet read the clipboard. Press ${mod}V to paste.`);

  const pictureItems = (img: HTMLImageElement | null) =>
    img && (
      <>
        <Item label="Copy picture" onPick={() => void copyPicture(img).then((ok) => (ok ? onClose() : setNote('This picture couldn’t be copied. Try saving it instead.')))} />
        <Item label="Save picture…" onPick={done(() => savePicture(img))} />
        <Rule />
      </>
    );
  const linkItems = (link: string | null, editor?: Editor) =>
    link && (
      <>
        <Item label="Open link" onPick={done(() => window.open(link, '_blank', 'noopener'))} />
        <Item label="Copy link" onPick={done(() => copyText(link))} />
        {editor && editor.view.root.contentEditable !== 'false' && <Item label="Remove link" onPick={done(() => editor.setLink(null))} />}
        <Rule />
      </>
    );

  let body: React.ReactNode;
  if (at.kind === 'editor') {
    const ed = at.editor;
    const ro = ed.view.root.contentEditable === 'false' || ed.formsOnly;
    const sel = ed.currentSelection();
    const picked = sel.anchor.block !== sel.focus.block || sel.anchor.offset !== sel.focus.offset;
    const paste = (mode: 'keep' | 'text') => async () => {
      const got = await readClipboard();
      if (!got) return cantPaste();
      // Copied from Crumpet: its own formatting comes back too.
      const md = clips.find((c) => c.text.trim() === got.text.trim())?.md ?? '';
      ed.focus();
      ed.paste({ text: got.text, md, html: got.html }, mode);
      onClose();
    };
    // A grammar finding where the caret is: its fixes at the top too.
    const gram = !ro && !spelling ? grammarAt(ed, sel.focus) : null;
    body = (
      <>
        {gram && (
          <>
            <p className="menu-grammar">{gram.message}</p>
            {gram.fixes.map((f) => (
              <Item key={`${f.from}:${f.text}`} label={f.label} onPick={done(() => applyFix(ed, gram, f))} />
            ))}
            <Item label="Ignore" onPick={done(() => ignoreIssue(gram))} />
            <Rule />
          </>
        )}
        {spelling && !ro && (
          <>
            {spelling.suggestions.length ? (
              spelling.suggestions.map((s) => (
                <Item
                  key={s}
                  label={s}
                  onPick={done(() => {
                    if (!at.word) return;
                    ed.select(at.word.sel);
                    ed.focus();
                    ed.typeText(s);
                  })}
                />
              ))
            ) : (
              <p className="menu-label">No suggestions</p>
            )}
            <Item label="Add to dictionary" onPick={done(() => addWord(spelling.word))} />
            <Item label="Ignore all" onPick={done(() => ignoreWord(spelling.word))} />
            <Rule />
          </>
        )}
        {!ro && (
          <div className="menu-format" role="group" aria-label="Format">
            {(
              [
                ['bold', 'Bold', 'B', `${mod}B`],
                ['italic', 'Italic', 'I', `${mod}I`],
                ['underline', 'Underline', 'U', `${mod}U`],
                ['strike', 'Strikethrough', 'S', ''],
              ] as const
            ).map(([mark, name, glyph, keys]) => (
              <button key={mark} type="button" role="menuitem" className={`menu-format-${mark}`} aria-label={name} title={keys ? `${name} (${keys})` : name} onMouseDown={(e) => e.preventDefault()} onClick={done(() => ed.toggleMark(mark))}>
                {glyph}
              </button>
            ))}
          </div>
        )}
        {pictureItems(at.img)}
        {linkItems(at.link, ed)}
        {!ro && <Item label="Cut" keys={`${mod}X`} onPick={done(() => document.execCommand('cut'))} />}
        <Item label="Copy" keys={`${mod}C`} onPick={done(() => document.execCommand('copy'))} />
        {!ro && (
          <>
            <Item label="Paste" keys={`${mod}V`} onPick={() => void paste('keep')()} />
            <Item label="Paste text only" keys={isMac ? '⌘⇧V' : 'Ctrl+Shift+V'} onPick={() => void paste('text')()} />
          </>
        )}
        <Item label="Select all" keys={`${mod}A`} onPick={done(() => document.execCommand('selectAll'))} />
        <Rule />
        {!ro && picked && !at.link && (
          <Item
            label="Link…"
            keys={`${mod}K`}
            onPick={done(() => ed.view.root.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: !isMac, metaKey: isMac, bubbles: true })))}
          />
        )}
        {!ro && (
          <>
            <Item label="Font…" keys={`${mod}D`} onPick={done(() => openFontDialog(ed))} />
            <Item label="Paragraph…" onPick={done(() => onParagraph(ed))} />
            <Item label="Clear formatting" onPick={done(() => ed.clearFormatting())} />
            <Rule />
          </>
        )}
        {ed.onCommentKey && <Item label="New comment" keys={isMac ? '⌘⌥M' : 'Ctrl+Alt+M'} onPick={done(() => ed.onCommentKey?.())} />}
        {at.word && <Item label={`Look up “${at.word.word.length > 24 ? `${at.word.word.slice(0, 24)}…` : at.word.word}”`} keys={isMac ? '⇧F7' : 'Shift+F7'} onPick={done(() => store.updateLayout({ right: true, rightTab: 'thesaurus' }))} />}
        {!ro && (
          <>
            <Rule />
            <Item label="Undo" keys={`${mod}Z`} onPick={done(() => ed.undo())} />
            <Item label="Redo" keys={isMac ? '⌘⇧Z' : 'Ctrl+Y'} onPick={done(() => ed.redo())} />
          </>
        )}
      </>
    );
  } else if (at.kind === 'field') {
    const f = at.field;
    const ro = f.matches('[readonly], [disabled]') || f.getAttribute('contenteditable') === 'false';
    const secret = f instanceof HTMLInputElement && f.type === 'password';
    const paste = async () => {
      const got = await readClipboard();
      if (!got) return cantPaste();
      f.focus();
      document.execCommand('insertText', false, got.text);
      onClose();
    };
    body = (
      <>
        {!ro && !at.cell && <Item label="Undo" keys={`${mod}Z`} onPick={done(() => document.execCommand('undo'))} />}
        {!ro && !at.cell && <Rule />}
        {!ro && !secret && <Item label="Cut" keys={`${mod}X`} onPick={done(() => document.execCommand('cut'))} />}
        {!secret && <Item label="Copy" keys={`${mod}C`} onPick={done(() => document.execCommand('copy'))} />}
        {!ro && <Item label="Paste" keys={`${mod}V`} onPick={() => void paste()} />}
        <Item
          label="Select all"
          keys={`${mod}A`}
          onPick={done(() => {
            f.focus();
            if (f instanceof HTMLInputElement || f instanceof HTMLTextAreaElement) f.select();
            else document.execCommand('selectAll');
          })}
        />
        {at.cell && at.editor && !ro && <TableItems editor={at.editor} cell={at.cell} onDone={onClose} />}
      </>
    );
  } else {
    const tab = at.tab;
    body = (
      <>
        {pictureItems(at.img)}
        {linkItems(at.link)}
        {at.text.trim() && (
          <>
            <Item label="Copy" keys={`${mod}C`} onPick={done(() => copyText(at.text))} />
            <Rule />
          </>
        )}
        {tab && (
          <>
            <Item label="Open in a new tab" onPick={done(() => panes.open(tab, 'tab'))} />
            <Item label="Open to the side" onPick={done(() => panes.split(tab, 'right'))} />
            <Rule />
          </>
        )}
        <Item label="New note" onPick={done(actions.newNote)} />
        <Item label="Find anything" keys={`${mod}K`} onPick={done(actions.openFinder)} />
        <Item label="All commands" keys={`${mod}P`} onPick={done(actions.openCommands)} />
        <Rule />
        <Item label="Settings" onPick={done(actions.openSettings)} />
        <Item label="Guide to Crumpet" onPick={done(openGuide)} />
      </>
    );
  }

  return (
    <MenuAtPoint x={at.x} y={at.y} label="Menu" onClose={onClose}>
      {note ? <p className="menu-note">{note}</p> : body}
    </MenuAtPoint>
  );
}

/** A table cell's rows, columns, merging and splitting (as the Table menu under the table has). */
function TableItems({ editor, cell, onDone }: { editor: Editor; cell: HTMLElement; onDone(): void }) {
  const act = (action: string) => () => {
    editor.tableAction(cell, action);
    onDone();
  };
  return (
    <>
      <Rule />
      <Item label="Insert row above" onPick={act('row-above')} />
      <Item label="Insert row below" onPick={act('row')} />
      <Item label="Insert column left" onPick={act('col-left')} />
      <Item label="Insert column right" onPick={act('col')} />
      <Rule />
      <Item label="Merge with cell to the right" onPick={act('merge-right')} />
      <Item label="Merge with cell below" onPick={act('merge-down')} />
      <Item label="Split cell" onPick={act('split')} />
      <Rule />
      <Item label="Delete row" danger onPick={act('del-row')} />
      <Item label="Delete column" danger onPick={act('del-col')} />
      <Item label="Delete table" danger onPick={act('delete')} />
    </>
  );
}
