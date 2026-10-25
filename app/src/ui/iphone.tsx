// Crumpet on an iPhone, made to feel like an app of its own: swipe in from
// the left edge to go back, pinch the writing to make it bigger or smaller,
// no zooming in when a box is tapped, and (in
// Safari) a guide to adding Crumpet to the Home Screen, where it opens full
// screen with its own icon and launch screen.

import { type RefObject, useEffect, useState } from 'react';
import { isInstalled, platform } from '../data/pwa';
import { desktop } from '../data/desktop';
import { DEFAULT_NOTE_SIZE } from '../data/types';
import { useAppState, useAppStore } from './hooks';

/** An iPhone or iPad (iPads say they're Macs, but have touch). */
export const isIos = typeof navigator !== 'undefined' && platform() === 'ios';

/**
 * Tapping a box with small text makes iOS zoom in (and stay zoomed). Telling
 * it not to scale stops that; iOS still lets people pinch to zoom themselves.
 */
export function stopFocusZoom(): void {
  if (!isIos) return;
  const meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
  if (meta && !/maximum-scale/.test(meta.content)) meta.content += ', maximum-scale=1';
}

const EDGE = 24;

/**
 * Swiping in from the left edge goes back to the list, the iPhone way: the
 * page follows the finger, and goes if it's pulled far enough (or flicked).
 */
export function useSwipeBack(root: RefObject<HTMLElement | null>, active: boolean, onBack: () => void): void {
  useEffect(() => {
    const el = root.current;
    if (!el || !active) return;
    let start: { x: number; y: number; t: number } | null = null;
    let page: HTMLElement | null = null;
    let dx = 0;
    let decided: boolean | null = null;
    const shown = () => [...el.querySelectorAll<HTMLElement>('.pane')].find((p) => p.offsetParent !== null) ?? null;
    const down = (e: TouchEvent) => {
      const t = e.touches[0];
      if (e.touches.length !== 1 || t.clientX > EDGE) return;
      start = { x: t.clientX, y: t.clientY, t: performance.now() };
      page = shown();
      dx = 0;
      decided = null;
    };
    const move = (e: TouchEvent) => {
      if (!start || !page) return;
      const t = e.touches[0];
      const x = t.clientX - start.x;
      const y = t.clientY - start.y;
      // Sideways first, or it's an ordinary scroll.
      if (decided === null && Math.hypot(x, y) > 8) decided = Math.abs(x) > Math.abs(y) * 1.4 && x > 0;
      if (!decided) return;
      e.preventDefault();
      // The list shows underneath while the page is pulled across.
      el.classList.add('swiping');
      dx = Math.max(0, x);
      page.style.transition = 'none';
      page.style.transform = `translateX(${dx}px)`;
      page.style.boxShadow = '-12px 0 30px rgba(0, 0, 0, 0.12)';
    };
    const up = () => {
      if (!start || !page) return;
      const p = page;
      const fast = dx / Math.max(1, performance.now() - start.t) > 0.5;
      const gone = decided && (dx > window.innerWidth * 0.35 || (fast && dx > 40));
      start = null;
      page = null;
      if (!decided) return;
      p.style.transition = 'transform 0.22s ease-out';
      p.style.transform = gone ? `translateX(${window.innerWidth}px)` : '';
      window.setTimeout(() => {
        p.style.transition = '';
        p.style.transform = '';
        p.style.boxShadow = '';
        el.classList.remove('swiping');
        if (gone) onBack();
      }, gone ? 200 : 230);
    };
    el.addEventListener('touchstart', down, { passive: true });
    el.addEventListener('touchmove', move, { passive: false });
    el.addEventListener('touchend', up);
    el.addEventListener('touchcancel', up);
    return () => {
      el.removeEventListener('touchstart', down);
      el.removeEventListener('touchmove', move);
      el.removeEventListener('touchend', up);
      el.removeEventListener('touchcancel', up);
    };
  }, [root, active, onBack]);
}

/** The writing's text size (Settings → Text size), kept for this device. */
export const TEXT_SIZES = { min: 13, max: 28 };
const fitSize = (n: number) => Math.min(TEXT_SIZES.max, Math.max(TEXT_SIZES.min, Math.round(n)));

