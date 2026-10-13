// Equations to and from Word. Going out, LaTeX is drawn as MathML by KaTeX
// and that is turned into Word's own maths (Office Math, OMML), so equations
// open in Word as equations to edit there. Coming in, Word's maths is read
// back as LaTeX (fractions, scripts, roots, n-ary operators, brackets,
// matrices, accents, functions and limits).

export const M_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/math';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const NARY = new Set(['∑', '∏', '∐', '∫', '∬', '∭', '∮', '⋃', '⋂', '⋁', '⋀']);

// ---------------------------------------------------------------- MathML → OMML

const kids = (el: Element) => Array.from(el.children);

function run(text: string, upright = false, plain = false): string {
  if (!text) return '';
  const pr = plain ? '<m:rPr><m:nor/></m:rPr>' : upright ? '<m:rPr><m:sty m:val="p"/></m:rPr>' : '';
  return `<m:r>${pr}<m:t xml:space="preserve">${esc(text)}</m:t></m:r>`;
}

/** The n-ary operator a script element is built on, if it's one (∑ with its limits). */
function naryOf(el: Element): string | null {
  const name = el.localName;
  if (name === 'mo' && NARY.has(el.textContent?.trim() ?? '')) return el.textContent!.trim();
  if (['msub', 'msup', 'msubsup', 'munder', 'mover', 'munderover'].includes(name)) {
    const base = el.children[0];
    if (base?.localName === 'mo' && NARY.has(base.textContent?.trim() ?? '')) return base.textContent!.trim();
  }
  return null;
}

function nary(el: Element, body: string): string {
  const chr = naryOf(el)!;
  const [, a, b] = kids(el);
  const name = el.localName;
  const sub = name === 'msub' || name === 'munder' || name === 'msubsup' || name === 'munderover' ? a : undefined;
  const sup = name === 'msup' || name === 'mover' ? a : name === 'msubsup' || name === 'munderover' ? b : undefined;
  const limLoc = name.startsWith('mu') || chr === '∑' || chr === '∏' ? 'undOvr' : 'subSup';
  return `<m:nary><m:naryPr><m:chr m:val="${chr}"/><m:limLoc m:val="${limLoc}"/>${sub ? '' : '<m:subHide m:val="1"/>'}${sup ? '' : '<m:supHide m:val="1"/>'}</m:naryPr><m:sub>${sub ? node(sub) : ''}</m:sub><m:sup>${sup ? node(sup) : ''}</m:sup><m:e>${body}</m:e></m:nary>`;
}

/** A row of things: n-ary operators take what follows them as their body; \left( … \right) becomes brackets. */
function row(list: Element[]): string {
  // Brackets: \left and \right are marked as fences by KaTeX.
  if (list.length >= 2) {
    const [first, last] = [list[0], list[list.length - 1]];
    if (first.localName === 'mo' && last.localName === 'mo' && first.getAttribute('fence') === 'true' && last.getAttribute('fence') === 'true') {
      const beg = first.textContent ?? '';
      const end = last.textContent ?? '';
      return `<m:d><m:dPr><m:begChr m:val="${esc(beg)}"/><m:endChr m:val="${esc(end)}"/></m:dPr><m:e>${row(list.slice(1, -1))}</m:e></m:d>`;
    }
  }
  let out = '';
  for (let i = 0; i < list.length; i++) {
    const el = list[i];
    if (naryOf(el)) {
      const next = list[i + 1];
      out += nary(el, next ? node(next) : '');
      if (next) i++;
    } else out += node(el);
  }
  return out;
}

