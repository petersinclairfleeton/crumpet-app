// Changing a picture's pixels, in the browser: taking away a plain
// background (Word's Remove Background, done by colour: what touches the
// picture's edges and is close to the edges' main colour goes), and
// compressing (fewer pixels for how big it's shown, cropped parts thrown
// away, saved as JPEG unless it has see-through parts).

/** Loads a picture to draw from; pictures from other websites need their permission (or the canvas can't be read). */
export function loadPicture(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (/^https?:/i.test(url) && !url.startsWith(location.origin)) img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('That picture couldn’t be opened.'));
    img.src = url;
  });
}

/** A canvas holding (part of) a picture, at `scale`. */
function draw(img: HTMLImageElement, area = { x: 0, y: 0, w: img.naturalWidth, h: img.naturalHeight }, scale = 1): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(area.w * scale));
  c.height = Math.max(1, Math.round(area.h * scale));
  const g = c.getContext('2d')!;
  g.imageSmoothingQuality = 'high';
  g.drawImage(img, area.x, area.y, area.w, area.h, 0, 0, c.width, c.height);
  return c;
}

function pixels(c: HTMLCanvasElement): ImageData {
  try {
    return c.getContext('2d')!.getImageData(0, 0, c.width, c.height);
  } catch {
    throw new Error('That picture comes from a website that doesn’t allow changing it here. Save it to your computer and add it again.');
  }
}

/**
 * The background taken away: the main colour round the picture's edges, and
 * everything joined to the edges that's close to it (`tolerance` 0 to 100,
 * how close), with a soft edge where it meets what's kept.
 */
export function removeBackground(data: ImageData, tolerance: number): ImageData {
  const { width: w, height: h } = data;
  const px = data.data;
  const out = new ImageData(new Uint8ClampedArray(px), w, h);
  // The edges' main colour: the most common (roughly), averaged.
  const border: number[] = [];
  for (let x = 0; x < w; x++) border.push(x, (h - 1) * w + x);
  for (let y = 1; y < h - 1; y++) border.push(y * w, y * w + w - 1);
  const buckets = new Map<number, { n: number; r: number; g: number; b: number }>();
  for (const i of border) {
    const r = px[i * 4];
    const g = px[i * 4 + 1];
    const b = px[i * 4 + 2];
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const s = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    s.n++;
    s.r += r;
    s.g += g;
    s.b += b;
    buckets.set(key, s);
  }
  const top = [...buckets.values()].sort((a, b) => b.n - a.n)[0];
  const bg = [top.r / top.n, top.g / top.n, top.b / top.n];
  const tol = 8 + (tolerance / 100) * 160;
  const dist = (i: number, c: number[]) => Math.hypot(px[i * 4] - c[0], px[i * 4 + 1] - c[1], px[i * 4 + 2] - c[2]);
  const near = (i: number, j: number) => Math.hypot(px[i * 4] - px[j * 4], px[i * 4 + 1] - px[j * 4 + 1], px[i * 4 + 2] - px[j * 4 + 2]);
  // Spread in from the edges: close to the main colour, or a gentle step from a background neighbour (a shadow, a gradient).
  const gone = new Uint8Array(w * h);
  const queue = new Int32Array(w * h);
  let head = 0;
  let tail = 0;
  for (const i of border) {
    if (!gone[i] && dist(i, bg) <= tol) {
      gone[i] = 1;
      queue[tail++] = i;
    }
  }
  while (head < tail) {
    const i = queue[head++];
    const x = i % w;
    const y = (i - x) / w;
    const next = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1];
    for (const j of next) {
      if (j < 0 || gone[j]) continue;
      const d = dist(j, bg);
      if (d <= tol || (d <= tol * 1.8 && near(i, j) <= tol / 4)) {
        gone[j] = 1;
        queue[tail++] = j;
      }
    }
  }
  for (let i = 0; i < w * h; i++) {
    if (gone[i]) {
      out.data[i * 4 + 3] = 0;
      continue;
    }
    // Next to the background: partly see-through, the more so the closer its colour.
    const x = i % w;
    const edge = (x > 0 && gone[i - 1]) || (x < w - 1 && gone[i + 1]) || (i >= w && gone[i - w]) || (i < w * (h - 1) && gone[i + w]);
    if (edge) out.data[i * 4 + 3] = Math.round(px[i * 4 + 3] * Math.min(1, Math.max(0.35, (dist(i, bg) - tol) / tol)));
  }
  return out;
}

/** A preview (at most `max` pixels wide) of the picture with its background taken away. */
export function backgroundPreview(img: HTMLImageElement, tolerance: number, max = 360): HTMLCanvasElement {
  const c = draw(img, undefined, Math.min(1, max / img.naturalWidth));
  c.getContext('2d')!.putImageData(removeBackground(pixels(c), tolerance), 0, 0);
  return c;
}

/** The whole picture with its background taken away, as a PNG. */
export async function withoutBackground(img: HTMLImageElement, tolerance: number): Promise<Blob> {
  // Very big pictures are worked on at most 3000 pixels across.
  const c = draw(img, undefined, Math.min(1, 3000 / img.naturalWidth));
  c.getContext('2d')!.putImageData(removeBackground(pixels(c), tolerance), 0, 0);
  return toBlob(c, 'image/png');
}

function toBlob(c: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('That picture couldn’t be saved.'))), type, quality));
}

/**
 * The picture compressed: no more pixels than `ppi` for `widthIn` inches
 * (how wide it's shown), cropped parts thrown away when `crop` is given
 * (shares cut off top, right, bottom, left). JPEG, unless it has see-through
 * parts (PNG then). Never bigger than it was: null when it can't be made smaller.
 */
export async function compressPicture(img: HTMLImageElement, opts: { ppi: number; widthIn: number; crop?: [number, number, number, number]; size: number }): Promise<{ blob: Blob; width: number; height: number } | null> {
  const [t, r, b, l] = opts.crop ?? [0, 0, 0, 0];
  const area = { x: img.naturalWidth * l, y: img.naturalHeight * t, w: img.naturalWidth * (1 - l - r), h: img.naturalHeight * (1 - t - b) };
  const scale = Math.min(1, (opts.widthIn * opts.ppi) / area.w);
  const c = draw(img, area, scale);
  const data = pixels(c).data;
  let clear = false;
  for (let i = 3; i < data.length; i += 4 * 7) {
    if (data[i] < 250) {
      clear = true;
      break;
    }
  }
  const blob = await toBlob(c, clear ? 'image/png' : 'image/jpeg', 0.85);
  if (blob.size >= opts.size && !opts.crop) return null;
  return { blob, width: c.width, height: c.height };
}

/** A file size in words: 2.4 MB, 310 KB. */
export function fileSize(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
