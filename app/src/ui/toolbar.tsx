// A toolbar that stays on one row: when there isn't room for everything, the
// least-used controls move into a "More" menu at the end (as in Word when its
// window is narrow). Each control has a priority; lower priorities go first.

import { type MouseEvent, type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Popover } from './Sidebar';
import { IconMore } from './icons';

export interface ToolItem {
  key: string;
  /** Higher stays longer: 4 (bold, italic…) the last to go, 1 the first. */
  pri: number;
  /** As it appears in the bar. */
  node: ReactNode;
  /** As it appears in the More menu (the bar's version, with its name, when not given). */
  menu?: ReactNode;
  /** Its name, shown beside it in the More menu when it has no `menu` version of its own. */
  label?: string;
  /** A thin line between groups (goes with the item after it). */
  sep?: boolean;
}

/** The calm bar keeps these five on show; everything else waits under More, in groups. */
export const CORE_TOOLS = new Set(['style', 'bold', 'italic', 'bullet', 'link']);
/** The calm More menu opens on these few; "All writing tools…" shows the rest, in groups. */
export const QUICK_TOOLS = ['fontdlg', 'color', 'highlight', 'clear', 'references', 'table', 'attach', 'comment', 'track'];
/** Over selected text in the calm look: style, bold, italic, highlight, link and comment; the rest under More. */
export const SELECTION_TOOLS = new Set(['style', 'bold', 'italic', 'highlight', 'link', 'comment']);
/** The calm More menu's few tools, in its three groups. */
const QUICK_GROUPS: [string, string[]][] = [
  ['Text', ['fontdlg', 'color', 'highlight', 'clear']],
  ['Insert', ['references', 'table', 'attach']],
  ['Write', ['comment', 'track']],
];
/** Above a phone's keyboard: style, checklist, bullets and a picture; the rest under More. */
export const PHONE_TOOLS = new Set(['style', 'todo', 'bullet', 'attach']);
/** At the foot of an iPad's page: the phone's few, and Draw for the pencil. */
export const TABLET_TOOLS = new Set(['style', 'todo', 'bullet', 'draw', 'attach']);
export type ToolGroup = 'Text' | 'Paragraph' | 'Insert' | 'Layout' | 'References' | 'Review' | 'Tools';
export const TOOL_GROUPS: ToolGroup[] = ['Text', 'Paragraph', 'Insert', 'Layout', 'References', 'Review', 'Tools'];
const GROUP_KEYS: Record<ToolGroup, string[]> = {
  Text: ['font', 'size', 'grow', 'shrink', 'fontdlg', 'color', 'highlight', 'case', 'effects', 'clear', 'underline', 'strike', 'code', 'sup', 'sub', 'dropcap', 'style', 'bold', 'italic'],
  Paragraph: ['align', 'spacing', 'bullet', 'numbered', 'multilevel', 'todo', 'borders', 'shading', 'h', 'marks'],
  Insert: ['link', 'table', 'symbol', 'date', 'chart', 'video', 'screenshot', 'object', 'model3d', 'equation', 'form', 'draw', 'inkedit', 'shapes', 'textbox', 'icons', 'attach', 'snippets', 'signature', 'blankpage', 'cover', 'create'],
  Layout: ['breaks', 'columns', 'orientation', 'linenumbers', 'hyphenation', 'pagesetup', 'pageborders', 'watermark', 'paper', 'gridlines', 'pageslayout', 'outlineview', 'newwindow', 'syncscroll', 'reader', 'pages', 'design', 'themes'],
  References: ['references', 'toc', 'chapter', 'outline', 'links', 'search', 'thesaurus'],
  Review: ['comment', 'comments', 'bright', 'protect', 'check', 'snapshots', 'writing'],
  Tools: [],
};
/** Which group of the More menu a button belongs in. */
export function toolGroup(key: string): ToolGroup {
  return TOOL_GROUPS.find((g) => GROUP_KEYS[g].includes(key)) ?? 'Tools';
}

const isMacKey = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
const CLOSE_MORE = 'crumpet:close-more';
/** Closes the bar's More menu (a tool in it has done what it was asked). */
export function closeMore(): void {
  window.dispatchEvent(new Event(CLOSE_MORE));
}

