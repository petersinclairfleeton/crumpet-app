// Word's Equation tools: structures (fractions, scripts, roots, integrals,
// big operators, brackets, matrices, accents, functions) and a palette of
// maths symbols, put into the LaTeX being written; typing in UnicodeMath
// ("a/b", "x^2", "√(a+b)") too. Shown over a maths block while its source is
// being edited (MathBlockBar), and in the card for an equation within a line
// (MathCard, opened by clicking one or with Alt+=). The formatting bar's
// Equation button adds either kind.

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Editor } from '@crumpet/editor/editor';
import type { Pos } from '@crumpet/editor/model';
import { unicodeMathToLatex } from '../data/unicodemath';
import { katexReady } from './coderender';
import { Popover } from './Sidebar';
import { type ToolItem, closeMore } from './toolbar';

/** A structure: what its button shows, its name, and its LaTeX (# marks a box to fill: the selection goes in the first). */
type Item = [glyph: string, name: string, tex: string];

export const STRUCTURES: [string, Item[]][] = [
  ['Fractions', [['a⁄b', 'Fraction', '\\frac{#}{#}'], ['a/b', 'Linear fraction', '#/#'], ['ⁿ⁄ₖ', 'Skewed fraction', '{}^{#}/_{#}'], ['(ⁿₖ)', 'Binomial', '\\binom{#}{#}']]],
  ['Scripts', [['xⁿ', 'Superscript', '{#}^{#}'], ['xₙ', 'Subscript', '{#}_{#}'], ['xₙⁿ', 'Subscript and superscript', '{#}_{#}^{#}'], ['ₙxⁿ', 'Scripts before', '{}_{#}^{#}{#}']]],
  ['Radicals', [['√x', 'Square root', '\\sqrt{#}'], ['ⁿ√x', 'Root', '\\sqrt[#]{#}'], ['∛x', 'Cube root', '\\sqrt[3]{#}']]],
  ['Integrals', [['∫', 'Integral', '\\int_{#}^{#} # \\, d#'], ['∬', 'Double integral', '\\iint_{#} # \\, dA'], ['∭', 'Triple integral', '\\iiint_{#} # \\, dV'], ['∮', 'Contour integral', '\\oint_{#} #'], ['∫', 'Integral (no limits)', '\\int # \\, d#']]],
  ['Large operators', [['∑', 'Sum', '\\sum_{#}^{#} #'], ['∏', 'Product', '\\prod_{#}^{#} #'], ['⋃', 'Union', '\\bigcup_{#}^{#} #'], ['⋂', 'Intersection', '\\bigcap_{#}^{#} #']]],
  ['Brackets', [['( )', 'Round brackets', '\\left( # \\right)'], ['[ ]', 'Square brackets', '\\left[ # \\right]'], ['{ }', 'Curly brackets', '\\left\\{ # \\right\\}'], ['| |', 'Absolute value', '\\left| # \\right|'], ['‖ ‖', 'Norm', '\\left\\| # \\right\\|'], ['⟨ ⟩', 'Angle brackets', '\\left\\langle # \\right\\rangle'], ['{', 'Cases', '\\begin{cases} # & \\text{if } # \\\\ # & \\text{otherwise} \\end{cases}']]],
  ['Functions', [['sin', 'Sine', '\\sin #'], ['cos', 'Cosine', '\\cos #'], ['tan', 'Tangent', '\\tan #'], ['log', 'Logarithm', '\\log_{#} #'], ['ln', 'Natural logarithm', '\\ln #'], ['eˣ', 'Exponential', 'e^{#}'], ['lim', 'Limit', '\\lim_{# \\to #} #'], ['max', 'Maximum', '\\max_{#} #']]],
  ['Accents', [['ẋ', 'Dot', '\\dot{#}'], ['ẍ', 'Double dot', '\\ddot{#}'], ['x̂', 'Hat', '\\hat{#}'], ['x̃', 'Tilde', '\\tilde{#}'], ['x̄', 'Bar', '\\bar{#}'], ['x⃗', 'Vector', '\\vec{#}'], ['x̲', 'Underline', '\\underline{#}'], ['⏞', 'Over brace', '\\overbrace{#}^{#}'], ['⏟', 'Under brace', '\\underbrace{#}_{#}']]],
  ['Matrices', [['[··]', '1 × 2 matrix', '\\begin{bmatrix} # & # \\end{bmatrix}'], ['[:]', '2 × 1 matrix', '\\begin{bmatrix} # \\\\ # \\end{bmatrix}'], ['(⠛)', '2 × 2 matrix', '\\begin{pmatrix} # & # \\\\ # & # \\end{pmatrix}'], ['[⠿]', '3 × 3 matrix', '\\begin{bmatrix} # & # & # \\\\ # & # & # \\\\ # & # & # \\end{bmatrix}'], ['|⠛|', 'Determinant', '\\begin{vmatrix} # & # \\\\ # & # \\end{vmatrix}'], ['⋱', 'Identity matrix', '\\begin{pmatrix} 1 & 0 & \\cdots & 0 \\\\ 0 & 1 & \\cdots & 0 \\\\ \\vdots & \\vdots & \\ddots & \\vdots \\\\ 0 & 0 & \\cdots & 1 \\end{pmatrix}']]],
  ['Operators', [['≝', 'Equal by definition', '\\overset{\\text{def}}{=}'], ['→ₓ', 'Arrow with text', '\\xrightarrow{#}'], ['∂/∂x', 'Partial derivative', '\\frac{\\partial #}{\\partial #}'], ['d/dx', 'Derivative', '\\frac{d#}{d#}'], ['∇', 'Gradient', '\\nabla #']]],
];

