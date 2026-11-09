// The interface font (Onest) and the titles' and writing font (Newsreader), shipped with
// Crumpet rather than fetched from Google Fonts: they work offline, and opening Crumpet
// tells no one anything. Each file covers some alphabets; the browser fetches only those a
// page uses. Other writing fonts still come from Google Fonts when chosen (ui/fonts.ts).
import '@fontsource/onest/400.css';
import '@fontsource/onest/500.css';
import '@fontsource/onest/600.css';
import '@fontsource/onest/700.css';
import '@fontsource/newsreader/400.css';
import '@fontsource/newsreader/500.css';
import '@fontsource/newsreader/600.css';
import '@fontsource/newsreader/700.css';
import '@fontsource/newsreader/400-italic.css';
import '@fontsource/newsreader/500-italic.css';
import '@fontsource/newsreader/700-italic.css';

/** Families that come with the app, so never asked of Google. */
export const BUNDLED_FONTS = new Set(['Onest', 'Newsreader']);
