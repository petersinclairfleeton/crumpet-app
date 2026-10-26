// The grammar checker itself: Harper, loaded the first time it's needed (its
// engine is about 8 MB) and run on a thread of its own, so checking a long
// chapter never holds up typing. Nothing leaves this device.

import type { GrammarLint } from '../data/grammar';

export interface GrammarEngine {
  /** Everything Harper finds in the text (rules turned off left out). */
  lint(text: string): Promise<GrammarLint[]>;
}

type Harper = typeof import('harper.js');
type Linter = import('harper.js').Linter;

let loading: Promise<{ harper: Harper; linter: Linter }> | null = null;
let setUp = '';

async function load(): Promise<{ harper: Harper; linter: Linter }> {
  // The one-file build (for trying Crumpet out) would have to carry the whole engine inside it.
  if (import.meta.env.MODE === 'single') throw new Error('Grammar checking isn’t in the one-file version of Crumpet.');
  const [harper, { slimBinary }] = await Promise.all([import('harper.js'), import('harper.js/slimBinary')]);
  const linter: Linter = typeof Worker !== 'undefined' ? new harper.WorkerLinter({ binary: slimBinary }) : new harper.LocalLinter({ binary: slimBinary });
  await linter.setup();
  return { harper, linter };
}

/**
 * Harper, set up for American or British English (from the spelling language), your dictionary's words
 * (and characters' names) known, and the rules you turned off left off.
 */
export async function grammarEngine(opts: { lang?: string; words?: string[]; off?: string[] }): Promise<GrammarEngine> {
  if (!loading) {
    loading = load();
    loading.catch(() => (loading = null));
  }
  const { harper, linter } = await loading;
  const key = JSON.stringify([opts.lang ?? '', opts.words ?? [], opts.off ?? []]);
  if (key !== setUp) {
    await linter.setDialect(/^en-US$/i.test(opts.lang ?? '') ? harper.Dialect.American : harper.Dialect.British);
    await linter.clearWords();
    if (opts.words?.length) await linter.importWords(opts.words);
    const config = await linter.getDefaultLintConfig();
    for (const rule of opts.off ?? []) config[rule] = false;
    await linter.setLintConfig(config);
    setUp = key;
  }
  return {
    async lint(text: string) {
      const groups = await linter.organizedLints(text, { language: 'plaintext' });
      const out: GrammarLint[] = [];
      for (const [rule, lints] of Object.entries(groups)) {
        for (const l of lints) {
          const span = l.span();
          out.push({
            start: span.start,
            end: span.end,
            message: l.message(),
            kind: l.lint_kind(),
            rule,
            suggestions: l.suggestions().map((s) => {
              const kind = s.kind();
              return { kind: kind === harper.SuggestionKind.Remove ? 'remove' : kind === harper.SuggestionKind.InsertAfter ? 'insert' : 'replace', text: s.get_replacement_text() };
            }),
          });
        }
      }
      return out.sort((a, b) => a.start - b.start);
    },
  };
}
