// Word's table formulas: a cell whose text starts with = is worked out from
// the other cells. =SUM(ABOVE), =AVERAGE(LEFT), =MAX(B2:B5), =A1*2+3 and so
// on: SUM, AVERAGE, MIN, MAX, COUNT and PRODUCT, of ABOVE, BELOW, LEFT or
// RIGHT (the numbers next to the cell that way), of cells (A1, column letter
// and row number from 1) and ranges (A1:C3), with + - * / and brackets.

/** A cell's number (thousands commas, currency signs and % allowed), or null. */
export function cellNumber(text: string): number | null {
  const t = text.replace(/[,$£€\s]/g, '');
  if (!t) return null;
  const pct = t.endsWith('%');
  const n = Number(pct ? t.slice(0, -1) : t);
  return Number.isFinite(n) ? (pct ? n / 100 : n) : null;
}

export function isFormula(text: string): boolean {
  return /^\s*=\s*\S/.test(text);
}

type Tok = { k: 'num'; v: number } | { k: 'op'; v: string } | { k: 'id'; v: string } | { k: 'ref'; r: number; c: number };

function tokens(src: string): Tok[] | null {
  const out: Tok[] = [];
  const re = /\s*(?:(\d+(?:\.\d+)?%?)|([A-Z]{1,2}\d+)|([A-Z]+)|([-+*/(),:^]))/giy;
  let at = 0;
  while (at < src.length) {
    re.lastIndex = at;
    const m = re.exec(src);
    if (!m) return /^\s*$/.test(src.slice(at)) ? out : null;
    at = re.lastIndex;
    if (m[1]) out.push({ k: 'num', v: m[1].endsWith('%') ? Number(m[1].slice(0, -1)) / 100 : Number(m[1]) });
    else if (m[2]) {
      const [, letters, digits] = /^([A-Z]+)(\d+)$/i.exec(m[2])!;
      const c = [...letters.toUpperCase()].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
      out.push({ k: 'ref', r: Number(digits) - 1, c });
    } else if (m[3]) out.push({ k: 'id', v: m[3].toUpperCase() });
    else out.push({ k: 'op', v: m[4] });
  }
  return out;
}

const FUNCS: Record<string, (xs: number[]) => number> = {
  SUM: (xs) => xs.reduce((a, b) => a + b, 0),
  AVERAGE: (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0),
  MIN: (xs) => (xs.length ? Math.min(...xs) : 0),
  MAX: (xs) => (xs.length ? Math.max(...xs) : 0),
  COUNT: (xs) => xs.length,
  PRODUCT: (xs) => xs.reduce((a, b) => a * b, 1),
};

/**
 * The value of the formula in cell r, c of `rows` (cells as plain text), or
 * null when it can't be worked out. Formulas in the cells it uses are
 * worked out first (a formula using itself gives null).
 */
export function evaluateCell(rows: string[][], r: number, c: number, seen = new Set<string>()): number | null {
  const key = `${r},${c}`;
  const text = rows[r]?.[c] ?? '';
  if (!isFormula(text)) return cellNumber(text);
  if (seen.has(key)) return null;
  seen.add(key);
  const toks = tokens(text.trim().slice(1));
  if (!toks) return null;
  const valueAt = (rr: number, cc: number): number | null => (rr === r && cc === c ? null : rr < 0 || cc < 0 || rr >= rows.length || cc >= (rows[rr]?.length ?? 0) ? null : evaluateCell(rows, rr, cc, new Set(seen)));
  /** The numbers next to the cell, one way, up to the first cell that isn't a number (blanks skipped at the start). */
  const run = (dr: number, dc: number): number[] => {
    const out: number[] = [];
    let started = false;
    for (let rr = r + dr, cc = c + dc; rr >= 0 && cc >= 0 && rr < rows.length && cc < (rows[rr]?.length ?? 0); rr += dr, cc += dc) {
      const v = valueAt(rr, cc);
      if (v === null) {
        if (started || (rows[rr][cc] ?? '').trim()) break;
        continue;
      }
      started = true;
      out.push(v);
    }
    return dr < 0 || dc < 0 ? out.reverse() : out;
  };
  let i = 0;
  const peek = () => toks[i];
  const eat = (v: string) => {
    const t = toks[i];
    if (t?.k === 'op' && t.v === v) {
      i++;
      return true;
    }
    return false;
  };
  const fail = () => {
    throw new Error('formula');
  };
  // A function's arguments: directions, ranges, or expressions.
  const args = (): number[] => {
    const out: number[] = [];
    if (eat(')')) return out;
    for (;;) {
      const t = peek();
      if (t?.k === 'id' && ['ABOVE', 'BELOW', 'LEFT', 'RIGHT'].includes(t.v)) {
        i++;
        out.push(...(t.v === 'ABOVE' ? run(-1, 0) : t.v === 'BELOW' ? run(1, 0) : t.v === 'LEFT' ? run(0, -1) : run(0, 1)));
      } else if (t?.k === 'ref' && toks[i + 1]?.k === 'op' && (toks[i + 1] as { v: string }).v === ':' && toks[i + 2]?.k === 'ref') {
        const a = t;
        const b = toks[i + 2] as { r: number; c: number };
        i += 3;
        for (let rr = Math.min(a.r, b.r); rr <= Math.max(a.r, b.r); rr++)
          for (let cc = Math.min(a.c, b.c); cc <= Math.max(a.c, b.c); cc++) {
            const v = valueAt(rr, cc);
            if (v !== null) out.push(v);
          }
      } else out.push(expr());
      if (eat(',')) continue;
      if (eat(')')) return out;
      fail();
    }
  };
  const atom = (): number => {
    const t = peek();
    if (!t) fail();
    if (t.k === 'op' && t.v === '-') {
      i++;
      return -atom();
    }
    if (t.k === 'op' && t.v === '+') {
      i++;
      return atom();
    }
    if (t.k === 'op' && t.v === '(') {
      i++;
      const v = expr();
      if (!eat(')')) fail();
      return v;
    }
    if (t.k === 'num') {
      i++;
      return t.v;
    }
    if (t.k === 'ref') {
      i++;
      const v = valueAt(t.r, t.c);
      // A cell of words or nothing counts as 0; a formula that can't be worked out spoils this one too.
      if (v === null && isFormula(rows[t.r]?.[t.c] ?? '')) fail();
      return v ?? 0;
    }
    if (t.k === 'id' && FUNCS[t.v]) {
      i++;
      if (!eat('(')) fail();
      return FUNCS[t.v](args());
    }
    return fail();
  };
  const power = (): number => {
    const base = atom();
    return eat('^') ? base ** power() : base;
  };
  const term = (): number => {
    let v = power();
    for (;;) {
      if (eat('*')) v *= power();
      else if (eat('/')) v /= power();
      else return v;
    }
  };
  const expr = (): number => {
    let v = term();
    for (;;) {
      if (eat('+')) v += term();
      else if (eat('-')) v -= term();
      else return v;
    }
  };
  try {
    const v = expr();
    return i === toks.length && Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}

/** A formula's value as shown: up to two decimal places, with thousands parted as where the person is. */
export function formatValue(v: number | null): string {
  if (v === null) return '!Error';
  return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
}
