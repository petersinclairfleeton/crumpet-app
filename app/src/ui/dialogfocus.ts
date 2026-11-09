import { useEffect, useRef } from 'react';

/** A dialog takes the focus once, as it opens, so Escape (handled on the dialog) closes it as every other does. */
export function useOpenFocus<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (el && !el.contains(document.activeElement)) el.focus();
  }, []);
  return ref;
}
