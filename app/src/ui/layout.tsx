// Arranging the window: the sidebar in full, as icons or hidden; the note
// list shown or not; panes resized by dragging their edges; and two notes
// side by side or one above the other.

import { useState } from 'react';
import type { LayoutPrefs, View } from '../data/types';
import { sameView } from '../data/selectors';
import { useAppState, useAppStore } from './hooks';
import { IconBook, IconSun, IconLayout, IconNote, IconNotebook as IconNotebookTab, IconPlus, IconSearch, IconSidebar, IconStar, IconTrash, NotebookIcon } from './icons';
import { Popover } from './Sidebar';

export const SIDEBAR = { min: 180, max: 420, normal: 236 };
export const LIST = { min: 240, max: 560, normal: 360 };

/**
 * A draggable edge between two panes (also moved with the arrow keys). While
 * dragging, the size is shown straight away through a CSS variable on `target`;
 * it's saved when the drag ends.
 */
export function Resizer({ label, value, min, max, normal, vertical = false, cssVar, target, onChange, scale = 1 }: { label: string; value: number; min: number; max: number; normal: number; vertical?: boolean; cssVar: string; target(): HTMLElement | null; onChange(v: number): void; scale?: number }) {
  const [dragging, setDragging] = useState(false);
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  const show = (v: number) => target()?.style.setProperty(cssVar, String(scale === 1 ? `${Math.round(v)}px` : v));
  return (
    <div
      role="separator"
      aria-orientation={vertical ? 'horizontal' : 'vertical'}
      aria-label={label}
      aria-valuenow={Math.round(scale === 1 ? value : value * 100)}
      aria-valuemin={Math.round(scale === 1 ? min : min * 100)}
      aria-valuemax={Math.round(scale === 1 ? max : max * 100)}
      tabIndex={0}
      className={`resizer${vertical ? ' vertical' : ''}${dragging ? ' dragging' : ''}`}
      onPointerDown={(e) => {
        e.preventDefault();
        const el = e.currentTarget;
        el.setPointerCapture(e.pointerId);
        const start = vertical ? e.clientY : e.clientX;
        const startValue = value;
        let last = value;
        setDragging(true);
        const move = (ev: PointerEvent) => {
          const delta = (vertical ? ev.clientY : ev.clientX) - start;
          last = clamp(startValue + delta / scale);
          show(last);
        };
        const up = () => {
          el.removeEventListener('pointermove', move);
          el.removeEventListener('pointerup', up);
          el.removeEventListener('pointercancel', up);
          setDragging(false);
          if (last !== startValue) onChange(last);
        };
        el.addEventListener('pointermove', move);
        el.addEventListener('pointerup', up);
        el.addEventListener('pointercancel', up);
      }}
      // Double-click: back to the usual size.
      onDoubleClick={() => {
        show(normal);
        onChange(normal);
      }}
      onKeyDown={(e) => {
        const step = scale === 1 ? 16 : 0.05;
        const back = vertical ? 'ArrowUp' : 'ArrowLeft';
        const forward = vertical ? 'ArrowDown' : 'ArrowRight';
        if (e.key === back || e.key === forward) {
          e.preventDefault();
          const next = clamp(value + (e.key === forward ? step : -step));
          show(next);
          onChange(next);
        }
      }}
    />
  );
}

/** The sidebar folded to a strip of icons. */
export function SidebarRail({ onOpenView, onNewNote, onToday }: { onOpenView(v: View): void; onNewNote(): void; onToday(): void }) {
  const state = useAppState();
  const store = useAppStore();
  const active = (v: View) => !state.query && sameView(state.view, v);
  const item = (v: View, label: string, icon: React.ReactNode) => (
    <button key={label} type="button" className={`rail-btn${active(v) ? ' active' : ''}`} aria-label={label} title={label} aria-current={active(v) ? 'page' : undefined} onClick={() => onOpenView(v)}>
      {icon}
    </button>
  );
  return (
    <nav className="rail" aria-label="Notebooks">
      <button type="button" className="rail-btn" aria-label="Show the sidebar" title="Show the sidebar" onClick={() => store.updateLayout({ sidebar: 'full' })}>
        <IconSidebar size={18} />
      </button>
      <button type="button" className="rail-btn new" aria-label="New note" title="New note" onClick={onNewNote}>
        <IconPlus size={16} />
      </button>
      <button
        type="button"
        className="rail-btn"
        aria-label="Search"
        title="Search"
        onClick={() => {
          const search = document.getElementById('search') as HTMLInputElement | null;
          search?.focus();
        }}
      >
        <IconSearch size={18} />
      </button>
      <span className="rail-gap" />
      {item({ kind: 'all' }, 'All Notes', <IconNote size={18} />)}
      <button type="button" className="rail-btn" aria-label="Today" title="Today’s note" onClick={onToday}>
        <IconSun size={18} />
      </button>
      {item({ kind: 'favorites' }, 'Favorites', <IconStar size={18} />)}
      {state.projects.map((p) => item({ kind: 'project', id: p.id }, p.name, <IconBook size={18} />))}
      <span className="rail-gap" />
      {state.notebooks.map((nb) => item({ kind: 'notebook', id: nb.id }, nb.name, <NotebookIcon color={nb.color} size={16} cut="var(--shell, var(--side-bg))" />))}
      <span className="grow" />
      {item({ kind: 'trash' }, 'Trash', <IconTrash size={18} />)}
    </nav>
  );
}