function node(el: Element): string {
  const k = kids(el);
  switch (el.localName) {
    case 'math':
    case 'semantics':
    case 'mrow':
    case 'mstyle':
    case 'mpadded':
    case 'mphantom':
    case 'menclose':
      return row(k.filter((c) => c.localName !== 'annotation'));
    case 'annotation':
      return '';
    case 'mi': {
      const t = el.textContent ?? '';
      return run(t, el.getAttribute('mathvariant') === 'normal' || t.length > 1);
    }
    case 'mn':
      return run(el.textContent ?? '');
    case 'mo':
      return run(el.textContent ?? '', true);
    case 'mtext':
      return run(el.textContent ?? '', false, true);
    case 'mspace':
      return run(' ');
    case 'mfrac': {
      const noBar = /^0(\.0+)?(px|em)?$/.test(el.getAttribute('linethickness') ?? '');
      return `<m:f>${noBar ? '<m:fPr><m:type m:val="noBar"/></m:fPr>' : ''}<m:num>${node(k[0])}</m:num><m:den>${node(k[1])}</m:den></m:f>`;
    }
    case 'msqrt':
      return `<m:rad><m:radPr><m:degHide m:val="1"/></m:radPr><m:deg/><m:e>${row(k)}</m:e></m:rad>`;
    case 'mroot':
      return `<m:rad><m:deg>${node(k[1])}</m:deg><m:e>${node(k[0])}</m:e></m:rad>`;
    case 'msup':
      return naryOf(el) ? nary(el, '') : `<m:sSup><m:e>${node(k[0])}</m:e><m:sup>${node(k[1])}</m:sup></m:sSup>`;
    case 'msub':
      return naryOf(el) ? nary(el, '') : `<m:sSub><m:e>${node(k[0])}</m:e><m:sub>${node(k[1])}</m:sub></m:sSub>`;
    case 'msubsup':
      return naryOf(el) ? nary(el, '') : `<m:sSubSup><m:e>${node(k[0])}</m:e><m:sub>${node(k[1])}</m:sub><m:sup>${node(k[2])}</m:sup></m:sSubSup>`;
    case 'mover':
      if (el.getAttribute('accent') === 'true' && k[1]?.localName === 'mo') return `<m:acc><m:accPr><m:chr m:val="${esc(accentChar(k[1].textContent ?? ''))}"/></m:accPr><m:e>${node(k[0])}</m:e></m:acc>`;
      return naryOf(el) ? nary(el, '') : `<m:limUpp><m:e>${node(k[0])}</m:e><m:lim>${node(k[1])}</m:lim></m:limUpp>`;
    case 'munder':
      return naryOf(el) ? nary(el, '') : `<m:limLow><m:e>${node(k[0])}</m:e><m:lim>${node(k[1])}</m:lim></m:limLow>`;
    case 'munderover':
      return naryOf(el) ? nary(el, '') : `<m:limUpp><m:e><m:limLow><m:e>${node(k[0])}</m:e><m:lim>${node(k[1])}</m:lim></m:limLow></m:e><m:lim>${node(k[2])}</m:lim></m:limUpp>`;
    case 'mtable':
      return `<m:m>${k.map((tr) => `<m:mr>${kids(tr).map((td) => `<m:e>${row(kids(td))}</m:e>`).join('')}</m:mr>`).join('')}</m:m>`;
    default:
      return row(k) || run(el.textContent ?? '');
  }
}

/** Combining accents for Word (KaTeX draws them with the spacing forms). */
function accentChar(c: string): string {
  return ({ '^': '̂', 'ˆ': '̂', '~': '̃', '˜': '̃', '¯': '̅', '‾': '̅', '→': '⃗', '⃗': '⃗', '˙': '̇', '¨': '̈', 'ˇ': '̌', '´': '́', '`': '̀', '˘': '̆' } as Record<string, string>)[c.trim()] ?? c.trim();
}

/** Word's maths for some LaTeX (what goes inside m:oMath), or null if it can't be read. */
export function latexToOmml(katex: typeof import('katex'), tex: string, display = false): string | null {
  let html: string;
  try {
    html = katex.default.renderToString(tex, { output: 'mathml', throwOnError: true, displayMode: display });
  } catch {
    return null;
  }
  const math = new DOMParser().parseFromString(html, 'text/html').querySelector('math');
  return math ? node(math) : null;
}

// ---------------------------------------------------------------- OMML → LaTeX

