// Word's UnicodeMath, the maths you type in a line ("a/b", "x^2", "√(a+b)",
// "∑_(i=1)^n", "■(a&b@c&d)"), turned into LaTeX, which Crumpet's maths draws.
// Covers the common parts of Unicode Technical Note 28: fractions, scripts,
// roots, n-ary operators and limits, brackets, matrices and maths words
// (\alpha, \infty…); anything else is passed on as it is.

/** Unicode characters and their LaTeX. */
const SYMBOLS: Record<string, string> = {
  α: '\\alpha', β: '\\beta', γ: '\\gamma', δ: '\\delta', ε: '\\epsilon', ϵ: '\\epsilon', ζ: '\\zeta', η: '\\eta', θ: '\\theta', ϑ: '\\vartheta', ι: '\\iota', κ: '\\kappa', λ: '\\lambda', μ: '\\mu', ν: '\\nu', ξ: '\\xi', π: '\\pi', ρ: '\\rho', σ: '\\sigma', τ: '\\tau', υ: '\\upsilon', φ: '\\phi', ϕ: '\\phi', χ: '\\chi', ψ: '\\psi', ω: '\\omega',
  Γ: '\\Gamma', Δ: '\\Delta', Θ: '\\Theta', Λ: '\\Lambda', Ξ: '\\Xi', Π: '\\Pi', Σ: '\\Sigma', Φ: '\\Phi', Ψ: '\\Psi', Ω: '\\Omega',
  '±': '\\pm', '∓': '\\mp', '×': '\\times', '÷': '\\div', '·': '\\cdot', '⋅': '\\cdot', '∙': '\\cdot', '∗': '\\ast', '∘': '\\circ', '−': '-',
  '≠': '\\ne', '≤': '\\le', '≥': '\\ge', '≈': '\\approx', '≡': '\\equiv', '≅': '\\cong', '∼': '\\sim', '∝': '\\propto', '≪': '\\ll', '≫': '\\gg',
  '∞': '\\infty', '∂': '\\partial', '∇': '\\nabla', '∀': '\\forall', '∃': '\\exists', '∄': '\\nexists', '∅': '\\emptyset', '¬': '\\neg', '∧': '\\wedge', '∨': '\\vee',
  '∈': '\\in', '∉': '\\notin', '∋': '\\ni', '⊂': '\\subset', '⊃': '\\supset', '⊆': '\\subseteq', '⊇': '\\supseteq', '∪': '\\cup', '∩': '\\cap',
  '→': '\\to', '←': '\\leftarrow', '↔': '\\leftrightarrow', '⇒': '\\Rightarrow', '⇐': '\\Leftarrow', '⇔': '\\Leftrightarrow', '↑': '\\uparrow', '↓': '\\downarrow', '↦': '\\mapsto',
  '∴': '\\therefore', '∵': '\\because', '…': '\\ldots', '⋯': '\\cdots', '⋮': '\\vdots', '⋱': '\\ddots', '°': '^\\circ', '′': "'", '″': "''", 'ℏ': '\\hbar', 'ℓ': '\\ell', 'ℵ': '\\aleph',
  ℝ: '\\mathbb{R}', ℕ: '\\mathbb{N}', ℤ: '\\mathbb{Z}', ℚ: '\\mathbb{Q}', ℂ: '\\mathbb{C}', '∎': '\\blacksquare',
};

/** N-ary operators: their LaTeX (scripts go under and over them). */
const NARY: Record<string, string> = { '∑': '\\sum', '∏': '\\prod', '∐': '\\coprod', '∫': '\\int', '∬': '\\iint', '∭': '\\iiint', '∮': '\\oint', '⋃': '\\bigcup', '⋂': '\\bigcap', '⋁': '\\bigvee', '⋀': '\\bigwedge' };

/** Words drawn upright as maths functions. */
const FUNCTIONS = new Set(['sin', 'cos', 'tan', 'cot', 'sec', 'csc', 'sinh', 'cosh', 'tanh', 'arcsin', 'arccos', 'arctan', 'log', 'ln', 'exp', 'lim', 'max', 'min', 'sup', 'inf', 'det', 'gcd', 'deg', 'dim', 'ker', 'arg', 'mod']);

/** UnicodeMath's own words (\of, \matrix…), as their characters. */
const WORDS: Record<string, string> = { sqrt: '√', cbrt: '∛', qdrt: '∜', matrix: '■', sum: '∑', prod: '∏', int: '∫', iint: '∬', oint: '∮', of: '▒', inf: '∞', infty: '∞', to: '→', rightarrow: '→', pm: '±', times: '×', cdot: '·', ne: '≠', le: '≤', ge: '≥', approx: '≈', partial: '∂', nabla: '∇', in: '∈' };

const OPEN: Record<string, string> = { '(': ')', '[': ']', '{': '}', '⟨': '⟩', '|': '|', '‖': '‖', '⌊': '⌋', '⌈': '⌉' };
const BRACKET_TEX: Record<string, string> = { '(': '(', ')': ')', '[': '[', ']': ']', '{': '\\{', '}': '\\}', '⟨': '\\langle', '⟩': '\\rangle', '|': '|', '‖': '\\|', '⌊': '\\lfloor', '⌋': '\\rfloor', '⌈': '\\lceil', '⌉': '\\rceil' };

/** A piece of maths: its LaTeX, and its inside without brackets (for a fraction's parts and scripts). */
interface Piece {
  tex: string;
  inner?: string;
}

class Parser {
  i = 0;
  constructor(private s: string) {}

  peek(): string {
    return this.s[this.i] ?? '';
  }

