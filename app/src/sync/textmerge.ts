// Three-way merge of a note's Markdown: the changes made on each side since
// the version both started from, combined. Edits in different places merge;
// when they can't be combined cleanly the caller keeps both versions.

import { diff_match_patch } from 'diff-match-patch';

const dmp = new diff_match_patch();
// Patches must land where they were made, not somewhere that merely looks similar.
dmp.Match_Threshold = 0.2;
dmp.Patch_DeleteThreshold = 0.2;

/** The merged text, or null when the two sides' changes overlap. */
export function mergeText(base: string, ours: string, theirs: string): string | null {
  if (ours === theirs || theirs === base) return ours;
  if (ours === base) return theirs;
  const a = applyChanges(base, theirs, ours);
  const b = applyChanges(base, ours, theirs);
  // Combining in either order must give the same result; if it doesn't, the edits touch.
  return a !== null && a === b ? a : null;
}

/** Applies the changes from `base` to `changed` onto `target`. */
function applyChanges(base: string, changed: string, target: string): string | null {
  const diffs = dmp.diff_main(base, changed);
  dmp.diff_cleanupSemantic(diffs);
  const patches = dmp.patch_make(base, diffs);
  const [out, applied] = dmp.patch_apply(patches, target);
  return applied.every(Boolean) ? out : null;
}