/** LaTeX for characters Word's maths uses. */
const TEX: Record<string, string> = {
  α: '\\alpha', β: '\\beta', γ: '\\gamma', δ: '\\delta', ε: '\\epsilon', ζ: '\\zeta', η: '\\eta', θ: '\\theta', ι: '\\iota', κ: '\\kappa', λ: '\\lambda', μ: '\\mu', ν: '\\nu', ξ: '\\xi', π: '\\pi', ρ: '\\rho', σ: '\\sigma', τ: '\\tau', υ: '\\upsilon', φ: '\\varphi', χ: '\\chi', ψ: '\\psi', ω: '\\omega',
  Γ: '\\Gamma', Δ: '\\Delta', Θ: '\\Theta', Λ: '\\Lambda', Ξ: '\\Xi', Π: '\\Pi', Σ: '\\Sigma', Φ: '\\Phi', Ψ: '\\Psi', Ω: '\\Omega',
  '±': '\\pm', '∓': '\\mp', '×': '\\times', '÷': '\\div', '·': '\\cdot', '⋅': '\\cdot', '−': '-', '≠': '\\ne', '≤': '\\le', '≥': '\\ge', '≈': '\\approx', '≡': '\\equiv', '∞': '\\infty', '∂': '\\partial', '∇': '\\nabla', '∈': '\\in', '∉': '\\notin', '⊂': '\\subset', '⊆': '\\subseteq', '∪': '\\cup', '∩': '\\cap', '∅': '\\emptyset', '∀': '\\forall', '∃': '\\exists', '→': '\\to', '←': '\\leftarrow', '⇒': '\\Rightarrow', '⇔': '\\Leftrightarrow', '…': '\\ldots', '⋯': '\\cdots', '∝': '\\propto', '∼': '\\sim', '°': '^\\circ',
};
const NARY_TEX: Record<string, string> = { '∑': '\\sum', '∏': '\\prod', '∐': '\\coprod', '∫': '\\int', '∬': '\\iint', '∭': '\\iiint', '∮': '\\oint', '⋃': '\\bigcup', '⋂': '\\bigcap', '⋁': '\\bigvee', '⋀': '\\bigwedge' };
const ACCENT_TEX: Record<string, string> = { '̂': '\\hat', '̃': '\\tilde', '̅': '\\bar', '̄': '\\bar', '⃗': '\\vec', '̇': '\\dot', '̈': '\\ddot', '̌': '\\check', '́': '\\acute', '̀': '\\grave', '̆': '\\breve' };
const FUNCS = new Set(['sin', 'cos', 'tan', 'cot', 'sec', 'csc', 'sinh', 'cosh', 'tanh', 'log', 'ln', 'exp', 'lim', 'max', 'min', 'sup', 'inf', 'det', 'gcd', 'arg', 'deg', 'dim']);
const BRACKETS: Record<string, string> = { '{': '\\{', '}': '\\}', '⟨': '\\langle', '⟩': '\\rangle', '‖': '\\|', '⌊': '\\lfloor', '⌋': '\\rfloor', '⌈': '\\lceil', '⌉': '\\rceil', '': '.' };

const m = (el: Element | null | undefined, name: string) => (el ? Array.from(el.children).find((c) => c.localName === name && c.namespaceURI === M_NS) ?? null : null);
const val = (el: Element | null | undefined, name: string) => m(el, name)?.getAttributeNS(M_NS, 'val') ?? m(el, name)?.getAttribute('m:val') ?? null;

function texText(t: string, upright: boolean): string {
  if (upright && FUNCS.has(t.trim())) return `\\${t.trim()} `;
  if (upright && /^[A-Za-z]{2,}$/.test(t.trim())) return `\\mathrm{${t.trim()}}`;
  return Array.from(t).map((c) => (TEX[c] ? `${TEX[c]}${/[a-z]$/i.test(TEX[c]) ? ' ' : ''}` : c === '{' || c === '}' ? `\\${c}` : c)).join('');
}

/** LaTeX for the children of an OMML element. */
function texOf(el: Element | null): string {
  if (!el) return '';
  return Array.from(el.children)
    .map((c) => texNode(c))
    .join('')
    .replace(/ +/g, ' ');
}

const group = (s: string) => (s.length === 1 ? s : `{${s.trim()}}`);

