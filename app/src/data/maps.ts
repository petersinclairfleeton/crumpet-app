// A book's maps (like Campfire's): a picture of the world, with pins on it
// for its places (each can open the place's card), and a scale, so a line
// across the map says how far that is and how long it takes on foot, on
// horseback or by car, to keep journeys in the story believable. Kept in
// the book's plan (`plan.maps`).

/** A pin: where on the map (as a share of its width and height, 0 to 1), and the place it marks or its own label. */
export interface MapPin {
  id: string;
  x: number;
  y: number;
  /** The place (or other card) it marks. */
  castId?: string;
  label?: string;
}

export interface BookMap {
  id: string;
  name: string;
  /** The picture (an attachment's path). */
  src: string;
  /** Its height over its width, for measuring. */
  aspect?: number;
  pins: MapPin[];
  /** How far the map's width is, and in what. */
  scale?: { perWidth: number; unit: Unit };
}

export type Unit = 'miles' | 'km' | 'leagues' | 'days';
export const UNITS: { id: Unit; name: string; km: number | null }[] = [
  { id: 'miles', name: 'miles', km: 1.609344 },
  { id: 'km', name: 'kilometres', km: 1 },
  { id: 'leagues', name: 'leagues', km: 4.828 },
  { id: 'days', name: 'days’ travel', km: null },
];

/** How fast people get about, in km an hour (walking, a horse at a steady pace, a car on old roads). */
export const PACES: { name: string; kmh: number }[] = [
  { name: 'on foot', kmh: 5 },
  { name: 'on horseback', kmh: 10 },
  { name: 'by car', kmh: 60 },
];

/** The distance between two points, in map widths (the height counted by the map's shape). */
export function mapDistance(a: { x: number; y: number }, b: { x: number; y: number }, aspect = 1): number {
  return Math.hypot(b.x - a.x, (b.y - a.y) * aspect);
}

/** The scale from a line across the map and how far it really is. */
export function scaleFrom(a: { x: number; y: number }, b: { x: number; y: number }, aspect: number, length: number, unit: Unit): BookMap['scale'] | undefined {
  const d = mapDistance(a, b, aspect);
  return d > 0 && length > 0 ? { perWidth: Math.round((length / d) * 1000) / 1000, unit } : undefined;
}

/** "about 3 hours", "about 2 days" (travelling up to 8 hours a day). */
export function travelTime(hours: number): string {
  if (hours < 1) return `about ${Math.max(5, Math.round((hours * 60) / 5) * 5)} minutes`;
  if (hours <= 10) {
    const h = Math.round(hours * 2) / 2;
    return `about ${h} hour${h === 1 ? '' : 's'}`;
  }
  const days = Math.round((hours / 8) * 2) / 2;
  return `about ${days} day${days === 1 ? '' : 's'}`;
}

/** What a line across the map measures: its length in the map's units, and how long it takes to travel. */
export function measure(map: Pick<BookMap, 'aspect' | 'scale'>, a: { x: number; y: number }, b: { x: number; y: number }): { length: string; travel: string[] } | null {
  if (!map.scale) return null;
  const n = mapDistance(a, b, map.aspect ?? 1) * map.scale.perWidth;
  const unit = UNITS.find((u) => u.id === map.scale!.unit) ?? UNITS[0];
  const shown = n >= 100 ? Math.round(n).toLocaleString() : n >= 10 ? n.toFixed(0) : n.toFixed(1);
  if (unit.km === null) return { length: `${shown} ${unit.name}`, travel: [] };
  const km = n * unit.km;
  return { length: `${shown} ${unit.name}`, travel: PACES.map((p) => `${travelTime(km / p.kmh)} ${p.name}`) };
}

const num = (x: unknown, lo: number, hi: number) => (typeof x === 'number' && Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : null);

/** Maps from a project.json, only what's well formed. */
export function cleanMaps(raw: unknown): BookMap[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((m) => {
    const x = m as Partial<BookMap>;
    if (!x || typeof x.id !== 'string' || typeof x.src !== 'string' || !x.src) return [];
    const pins = (Array.isArray(x.pins) ? x.pins : []).flatMap((p) => {
      const px = num(p?.x, 0, 1);
      const py = num(p?.y, 0, 1);
      if (!p || typeof p.id !== 'string' || px === null || py === null) return [];
      return [{ id: p.id, x: px, y: py, ...(typeof p.castId === 'string' && p.castId ? { castId: p.castId } : {}), ...(typeof p.label === 'string' && p.label ? { label: p.label } : {}) }];
    });
    const out: BookMap = { id: x.id, name: typeof x.name === 'string' ? x.name : '', src: x.src, pins };
    const aspect = num(x.aspect, 0.05, 20);
    if (aspect !== null) out.aspect = aspect;
    const per = num(x.scale?.perWidth, 0, 1e9);
    if (per && UNITS.some((u) => u.id === x.scale?.unit)) out.scale = { perWidth: per, unit: x.scale!.unit };
    return [out];
  });
}
