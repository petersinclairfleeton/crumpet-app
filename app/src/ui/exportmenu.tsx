// Downloading in other formats (Word's Save As types): menu items for
// OpenDocument, Rich Text, a web page and plain text.

import type { ExportPart } from '../data/exports';
import { exportAs } from '../data/wordfiles';
import { IconDownload } from './icons';

const ITEMS: ['odt' | 'rtf' | 'html' | 'txt', string][] = [
  ['odt', 'OpenDocument (LibreOffice)'],
  ['rtf', 'Rich Text'],
  ['html', 'Web page'],
  ['txt', 'Plain text'],
];

export function ExportItems({ title, parts, onDone }: { title: string; parts: () => ExportPart[]; onDone(): void }) {
  return (
    <>
      {ITEMS.map(([kind, name]) => (
        <button
          key={kind}
          type="button"
          className="menu-item"
          aria-label={`Download as ${name}`}
          onClick={async () => {
            onDone();
            await exportAs(kind, title, parts());
          }}
        >
          <IconDownload size={14} /> {name} <small className="menu-hint">.{kind}</small>
        </button>
      ))}
    </>
  );
}