export const SYMBOLS: [string, Item[]][] = [
  ['Basic maths', [['±', 'Plus or minus', '\\pm'], ['∓', 'Minus or plus', '\\mp'], ['×', 'Times', '\\times'], ['÷', 'Divided by', '\\div'], ['·', 'Dot', '\\cdot'], ['∞', 'Infinity', '\\infty'], ['=', 'Equals', '='], ['≠', 'Not equal', '\\ne'], ['≈', 'Almost equal', '\\approx'], ['≡', 'Identical', '\\equiv'], ['∝', 'Proportional', '\\propto'], ['<', 'Less than', '<'], ['>', 'Greater than', '>'], ['≤', 'Less or equal', '\\le'], ['≥', 'Greater or equal', '\\ge'], ['≪', 'Much less', '\\ll'], ['≫', 'Much greater', '\\gg'], ['∂', 'Partial', '\\partial'], ['∇', 'Nabla', '\\nabla'], ['√', 'Root', '\\surd'], ['°', 'Degree', '^\\circ'], ['′', 'Prime', "'"], ['!', 'Factorial', '!'], ['%', 'Per cent', '\\%'], ['…', 'Dots', '\\ldots'], ['⋯', 'Centre dots', '\\cdots'], ['⋮', 'Vertical dots', '\\vdots'], ['⋱', 'Diagonal dots', '\\ddots']]],
  ['Greek letters', [['α', 'alpha', '\\alpha'], ['β', 'beta', '\\beta'], ['γ', 'gamma', '\\gamma'], ['δ', 'delta', '\\delta'], ['ε', 'epsilon', '\\epsilon'], ['ζ', 'zeta', '\\zeta'], ['η', 'eta', '\\eta'], ['θ', 'theta', '\\theta'], ['ι', 'iota', '\\iota'], ['κ', 'kappa', '\\kappa'], ['λ', 'lambda', '\\lambda'], ['μ', 'mu', '\\mu'], ['ν', 'nu', '\\nu'], ['ξ', 'xi', '\\xi'], ['π', 'pi', '\\pi'], ['ρ', 'rho', '\\rho'], ['σ', 'sigma', '\\sigma'], ['τ', 'tau', '\\tau'], ['υ', 'upsilon', '\\upsilon'], ['φ', 'phi', '\\phi'], ['χ', 'chi', '\\chi'], ['ψ', 'psi', '\\psi'], ['ω', 'omega', '\\omega'], ['Γ', 'Gamma', '\\Gamma'], ['Δ', 'Delta', '\\Delta'], ['Θ', 'Theta', '\\Theta'], ['Λ', 'Lambda', '\\Lambda'], ['Ξ', 'Xi', '\\Xi'], ['Π', 'Pi', '\\Pi'], ['Σ', 'Sigma', '\\Sigma'], ['Φ', 'Phi', '\\Phi'], ['Ψ', 'Psi', '\\Psi'], ['Ω', 'Omega', '\\Omega']]],
  ['Sets and logic', [['∈', 'Element of', '\\in'], ['∉', 'Not an element of', '\\notin'], ['⊂', 'Subset', '\\subset'], ['⊆', 'Subset or equal', '\\subseteq'], ['⊃', 'Superset', '\\supset'], ['∪', 'Union', '\\cup'], ['∩', 'Intersection', '\\cap'], ['∅', 'Empty set', '\\emptyset'], ['∀', 'For all', '\\forall'], ['∃', 'There exists', '\\exists'], ['∄', 'There is no', '\\nexists'], ['¬', 'Not', '\\neg'], ['∧', 'And', '\\wedge'], ['∨', 'Or', '\\vee'], ['∴', 'Therefore', '\\therefore'], ['∵', 'Because', '\\because'], ['ℕ', 'Natural numbers', '\\mathbb{N}'], ['ℤ', 'Integers', '\\mathbb{Z}'], ['ℚ', 'Rationals', '\\mathbb{Q}'], ['ℝ', 'Real numbers', '\\mathbb{R}'], ['ℂ', 'Complex numbers', '\\mathbb{C}']]],
  ['Arrows', [['→', 'Right arrow', '\\to'], ['←', 'Left arrow', '\\leftarrow'], ['↔', 'Both ways', '\\leftrightarrow'], ['⇒', 'Implies', '\\Rightarrow'], ['⇐', 'Implied by', '\\Leftarrow'], ['⇔', 'If and only if', '\\Leftrightarrow'], ['↑', 'Up', '\\uparrow'], ['↓', 'Down', '\\downarrow'], ['↦', 'Maps to', '\\mapsto'], ['⟶', 'Long arrow', '\\longrightarrow']]],
  ['Letter-like', [['ℏ', 'h-bar', '\\hbar'], ['ℓ', 'Script l', '\\ell'], ['ℵ', 'Aleph', '\\aleph'], ['℘', 'Weierstrass p', '\\wp'], ['ℜ', 'Real part', '\\Re'], ['ℑ', 'Imaginary part', '\\Im'], ['∎', 'End of proof', '\\blacksquare']]],
];

