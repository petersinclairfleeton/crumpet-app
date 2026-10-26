// Scripts: a screenplay's elements (or a stage play's) as paragraph styles.
// Enter goes on to the element that usually comes next (a character's name
// is followed by their dialogue), Tab and Shift+Tab change the element, and
// Enter on an empty element turns it into action, as script software does.
// A stage play is the same elements laid out its own way (`para.script` on
// the first paragraph).

export const SCRIPT_STYLES = ['sc-scene', 'sc-action', 'sc-char', 'sc-paren', 'sc-dial', 'sc-trans'] as const;
export type ScriptStyle = (typeof SCRIPT_STYLES)[number];

export function isScript(style: string | undefined): style is ScriptStyle {
  return !!style && (SCRIPT_STYLES as readonly string[]).includes(style);
}

/** What Enter at the end of an element starts. */
export const SCRIPT_ENTER: Record<ScriptStyle, ScriptStyle> = {
  'sc-scene': 'sc-action',
  'sc-action': 'sc-action',
  'sc-char': 'sc-dial',
  'sc-paren': 'sc-dial',
  'sc-dial': 'sc-action',
  'sc-trans': 'sc-scene',
};

/** The order Tab goes through the elements (Shift+Tab goes back). */
const CYCLE: ScriptStyle[] = ['sc-action', 'sc-char', 'sc-dial', 'sc-paren', 'sc-trans', 'sc-scene'];

export function scriptCycle(style: ScriptStyle, dir: 1 | -1): ScriptStyle {
  const i = CYCLE.indexOf(style);
  return CYCLE[(i + dir + CYCLE.length) % CYCLE.length];
}