/**
 * `calm`: only the five everyday buttons (and any kept on the bar) show; the rest
 * are under More, in groups. `menus`: those groups are menus of their own on the
 * bar (Text ▾, Insert ▾, Layout ▾…), as Word's tabs are, for page view.
 */
export function OverflowRow({ items: all, fit = true, calm = false, menus = false, core = CORE_TOOLS, quickMenu }: { items: ToolItem[]; fit?: boolean; calm?: boolean; menus?: boolean; core?: Set<string>; quickMenu?: (showAll: () => void) => ReactNode }) {
  const items = calm ? all.filter((i) => core.has(i.key) || i.pri >= 9) : all;
  const waiting = calm ? all.filter((i) => !items.includes(i)) : [];
  const row = useRef<HTMLDivElement>(null);
  const widths = useRef(new Map<string, number>());
  const [hidden, setHidden] = useState<string[]>([]);
  const [open, setOpen] = useState<string | false>(false);
  // The calm More menu: a few everyday tools until "All writing tools…" is asked for.
  const [everything, setEverything] = useState(false);
  // Page view's menus fold back into one More when the bar hasn't room for them all.
  const [squeezed, setSqueezed] = useState(false);
  const menusWidth = useRef(0);
  useLayoutEffect(() => {
    const el = row.current;
    if (!el || !menus) return;
    const check = () => {
      if (!squeezed) {
        const need = (Array.from(el.children) as HTMLElement[]).reduce((n, c) => n + c.offsetWidth + 2, 0);
        menusWidth.current = need;
        if (need > el.clientWidth + 1) setSqueezed(true);
      } else if (menusWidth.current && el.clientWidth >= menusWidth.current) setSqueezed(false);
    };
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [menus, squeezed, all.length]);
  // Measured again when the buttons, or which stay longest (a button kept on the bar), change.
  const keys = items.map((i) => `${i.key}:${i.pri}`).join();
  const measureRef = useRef<() => void>(() => {});

  useLayoutEffect(() => {
    const el = row.current;
    if (!el || !fit) return;
    const measure = (measureRef.current = () => {
      // Remember the width of everything on show (hidden ones keep their last width).
      for (const child of Array.from(el.children) as HTMLElement[]) {
        const k = child.dataset.tool;
        if (k && child.offsetWidth) widths.current.set(k, child.offsetWidth + (child.dataset.sep ? 9 : 0));
      }
      const room = el.clientWidth - 40; // the More button
      const total = (list: ToolItem[]) => list.reduce((n, i) => n + (widths.current.get(i.key) ?? 32) + 2, 0);
      if (total(items) <= el.clientWidth) {
        setHidden((h) => (h.length ? [] : h));
        return;
      }
      const keep = [...items];
      const order = [...items].sort((a, b) => a.pri - b.pri || items.indexOf(b) - items.indexOf(a));
      const gone: string[] = [];
      for (const i of order) {
        if (total(keep) <= room) break;
        keep.splice(keep.indexOf(i), 1);
        gone.push(i.key);
      }
      setHidden((h) => (h.join() === gone.join() ? h : gone));
    });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [keys, fit]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tools shown for the first time were only guessed at: once they're drawn, measure again.
  useLayoutEffect(() => {
    const el = row.current;
    if (!el || !fit) return;
    const unmeasured = (Array.from(el.children) as HTMLElement[]).some((c) => c.dataset.tool && c.offsetWidth && widths.current.get(c.dataset.tool) === undefined);
    if (unmeasured) measureRef.current();
  }, [hidden, fit]);

  // A tool under More that has done its work asks for the menu to close (closeMore).
  useEffect(() => {
    const close = () => setOpen(false);
    window.addEventListener(CLOSE_MORE, close);
    return () => window.removeEventListener(CLOSE_MORE, close);
  }, []);
  // Floating over the text, the bar keeps to the most-used controls.
  const shownRaw = fit ? items.filter((i) => !hidden.includes(i.key)) : calm ? items : items.filter((i) => i.pri >= 2);
  // The calm bar reads like the design: style | bold, italic, list, link, then More.
  const order = [...core];
  const shown = calm ? [...shownRaw].sort((a, b) => (order.indexOf(a.key) + 1 || 99) - (order.indexOf(b.key) + 1 || 99)) : shownRaw;
  const extra = [...(fit ? items.filter((i) => hidden.includes(i.key)) : []), ...waiting];
  // In page view the groups are fewer and broader, like Word's tabs: Format, Insert, Layout, References, Review.
  const asMenus = menus && !squeezed;
  const menuOf = (k: string): string => {
    const g = toolGroup(k);
    return !asMenus ? g : g === 'Text' || g === 'Paragraph' ? 'Format' : g === 'Tools' ? 'Review' : g;
  };
  const names = asMenus ? ['Format', 'Insert', 'Layout', 'References', 'Review'] : TOOL_GROUPS;
  const grouped = calm ? names.map((g) => ({ g, list: extra.filter((i) => menuOf(i.key) === g) })).filter((x) => x.list.length) : [{ g: 'More', list: extra }];
  const moreRow = (i: ToolItem) => (
    <div key={i.key} className="more-row">
      {i.menu ?? i.node}
      {!i.menu && i.label && <span className="more-label">{i.label}</span>}
    </div>
  );
  const quick = calm && !asMenus && !everything ? QUICK_TOOLS.map((k) => extra.find((i) => i.key === k)).filter((i): i is ToolItem => !!i) : [];
  const closeOnPick = (e: MouseEvent) => (e.target as Element).closest('button.menu-item:not(.keep-open)') && setOpen(false);
  return (
    <div ref={row} className={`tools${fit ? ' fit' : ''}`} onMouseDown={(e) => !(e.target as Element).closest('input, select, textarea') && e.preventDefault()}>
      {shown.map((i, n) => (
        <span key={i.key} className="tool" data-tool={i.key} data-sep={i.sep && n > 0 ? '1' : undefined}>
          {i.sep && n > 0 && <span className="sep" />}
          {i.node}
        </span>
      ))}
      {extra.length > 0 && asMenus && calm
        ? grouped.map(({ g, list }) => (
            <span key={g} className="tool more-tools group-menu">
              <button type="button" aria-expanded={open === g} onClick={() => setOpen(open === g ? false : g)}>
                {g} ▾
              </button>
              {open === g && (
                <Popover label={`${g} tools`} onClose={() => setOpen(false)}>
                  <div className="more-menu" onClick={closeOnPick}>
                    {list.map(moreRow)}
                  </div>
                </Popover>
              )}
            </span>
          ))
        : extra.length > 0 && (
            <span className="tool more-tools">
              <button type="button" aria-label="More formatting" aria-expanded={open === 'more'} data-tip="More" onClick={() => (setEverything(false), setOpen(open === 'more' ? false : 'more'))}>
                {calm ? <IconMore size={18} /> : 'More ▾'}
              </button>
              {open === 'more' && (
                <Popover label="More formatting" onClose={() => setOpen(false)}>
                  <div className={`more-menu${quick.length ? ' quick' : ''}`} onClick={closeOnPick}>
                    {quick.length > 0 && quickMenu && quickMenu(() => setEverything(true))}
                    {quick.length > 0 && !quickMenu && (
                      <>
                        {QUICK_GROUPS.map(([g, keys]) => {
                          const list = keys.map((k) => quick.find((i) => i.key === k && !shown.includes(i))).filter((i): i is ToolItem => !!i);
                          return list.length ? (
                            <div key={g} className="more-group quick-group" role="group" aria-label={g}>
                              <p className="menu-label">{g}</p>
                              {list.map(moreRow)}
                            </div>
                          ) : null;
                        })}
                        <button type="button" className="menu-item keep-open all-tools" onClick={() => setEverything(true)}>
                          All writing tools… <small className="menu-hint">{isMacKey ? '⌘P' : 'Ctrl+P'}</small>
                        </button>
                      </>
                    )}
                    {!quick.length && grouped.map(({ g, list }) =>
                      calm ? (
                        <div key={g} className="more-group" role="group" aria-label={g}>
                          <p className="menu-label">{g}</p>
                          {list.map(moreRow)}
                        </div>
                      ) : (
                        list.map(moreRow)
                      ),
                    )}
                  </div>
                </Popover>
              )}
            </span>
          )}
    </div>
  );
}