/** Puts a structure or symbol into a text box at its caret: the selection goes in its first box, and the caret goes to the next empty one. */
export function putInto(box: HTMLTextAreaElement | HTMLInputElement, tex: string): void {
  const { selectionStart: a = 0, selectionEnd: b = 0, value } = box;
  const from = a ?? 0;
  const to = b ?? 0;
  const picked = value.slice(from, to);
  let text = tex;
  if (text.includes('#')) text = text.replace('#', picked || '#');
  else if (picked) text = `${text} ${picked}`;
  // A command needs a space after it if a letter follows.
  if (/\\[A-Za-z]+$/.test(text) && /^[A-Za-z]/.test(value.slice(to))) text += ' ';
  const hole = text.indexOf('#');
  const clean = text.replace(/#/g, '');
  box.setRangeText(clean, from, to, 'end');
  if (hole >= 0) box.setSelectionRange(from + hole, from + hole);
  box.dispatchEvent(new Event('input', { bubbles: true }));
}

/** The structures and symbols, in groups; buttons keep the text box's caret (they never take the focus). */
export function MathPalette({ onPick }: { onPick(tex: string): void }) {
  const [kind, setKind] = useState<'structures' | 'symbols'>('structures');
  const groups = kind === 'structures' ? STRUCTURES : SYMBOLS;
  const [group, setGroup] = useState(0);
  const items = groups[Math.min(group, groups.length - 1)][1];
  return (
    <div className="math-palette" onMouseDown={(e) => (e.target as Element).closest('button') && e.preventDefault()}>
      <div className="math-palette-head">
        <div className="segmented small" role="group" aria-label="Equation tools">
          <button type="button" aria-pressed={kind === 'structures'} onClick={() => (setKind('structures'), setGroup(0))}>
            Structures
          </button>
          <button type="button" aria-pressed={kind === 'symbols'} onClick={() => (setKind('symbols'), setGroup(0))}>
            Symbols
          </button>
        </div>
        <select aria-label={kind === 'structures' ? 'Kind of structure' : 'Kind of symbol'} value={group} onChange={(e) => setGroup(Number(e.target.value))}>
          {groups.map(([name], i) => (
            <option key={name} value={i}>
              {name}
            </option>
          ))}
        </select>
      </div>
      <div className={`math-items ${kind}`} role="group" aria-label={groups[group]?.[0]}>
        {items.map(([glyph, name, tex]) => (
          <button key={name} type="button" className="math-item" title={`${name}: ${tex.replace(/#/g, '□')}`} aria-label={name} onClick={() => onPick(tex)}>
            {glyph}
          </button>
        ))}
      </div>
    </div>
  );
}

/** A line to type UnicodeMath in ("a/b", "x^2", "√(a+b)"): Enter puts it in as LaTeX. */
function UnicodeLine({ onPut }: { onPut(tex: string): void }) {
  const [value, setValue] = useState('');
  const tex = value.trim() ? unicodeMathToLatex(value) : '';
  return (
    <form
      className="math-unicode"
      onSubmit={(e) => {
        e.preventDefault();
        if (!tex) return;
        onPut(tex);
        setValue('');
      }}
    >
      <input aria-label="UnicodeMath" placeholder="Type UnicodeMath, like a/b or x^2 or √(a+b), then Enter" value={value} onChange={(e) => setValue(e.target.value)} />
      {tex && <code className="math-unicode-tex" title="As LaTeX">{tex}</code>}
    </form>
  );
}

/** The tools over a maths block while its source is being edited. */
export function MathBlockBar({ host }: { host: React.RefObject<HTMLElement> }) {
  const [box, setBox] = useState<HTMLTextAreaElement | null>(null);
  const [place, setPlace] = useState<{ top: number; left: number; width: number } | null>(null);
  const bar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const isMaths = (t: EventTarget | null): t is HTMLTextAreaElement => t instanceof HTMLTextAreaElement && t.matches('.code-wrap[data-lang="math"] .code-src');
    const onIn = (e: FocusEvent) => isMaths(e.target) && setBox(e.target);
    const onOut = (e: FocusEvent) => {
      if (!isMaths(e.target)) return;
      // Into the tools (the UnicodeMath line, the group menu) keeps them.
      if (e.relatedTarget instanceof Node && bar.current?.contains(e.relatedTarget)) return;
      setBox(null);
    };
    el.addEventListener('focusin', onIn);
    el.addEventListener('focusout', onOut);
    return () => {
      el.removeEventListener('focusin', onIn);
      el.removeEventListener('focusout', onOut);
    };
  }, [host]);
  useLayoutEffect(() => {
    if (!box) return setPlace(null);
    const measure = () => {
      if (!box.isConnected) return setBox(null);
      const wrap = box.closest('.code-wrap') ?? box;
      const r = wrap.getBoundingClientRect();
      const h = bar.current?.offsetHeight ?? 120;
      const width = Math.min(Math.max(r.width, 360), window.innerWidth - 16);
      setPlace({ top: r.top - h - 6 > 8 ? r.top - h - 6 : r.bottom + 6, left: Math.min(window.innerWidth - width - 8, Math.max(8, r.left)), width });
    };
    measure();
    const again = () => requestAnimationFrame(measure);
    window.addEventListener('scroll', again, true);
    window.addEventListener('resize', again);
    box.addEventListener('input', again);
    return () => {
      window.removeEventListener('scroll', again, true);
      window.removeEventListener('resize', again);
      box.removeEventListener('input', again);
    };
  }, [box]);
  if (!box) return null;
  const put = (tex: string) => {
    if (document.activeElement !== box) box.focus();
    putInto(box, tex);
  };
  return (
    <div
      ref={bar}
      className="math-bar"
      role="toolbar"
      aria-label="Equation"
      style={place ? { top: place.top, left: place.left, width: place.width } : { visibility: 'hidden' }}
      onBlur={(e) => {
        if (!(e.relatedTarget instanceof Node) || (e.relatedTarget !== box && !bar.current?.contains(e.relatedTarget))) setBox(null);
      }}
    >
      <MathPalette onPick={put} />
      <UnicodeLine onPut={put} />
    </div>
  );
}