function texNode(el: Element): string {
  if (el.namespaceURI !== M_NS) return '';
  const pr = (name: string) => m(el, name);
  switch (el.localName) {
    case 'r': {
      const t = Array.from(el.children).filter((c) => c.localName === 't').map((c) => c.textContent ?? '').join('');
      const rpr = pr('rPr');
      if (m(rpr, 'nor')) return `\\text{${t}}`;
      return texText(t, val(rpr, 'sty') === 'p');
    }
    case 'f': {
      const noBar = val(pr('fPr'), 'type') === 'noBar';
      return `${noBar ? '\\binom' : '\\frac'}{${texOf(pr('num'))}}{${texOf(pr('den'))}}`;
    }
    case 'sSup':
      return `${group(texOf(pr('e')))}^{${texOf(pr('sup'))}}`;
    case 'sSub':
      return `${group(texOf(pr('e')))}_{${texOf(pr('sub'))}}`;
    case 'sSubSup':
      return `${group(texOf(pr('e')))}_{${texOf(pr('sub'))}}^{${texOf(pr('sup'))}}`;
    case 'sPre':
      return `{}_{${texOf(pr('sub'))}}^{${texOf(pr('sup'))}}${texOf(pr('e'))}`;
    case 'rad': {
      const hide = /^(1|on|true)$/.test(val(pr('radPr'), 'degHide') ?? '');
      const deg = texOf(pr('deg'));
      return hide || !deg ? `\\sqrt{${texOf(pr('e'))}}` : `\\sqrt[${deg}]{${texOf(pr('e'))}}`;
    }
    case 'nary': {
      const npr = pr('naryPr');
      const chr = val(npr, 'chr') ?? '∫';
      const sub = /^(1|on|true)$/.test(val(npr, 'subHide') ?? '') ? '' : texOf(pr('sub'));
      const sup = /^(1|on|true)$/.test(val(npr, 'supHide') ?? '') ? '' : texOf(pr('sup'));
      return `${NARY_TEX[chr] ?? chr}${sub ? `_{${sub}}` : ''}${sup ? `^{${sup}}` : ''} ${texOf(pr('e'))}`;
    }
    case 'd': {
      const dpr = pr('dPr');
      const beg = val(dpr, 'begChr') ?? '(';
      const end = val(dpr, 'endChr') ?? ')';
      const sep = val(dpr, 'sepChr') ?? '|';
      const es = Array.from(el.children).filter((c) => c.localName === 'e');
      // (n over k) with no bar: a binomial.
      const only = es.length === 1 && es[0].children.length === 1 ? es[0].children[0] : null;
      if (beg === '(' && end === ')' && only?.localName === 'f' && val(m(only, 'fPr'), 'type') === 'noBar') return texNode(only);
      const parts = es.map((e) => texOf(e));
      return `\\left${BRACKETS[beg] ?? beg}${parts.join(sep === '|' ? ' \\mid ' : sep)}\\right${BRACKETS[end] ?? end}`;
    }
    case 'm': {
      const rows = Array.from(el.children).filter((c) => c.localName === 'mr').map((r) => Array.from(r.children).filter((c) => c.localName === 'e').map((e) => texOf(e)).join(' & '));
      return `\\begin{matrix}${rows.join(' \\\\ ')}\\end{matrix}`;
    }
    case 'acc': {
      const chr = val(pr('accPr'), 'chr') ?? '̂';
      return `${ACCENT_TEX[chr] ?? '\\hat'}{${texOf(pr('e'))}}`;
    }
    case 'bar':
      return val(pr('barPr'), 'pos') === 'bot' ? `\\underline{${texOf(pr('e'))}}` : `\\overline{${texOf(pr('e'))}}`;
    case 'func':
      return `${texOf(pr('fName')).trim()} ${texOf(pr('e'))}`;
    case 'limLow':
      return `${group(texOf(pr('e')).trim())}_{${texOf(pr('lim'))}}`;
    case 'limUpp':
      return `${group(texOf(pr('e')).trim())}^{${texOf(pr('lim'))}}`;
    case 'groupChr': {
      const pos = val(pr('groupChrPr'), 'pos');
      return pos === 'top' ? `\\overbrace{${texOf(pr('e'))}}` : `\\underbrace{${texOf(pr('e'))}}`;
    }
    case 'eqArr':
      return `\\begin{aligned}${Array.from(el.children).filter((c) => c.localName === 'e').map((e) => texOf(e)).join(' \\\\ ')}\\end{aligned}`;
    case 'box':
    case 'borderBox':
    case 'phant':
    case 'e':
    case 'oMath':
      return texOf(m(el, 'e') && el.localName !== 'e' && el.localName !== 'oMath' ? m(el, 'e') : el);
    default:
      return '';
  }
}

/** LaTeX for one of Word's equations (an m:oMath element). */
export function ommlToLatex(oMath: Element): string {
  return texOf(oMath).replace(/\s+/g, ' ').replace(/\s+([}^_])/g, '$1').trim();
}
