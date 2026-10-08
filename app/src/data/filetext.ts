// The words in attached PDFs and pictures, so a search finds them (like
// Evernote's). PDFs are read with pdf.js; pictures with Tesseract (OCR),
// which runs in the browser from files shipped with the app (/ocr/), so no
// picture leaves the device. Both are loaded only when there's something to read.

const PDF = /\.pdf$/i;
const PICTURE = /\.(png|jpe?g|gif|webp|bmp)$/i;

/** Whether a file is one whose words can be read. */
export function readable(path: string): boolean {
  return PDF.test(path) || PICTURE.test(path);
}

/** The text of a PDF, page by page (up to 300 pages). */
export async function pdfText(blob: Blob): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()), isEvalSupported: false }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= Math.min(doc.numPages, 300); i++) {
    const content = await (await doc.getPage(i)).getTextContent();
    pages.push(content.items.map((it) => ('str' in it ? `${it.str}${it.hasEOL ? '\n' : ''}` : '')).join(''));
  }
  await doc.destroy();
  return tidy(pages.join('\n'));
}

let ocr: Promise<import('tesseract.js').Worker> | null = null;

/** The words in a picture, read by OCR (English). */
export async function pictureText(blob: Blob): Promise<string> {
  if (!ocr) {
    const base = `${import.meta.env.BASE_URL}ocr/`;
    ocr = import('tesseract.js').then((t) => t.createWorker('eng', 1, { workerPath: `${base}worker.min.js`, corePath: base, langPath: base, gzip: true, workerBlobURL: false }));
    ocr.catch(() => (ocr = null));
  }
  const { data } = await (await ocr).recognize(blob);
  // Words read with little confidence are mostly noise from the picture itself.
  const words = (data.words ?? []).filter((w) => w.confidence >= 55).map((w) => w.text);
  return tidy(words.length ? words.join(' ') : '');
}

export async function fileText(path: string, blob: Blob): Promise<string> {
  if (PDF.test(path)) return pdfText(blob);
  if (PICTURE.test(path)) return pictureText(blob);
  return '';
}

function tidy(text: string): string {
  return text.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, 200_000);
}
