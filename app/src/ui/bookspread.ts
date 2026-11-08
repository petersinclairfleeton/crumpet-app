// Read, on a wide screen: the book as two facing pages, turned a pair at a
// time like a printed book's. The text flows into CSS columns of the page's
// height (two to a screen, app.css "Facing pages"), and the scroll box moves
// sideways one screen at a time. Arrow keys, Page Up/Down, space and the
// mouse wheel turn the pages; a chapter starts on a new page.

import { type RefObject, useCallback, useEffect, useRef, useState } from 'react';

/** Wide enough for two pages side by side (each about 25 em of text or more). */
export const SPREAD_MIN_WIDTH = 820;

/** Whether the scroll box is wide enough for facing pages (and `want`ed). */
export function useSpreadWidth(box: RefObject<HTMLElement | null>, want: boolean): boolean {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const el = box.current;
    if (!want || !el) return setWide(false);
    const check = () => setWide(el.clientWidth >= SPREAD_MIN_WIDTH);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [box, want]);
  return want && wide;
}

/** The pair of pages showing (from 0), how many pairs there are, and turning them. */
export function useSpreads(box: RefObject<HTMLElement | null>, on: boolean) {
  const [state, setState] = useState({ at: 0, count: 1, pages: 2 });
  const atRef = useRef(0);
  atRef.current = state.at;
  /** Pairs of pages and pages: the text runs on in columns half the box wide. */
  const sizeOf = (el: HTMLElement) => {
    const pages = Math.max(1, Math.round(el.scrollWidth / (el.clientWidth / 2)));
    return { pages, count: Math.ceil(pages / 2) };
  };
  const measure = useCallback(() => {
    const el = box.current;
    if (!el || !el.clientWidth) return;
    const { pages, count } = sizeOf(el);
    const at = Math.min(count - 1, Math.round(el.scrollLeft / el.clientWidth));
    setState((s) => (s.at === at && s.count === count && s.pages === pages ? s : { at, count, pages }));
  }, [box]);
  const go = useCallback(
    (n: number, smooth = true) => {
      const el = box.current;
      if (!el) return;
      const w = el.clientWidth;
      const { pages, count } = sizeOf(el);
      const to = Math.max(0, Math.min(count - 1, n));
      el.scrollTo({ left: to * w, top: 0, behavior: smooth && !matchMedia('(prefers-reduced-motion: reduce)').matches ? 'smooth' : 'auto' });
      setState({ at: to, count, pages });
    },
    [box],
  );
  const turn = useCallback((d: number) => go(Math.round((box.current?.scrollLeft ?? 0) / (box.current?.clientWidth || 1)) + d), [box, go]);
  /** Turns to the pages an element (a chapter) is on. */
  const show = useCallback(
    (target: Element) => {
      const el = box.current;
      if (!el) return;
      const x = target.getBoundingClientRect().left - el.getBoundingClientRect().left + el.scrollLeft;
      go(Math.floor((x + 1) / el.clientWidth));
    },
    [box, go],
  );

  useEffect(() => {
    const el = box.current;
    if (!on || !el) return;
    el.scrollTop = 0;
    // Back to a whole pair of pages after the window changes size or something scrolls the text (Find).
    let settle: ReturnType<typeof setTimeout> | undefined;
    const onScroll = () => {
      clearTimeout(settle);
      settle = setTimeout(() => {
        const w = el.clientWidth;
        if (el.scrollLeft % w > 1) go(Math.floor(el.scrollLeft / w + 0.5), false);
        else measure();
      }, 160);
    };
    const ro = new ResizeObserver(() => {
      const at = atRef.current;
      requestAnimationFrame(() => go(at, false));
    });
    ro.observe(el);
    const mo = new MutationObserver(() => requestAnimationFrame(measure));
    mo.observe(el, { childList: true, subtree: true, characterData: true });
    // The wheel turns a page at a time, however hard it's flicked.
    let last = 0;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (Math.abs(d) < 8 || Date.now() - last < 450) return;
      last = Date.now();
      turn(d > 0 ? 1 : -1);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return;
      const t = e.target as HTMLElement | null;
      if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)) return;
      if (document.querySelector('.dialog, .popover')) return;
      const next = e.key === 'ArrowRight' || e.key === 'PageDown' || (e.key === ' ' && !e.shiftKey);
      const back = e.key === 'ArrowLeft' || e.key === 'PageUp' || (e.key === ' ' && e.shiftKey);
      if (e.key === 'Home') go(0);
      else if (e.key === 'End') go(Number.MAX_SAFE_INTEGER);
      else if (next) turn(1);
      else if (back) turn(-1);
      else return;
      e.preventDefault();
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    el.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKey);
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    void fonts?.ready.then(measure);
    measure();
    return () => {
      clearTimeout(settle);
      ro.disconnect();
      mo.disconnect();
      el.removeEventListener('scroll', onScroll);
      el.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKey);
    };
  }, [on, box, go, turn, measure]); // eslint-disable-line react-hooks/exhaustive-deps

  const first = state.at * 2 + 1;
  const last = Math.min(first + 1, state.pages);
  return { at: state.at, count: state.count, turn, go, show, label: first === last ? `Page ${first} of ${state.pages}` : `Pages ${first}–${last} of ${state.pages}` };
}