/**
 * Pinching the writing with two fingers makes its text bigger or smaller (as in a book app), rather
 * than zooming the whole screen; the size is kept for this device when the fingers lift.
 */
export function usePinchTextSize(root: RefObject<HTMLElement | null>, active: boolean): void {
  const store = useAppStore();
  useEffect(() => {
    const el = root.current;
    if (!el || !active) return;
    const css = document.documentElement.style;
    let start = 0;
    let base = 0;
    let now = 0;
    const apart = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const down = (e: TouchEvent) => {
      if (e.touches.length !== 2) return;
      start = apart(e.touches);
      base = now = store.getState().settings.noteSize ?? DEFAULT_NOTE_SIZE;
    };
    const move = (e: TouchEvent) => {
      if (!start || e.touches.length !== 2) return;
      e.preventDefault();
      now = fitSize((base * apart(e.touches)) / start);
      css.setProperty('--note-size', `${now}px`);
    };
    const up = (e: TouchEvent) => {
      if (!start || e.touches.length >= 2) return;
      start = 0;
      if (now !== base) store.updateSettings({ noteSize: now });
    };
    // Safari's own pinch, which would zoom the screen.
    const gesture = (e: Event) => e.preventDefault();
    el.addEventListener('touchstart', down, { passive: true });
    el.addEventListener('touchmove', move, { passive: false });
    el.addEventListener('touchend', up);
    el.addEventListener('touchcancel', up);
    el.addEventListener('gesturestart', gesture);
    return () => {
      el.removeEventListener('touchstart', down);
      el.removeEventListener('touchmove', move);
      el.removeEventListener('touchend', up);
      el.removeEventListener('touchcancel', up);
      el.removeEventListener('gesturestart', gesture);
    };
  }, [root, active, store]);
}

/** Text size in a phone's menus: A− and A+ either side of the size, the menu staying open. */
export function TextSizeRow() {
  const state = useAppState();
  const store = useAppStore();
  const size = state.settings.noteSize ?? DEFAULT_NOTE_SIZE;
  const set = (n: number) => store.updateSettings({ noteSize: fitSize(n) });
  return (
    <div className="menu-line text-size-row" role="group" aria-label="Text size">
      <span className="grow">Text size</span>
      <button type="button" className="icon-btn" aria-label="Smaller text" disabled={size <= TEXT_SIZES.min} onClick={() => set(size - 1)}>
        <small>A</small>−
      </button>
      <span className="text-size-now" aria-live="polite">
        {size}
      </span>
      <button type="button" className="icon-btn" aria-label="Bigger text" disabled={size >= TEXT_SIZES.max} onClick={() => set(size + 1)}>
        A+
      </button>
    </div>
  );
}

const DISMISSED = 'crumpet.homeScreenGuide';

/** In Safari on an iPhone: how to put Crumpet on the Home Screen, until it's there (or put away). */
export function HomeScreenGuide() {
  const [show, setShow] = useState(() => {
    if (!isIos || desktop || isInstalled()) return false;
    try {
      return !localStorage.getItem(DISMISSED);
    } catch {
      return true;
    }
  });
  if (!show) return null;
  const close = () => {
    try {
      localStorage.setItem(DISMISSED, '1');
    } catch {
      // Shown again next time.
    }
    setShow(false);
  };
  return (
    <div className="home-guide" role="dialog" aria-label="Add Crumpet to your Home Screen">
      <img src={`${import.meta.env.BASE_URL}icons/icon-192.png`} alt="" width={48} height={48} />
      <div className="home-guide-text">
        <b>Get the Crumpet app</b>
        <span>
          Tap Share{' '}
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-label="(the square with an arrow)" role="img">
            <path d="M12 3v12M8 7l4-4 4 4M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" />
          </svg>{' '}
          below, then <b>Add to Home Screen</b>. It opens full screen, like any app.
        </span>
      </div>
      <button type="button" className="btn small" onClick={close}>
        Got it
      </button>
    </div>
  );
}