/** The card for an equation within a line: its LaTeX (or UnicodeMath), a preview, the tools; on its own line, or taken out. */
export function MathCard({ editor }: { editor: Editor | null }) {
  const [open, setOpen] = useState<{ at: Pos; tex: string; el: HTMLElement } | null>(null);
  const [value, setValue] = useState('');
  const [unicode, setUnicode] = useState(false);
  const [place, setPlace] = useState<{ top: number; left: number } | null>(null);
  const card = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const preview = useRef<HTMLDivElement>(null);
  const latest = useRef({ open, value, unicode });
  latest.current = { open, value, unicode };

  useEffect(() => {
    if (!editor) return;
    editor.onMathClick = (at, tex, el) => {
      setOpen({ at, tex, el });
      setValue(tex);
      setUnicode(false);
    };
    return () => {
      editor.onMathClick = null;
    };
  }, [editor]);

  const texNow = () => (latest.current.unicode ? unicodeMathToLatex(latest.current.value) : latest.current.value).trim();

  const close = (save: boolean) => {
    const o = latest.current.open;
    if (!editor || !o) return;
    setOpen(null);
    const tex = texNow();
    // A new equation left empty (or Esc on one) is taken out.
    if (save) editor.setMath(o.at, tex);
    else if (!o.tex) editor.setMath(o.at, '');
    editor.focusPos({ block: o.at.block, offset: o.at.offset + (save ? (tex ? 1 : 0) : o.tex ? 1 : 0) });
  };

  useLayoutEffect(() => {
    if (!open) return setPlace(null);
    const r = open.el.getBoundingClientRect();
    const w = Math.min(420, window.innerWidth - 16);
    const h = card.current?.offsetHeight ?? 260;
    const below = r.bottom + 8 + h < window.innerHeight;
    setPlace({ top: below ? r.bottom + 8 : Math.max(8, r.top - 8 - h), left: Math.min(window.innerWidth - w - 8, Math.max(8, r.left - 20)) });
  }, [open]);

  useEffect(() => {
    if (!place || !field.current || field.current === document.activeElement) return;
    field.current.focus();
    field.current.select();
  }, [place]);

  // The preview, drawn by KaTeX as it's typed.
  useEffect(() => {
    if (!open) return;
    const tex = (unicode ? unicodeMathToLatex(value) : value).trim();
    let stale = false;
    void katexReady().then((k) => {
      const out = preview.current;
      if (stale || !out) return;
      try {
        k.default.render(tex || '\\square', out, { throwOnError: true, output: 'htmlAndMathml' });
        out.classList.remove('bad');
      } catch (e) {
        out.textContent = (e as Error).message.replace(/^KaTeX parse error: /, '');
        out.classList.add('bad');
      }
    });
    return () => {
      stale = true;
    };
  }, [open, value, unicode]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (card.current && !card.current.contains(e.target as Node)) close(true);
    };
    document.addEventListener('mousedown', onDown, true);
    return () => document.removeEventListener('mousedown', onDown, true);
  });

  if (!open) return null;
  return (
    <div
      ref={card}
      className="math-card"
      role="dialog"
      aria-label="Equation"
      style={place ? { top: place.top, left: place.left } : { visibility: 'hidden' }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          close(false);
        }
      }}
    >
      <div className="math-card-head">
        <div className="segmented small" role="group" aria-label="Write in" onMouseDown={(e) => e.preventDefault()} onClick={() => field.current?.focus()}>
          <button type="button" aria-pressed={!unicode} onClick={() => (unicode ? (setValue(unicodeMathToLatex(value)), setUnicode(false)) : undefined)}>
            LaTeX
          </button>
          <button type="button" aria-pressed={unicode} onClick={() => setUnicode(true)}>
            UnicodeMath
          </button>
        </div>
      </div>
      <textarea
        ref={field}
        className="math-card-src"
        aria-label={unicode ? 'Equation (UnicodeMath)' : 'Equation (LaTeX)'}
        rows={2}
        spellCheck={false}
        value={value}
        placeholder={unicode ? 'a/b, x^2, √(a+b), ∑_(i=1)^n i' : '\\frac{a}{b}, x^2, \\sqrt{a+b}'}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            close(true);
          }
        }}
      />
      <div ref={preview} className="math-card-preview" aria-label="Preview" />
      <MathPalette
        onPick={(tex) => {
          const box = field.current;
          if (!box) return;
          if (unicode) {
            // In UnicodeMath, symbols go in as their characters.
            box.setRangeText(tex.startsWith('\\') ? tex + ' ' : tex.replace(/#/g, ''), box.selectionStart ?? 0, box.selectionEnd ?? 0, 'end');
            setValue(box.value);
            return;
          }
          putInto(box, tex);
          setValue(box.value);
        }}
      />
      <div className="math-card-foot">
        <button type="button" className="btn quiet small" onClick={() => (setOpen(null), editor?.setMath(open.at, ''))}>
          Remove
        </button>
        <button
          type="button"
          className="btn quiet small"
          onClick={() => {
            const tex = texNow();
            setOpen(null);
            editor?.setMath(open.at, tex);
            if (tex) editor?.mathOwnLine(open.at);
          }}
        >
          On its own line
        </button>
        <span className="grow" />
        <button type="button" className="btn primary small" onClick={() => close(true)}>
          Done
        </button>
      </div>
    </div>
  );
}

