// A short tour of the main places, pointing at each in turn. Started from
// the welcome page, so it never gets in the way of anyone who didn't ask.

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface Step {
  /** What it points at (the first match that's on screen). */
  target: string;
  title: string;
  text: string;
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

export const STEPS: Step[] = [
  { target: '.new-note, .rail-btn.new, .fab', title: 'Your first note', text: 'Start a note here, or press N anywhere. Notes save as you type, and you can file them later.' },
  { target: '.search', title: 'Find anything', text: `Search every note, notebook and tag. ${isMac ? '⌘K' : 'Ctrl+K'} jumps here from anywhere.` },
  { target: '.layout-menu .icon-btn', title: 'Arrange your desk', text: 'Fold away the sidebar or note list, or open two notes side by side. Select text to format it.' },
  { target: '.account', title: 'Make it yours', text: 'Themes, fonts, your name, and connecting Google Drive so your notes follow you.' },
];

export function Tour({ onDone }: { onDone(): void }) {
  const [i, setI] = useState(0);
  const [box, setBox] = useState<DOMRect | null>(null);
  const bubble = useRef<HTMLDivElement>(null);
  const steps = STEPS.filter((s) => document.querySelector(s.target));
  const step = steps[Math.min(i, steps.length - 1)];

  useLayoutEffect(() => {
    if (!step) return;
    const place = () => {
      const el = Array.from(document.querySelectorAll<HTMLElement>(step.target)).find((e) => e.offsetParent !== null);
      setBox(el ? el.getBoundingClientRect() : null);
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [step]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onDone();
    window.addEventListener('keydown', onKey);
    bubble.current?.querySelector<HTMLButtonElement>('.tour-next')?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [onDone, i]);

  if (!step || !box) return null;
  // Beside the target when there's room on the right, otherwise below it.
  const right = box.right + 300 < window.innerWidth;
  const style = right ? { left: box.right + 14, top: Math.max(12, box.top + box.height / 2 - 28) } : { left: Math.max(12, Math.min(window.innerWidth - 292, box.left)), top: box.bottom + 14 };
  const last = i >= steps.length - 1;
  return createPortal(
    <>
      <div className="tour-ring" style={{ left: box.left - 4, top: box.top - 4, width: box.width + 8, height: box.height + 8 }} aria-hidden="true" />
      <div ref={bubble} className={`tour ${right ? 'beside' : 'below'}`} role="dialog" aria-label={`Tip ${i + 1} of ${steps.length}: ${step.title}`} style={style}>
        <strong>
          {i + 1} of {steps.length} · {step.title}
        </strong>
        <p>{step.text}</p>
        <div className="tour-actions">
          <button type="button" className="tour-skip" onClick={onDone}>
            {last ? 'Close' : 'Skip'}
          </button>
          <button type="button" className="tour-next" onClick={() => (last ? onDone() : setI(i + 1))}>
            {last ? 'Done' : 'Next'}
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}