/** The Layout menu: what's shown, and one note or two. */
export function LayoutMenu() {
  const state = useAppState();
  const store = useAppStore();
  const [open, setOpen] = useState(false);
  const layout: LayoutPrefs = state.settings.layout ?? {};
  const set = (patch: Partial<LayoutPrefs>) => store.updateLayout(patch);
  const sidebar = layout.sidebar ?? 'full';
  const split = layout.split ?? 'one';
  const inProject = state.view.kind === 'project';
  return (
    <span className="layout-menu">
      <button type="button" className="icon-btn" aria-label="Layout" title="Layout" aria-expanded={open} onClick={() => setOpen(!open)}>
        <IconLayout size={17} />
      </button>
      {open && (
        <Popover label="Layout" onClose={() => setOpen(false)}>
          <div className="layout-form">
            <p className="layout-label">Sidebar</p>
            <div className="segmented small" role="group" aria-label="Sidebar">
              {(['full', 'icons', 'hidden'] as const).map((m) => (
                <button key={m} type="button" aria-pressed={sidebar === m} onClick={() => set({ sidebar: m })}>
                  {m === 'full' ? 'Full' : m === 'icons' ? 'Icons' : 'Hidden'}
                </button>
              ))}
            </div>
            <label className="check">
              <input type="checkbox" checked={layout.list !== false} onChange={(e) => set({ list: e.target.checked })} /> {inProject ? 'Outline' : 'Note list'}
            </label>
            <p className="layout-label">Notes open</p>
            <div className="split-choices" role="group" aria-label="Notes open">
              {(['one', 'side', 'stacked'] as const).map((m) => (
                <button key={m} type="button" aria-pressed={split === m} disabled={inProject} onClick={() => set({ split: m })}>
                  <span className={`split-pic ${m}`} aria-hidden="true">
                    <i />
                    {m !== 'one' && <i />}
                  </span>
                  {m === 'one' ? 'One' : m === 'side' ? 'Side by side' : 'Stacked'}
                </button>
              ))}
            </div>
            <p className="layout-hint">{inProject ? 'Two notes at once works outside projects.' : 'Click a note to open it on the side you were last in. Drag the edges between panes to resize them.'}</p>
            <button type="button" className="btn quiet small" onClick={() => store.updateSettings({ layout: {} })}>
              Reset layout
            </button>
          </div>
        </Popover>
      )}
    </span>
  );
}

/** Phones: a floating tab bar at the bottom of the list, and a round + for a new note. */
export function TabBar({ onOpenView, onNotebooks, onNewNote, onToday }: { onOpenView(v: View): void; onNotebooks(): void; onNewNote(): void; onToday(): void }) {
  const state = useAppState();
  const on = (v: View) => !state.query && sameView(state.view, v);
  return (
    <>
      <nav className="tab-bar" aria-label="Sections">
        <button type="button" className={on({ kind: 'all' }) ? 'on' : ''} aria-current={on({ kind: 'all' }) ? 'page' : undefined} onClick={() => onOpenView({ kind: 'all' })}>
          <IconNote size={20} />
          Notes
        </button>
        <button type="button" onClick={onNotebooks}>
          <IconNotebookTab size={20} />
          Notebooks
        </button>
        <button type="button" onClick={onToday}>
          <IconSun size={20} />
          Today
        </button>
        <button
          type="button"
          onClick={() => {
            const search = document.getElementById('search') as HTMLInputElement | null;
            search?.focus();
          }}
        >
          <IconSearch size={20} />
          Search
        </button>
      </nav>
      <button type="button" className="fab" aria-label="New note" onClick={onNewNote}>
        <IconPlus size={24} />
      </button>
    </>
  );
}