const ICON_EQ = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M18 4H6l6 8-6 8h12" />
  </svg>
);

function EquationTool({ ed, off }: { ed: Editor | null; off: boolean }) {
  const [open, setOpen] = useState(false);
  const done = () => (setOpen(false), closeMore());
  return (
    <span className="tool-drop">
      <button type="button" aria-label="Equation" title="Equation (Alt+=)" aria-expanded={open} disabled={off} onClick={() => setOpen(!open)}>
        {ICON_EQ}
        <span aria-hidden="true" className="caret">
          ▾
        </span>
      </button>
      {open && (
        <Popover label="Equation" onClose={() => setOpen(false)}>
          <div className="menu-list">
            <button
              type="button"
              className="menu-item"
              onClick={() => {
                done();
                ed?.focus();
                ed?.insertMath();
              }}
            >
              <span className="menu-glyph">x²</span> Equation in the line <small className="menu-key">Alt+=</small>
            </button>
            <button
              type="button"
              className="menu-item"
              onClick={() => {
                done();
                ed?.focus();
                ed?.insertCode('math');
              }}
            >
              <span className="menu-glyph">∑</span> Equation on its own line
            </button>
            <p className="menu-note">Write in LaTeX or UnicodeMath, with structures and symbols to pick from. Equations go to Word as Word’s own.</p>
          </div>
        </Popover>
      )}
    </span>
  );
}

export function mathItems(ed: Editor | null, off: boolean): ToolItem[] {
  return [{ key: 'equation', label: 'Equation', pri: 1, node: <EquationTool ed={ed} off={off} /> }];
}