  /** Everything up to one of `stops` (not used up). */
  expr(stops: string): string {
    const out: string[] = [];
    while (this.i < this.s.length && !stops.includes(this.peek())) {
      const c = this.peek();
      if (c === ' ') {
        this.i++;
        out.push(' ');
        continue;
      }
      let a = this.operand(stops);
      if (!a) {
        // A character that can't start anything (a stray closing bracket): kept.
        this.i++;
        out.push(BRACKET_TEX[c] ?? c);
        continue;
      }
      // Fractions: a/b, both sides with their scripts. Skewed: a∕b (kept on one line).
      while (this.peek() === '/' || this.peek() === '∕') {
        const skew = this.peek() === '∕';
        this.i++;
        const b = this.operand(stops) ?? { tex: '' };
        a = { tex: skew ? `{}^{${a.inner ?? a.tex}}/_{${b.inner ?? b.tex}}` : `\\frac{${a.inner ?? a.tex}}{${b.inner ?? b.tex}}` };
      }
      out.push(a.tex);
    }
    return out.join('').replace(/ +/g, ' ').trim();
  }

  /** One thing with its scripts: x^2, (a+b)_i, ∑_(i=1)^n. */
  operand(stops: string): Piece | null {
    const base = this.atom(stops);
    if (!base) return null;
    let tex = base.tex;
    let scripted = false;
    while (this.peek() === '_' || this.peek() === '^') {
      const kind = this.peek();
      this.i++;
      const s = this.script(stops);
      tex += `${kind}{${s}}`;
      scripted = true;
    }
    // The n-ary body: ∑_(i=1)^n▒a_i (▒ is optional).
    if (base.nary && this.peek() === '▒') this.i++;
    return scripted ? { tex } : base;
  }

  /** A script: one thing, without its brackets (with its sign: e^-x). */
  script(stops: string): string {
    const a = this.atom(stops);
    if (!a) return '';
    let tex = a.inner ?? a.tex;
    if (tex === '-' || tex === '+') tex += this.atom(stops)?.tex ?? '';
    return tex;
  }

  atom(stops: string): (Piece & { nary?: boolean }) | null {
    const c = this.peek();
    if (!c || stops.includes(c) || c === ' ' || c === '/' || c === '∕' || c === '^' || c === '_' || c === '&' || c === '@') return null;
    // A word of UnicodeMath (\sqrt, \matrix…) or of LaTeX (\alpha), kept as LaTeX.
    if (c === '\\') {
      const m = /^\\([A-Za-z]+)/.exec(this.s.slice(this.i));
      if (m) {
        this.i += m[0].length;
        const ch = WORDS[m[1]];
        if (ch) {
          // Read again as its character.
          this.s = this.s.slice(0, this.i) + ch + this.s.slice(this.i);
          return this.atom(stops);
        }
        return { tex: `\\${m[1]} ` };
      }
      this.i++;
      return { tex: '\\backslash ' };
    }
    if (c in OPEN && !(c === '|' && stops.includes('|')) && !(c === '‖' && stops.includes('‖'))) {
      this.i++;
      const close = OPEN[c];
      const inner = this.expr(close);
      if (this.peek() === close) this.i++;
      return { tex: `\\left${BRACKET_TEX[c]}${inner}\\right${BRACKET_TEX[close]}`, inner };
    }
    if (c === '√' || c === '∛' || c === '∜') {
      this.i++;
      // √(n&x): the n-th root.
      if (this.peek() === '(') {
        const at = this.i;
        this.i++;
        const first = this.expr(')&');
        if (this.peek() === '&') {
          this.i++;
          const rest = this.expr(')');
          if (this.peek() === ')') this.i++;
          return { tex: `\\sqrt[${first}]{${rest}}` };
        }
        this.i = at;
      }
      const arg = this.operand('');
      const body = arg ? (arg.inner ?? arg.tex) : '';
      return { tex: c === '√' ? `\\sqrt{${body}}` : `\\sqrt[${c === '∛' ? 3 : 4}]{${body}}` };
    }
    if (c === '■') {
      this.i++;
      if (this.peek() !== '(') return { tex: '' };
      this.i++;
      const rows: string[][] = [[]];
      for (;;) {
        rows[rows.length - 1].push(this.expr(')&@'));
        const n = this.peek();
        this.i++;
        if (n === '&') continue;
        if (n === '@') rows.push([]);
        else break;
      }
      return { tex: `\\begin{matrix}${rows.map((r) => r.join(' & ')).join(' \\\\ ')}\\end{matrix}` };
    }
    if (NARY[c]) {
      this.i++;
      return { tex: NARY[c], nary: true };
    }
    if (/[0-9.]/.test(c)) {
      const m = /^[0-9]*\.?[0-9]+|^[0-9]+/.exec(this.s.slice(this.i))!;
      this.i += m[0].length;
      return { tex: m[0] };
    }
    if (/[A-Za-z]/.test(c)) {
      const m = /^[A-Za-z]+/.exec(this.s.slice(this.i))!;
      const word = m[0];
      // A maths function (sin, lim…); otherwise a single letter (ab is a times b, and a/b takes just b).
      if (FUNCTIONS.has(word)) {
        this.i += word.length;
        return { tex: word === 'mod' ? '\\bmod ' : `\\${word} ` };
      }
      this.i++;
      return { tex: c };
    }
    this.i++;
    if (SYMBOLS[c]) return { tex: SYMBOLS[c] + (/[a-z]$/i.test(SYMBOLS[c]) ? ' ' : '') };
    return { tex: c };
  }
}

/** UnicodeMath as LaTeX. */
export function unicodeMathToLatex(src: string): string {
  return new Parser(src.replace(/\s+/g, ' ').trim()).expr('').replace(/\s+([}^_])/g, '$1').replace(/\{\s+/g, '{').replace(/(\\[A-Za-z]+) (?=[-+=*/,;)\]}|!<>])/g, '$1').trim();
}
