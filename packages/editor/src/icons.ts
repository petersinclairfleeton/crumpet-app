// Icons (Word's Insert > Icons): simple filled drawings on a 24 × 24 grid,
// put in as drawing shapes (`path`), so their colour, size and effects can be
// changed like any shape's. Holes (in rings, the gear, the pin) come from the
// even-odd fill.

export interface Icon {
  id: string;
  name: string;
  group: string;
  /** SVG path data on a 24 × 24 grid (filled, even-odd). */
  d: string;
}

const ring = (cx: number, cy: number, r: number, inner: number) =>
  `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0Z` + (inner ? `M${cx - inner} ${cy}a${inner} ${inner} 0 1 1 ${inner * 2} 0a${inner} ${inner} 0 1 1 ${-inner * 2} 0Z` : '');

export const ICONS: Icon[] = [
  // Signs.
  { id: 'check', name: 'Tick', group: 'Signs', d: 'M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z' },
  { id: 'cross', name: 'Cross', group: 'Signs', d: 'M6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12 19 6.4 17.6 5 12 10.6z' },
  { id: 'plus', name: 'Plus', group: 'Signs', d: 'M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z' },
  { id: 'info', name: 'Information', group: 'Signs', d: `${ring(12, 12, 10, 8)}M11 10h2v7h-2zM11 6.5h2v2h-2z` },
  { id: 'warning', name: 'Warning', group: 'Signs', d: 'M12 2 1 21h22zM11 9h2v6h-2zM11 16.5h2v2h-2z' },
  { id: 'question', name: 'Question', group: 'Signs', d: `${ring(12, 12, 10, 8)}M9 9.5a3 3 0 1 1 4.2 2.8c-.8.4-1.2.9-1.2 1.7v.5h-2v-.6c0-1.6.9-2.6 2-3.1a1 1 0 1 0-1-1.3zM11 16h2v2h-2z` },
  // People and talk.
  { id: 'person', name: 'Person', group: 'People', d: `${ring(12, 7.5, 4, 0)}M4 21c0-4.4 3.6-7.5 8-7.5s8 3.1 8 7.5z` },
  { id: 'people', name: 'People', group: 'People', d: `${ring(8.5, 8, 3.2, 0)}${ring(16, 8.5, 2.8, 0)}M2 20c0-3.6 2.9-6.3 6.5-6.3S15 16.4 15 20zM15.5 13.8c3.2-.2 6.5 1.8 6.5 6.2h-5.3c0-2.5-.4-4.4-1.2-6.2z` },
  { id: 'speech', name: 'Speech bubble', group: 'People', d: 'M4 3h16a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H9l-5 4v-4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z' },
  { id: 'heart', name: 'Heart', group: 'People', d: 'M12 21.3 10.6 20C5.4 15.4 2 12.3 2 8.5 2 5.4 4.4 3 7.5 3c1.7 0 3.4.8 4.5 2.1C13.1 3.8 14.8 3 16.5 3 19.6 3 22 5.4 22 8.5c0 3.8-3.4 6.9-8.6 11.5z' },
  { id: 'star', name: 'Star', group: 'People', d: 'M12 2.5 14.9 9l7.1.6-5.4 4.7 1.6 6.9L12 17.6l-6.2 3.6 1.6-6.9L2 9.6 9.1 9z' },
  // Things.
  { id: 'home', name: 'House', group: 'Things', d: 'M12 3 2 11.5h3V21h5.5v-6h3v6H19v-9.5h3z' },
  { id: 'book', name: 'Book', group: 'Things', d: 'M4 3.5C6.5 3 9.5 3.4 11.2 5v15.4C9.5 19 6.6 18.5 4 19zM12.8 5c1.7-1.6 4.7-2 7.2-1.5V19c-2.6-.5-5.5 0-7.2 1.4z' },
  { id: 'pen', name: 'Pen', group: 'Things', d: 'M3 17.3V21h3.7L17.8 9.9l-3.7-3.7zM20.7 7c.4-.4.4-1 0-1.4l-2.3-2.3c-.4-.4-1-.4-1.4 0l-1.8 1.8 3.7 3.7z' },
  { id: 'mail', name: 'Letter', group: 'Things', d: 'M2 5h20v14H2zM4 7.2v.3l8 5.3 8-5.3v-.3zM4 9.9V17h16V9.9l-8 5.3z' },
  { id: 'phone', name: 'Telephone', group: 'Things', d: 'M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1A17 17 0 0 1 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1z' },
  { id: 'clock', name: 'Clock', group: 'Things', d: `${ring(12, 12, 10, 8)}M11 6.5h2v5l4 2.4-1 1.7-5-3z` },
  { id: 'calendar', name: 'Calendar', group: 'Things', d: 'M7 2h2v2h6V2h2v2h3a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h3zM5 9v10h14V9zM7 11h3v3H7z' },
  { id: 'bulb', name: 'Light bulb', group: 'Things', d: 'M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2zM9 18h6v2H9zM10 21h4v1h-4z' },
  { id: 'camera', name: 'Camera', group: 'Things', d: `M9 4h6l1.5 2H21a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h4.5z${ring(12, 13, 4.5, 2.8)}` },
  { id: 'music', name: 'Music', group: 'Things', d: `M9 4l11-2v13.5a3 3 0 1 1-2-2.8V6.3l-7 1.3v9.9A3 3 0 1 1 9 14.7z` },
  { id: 'lock', name: 'Lock', group: 'Things', d: 'M12 2a5 5 0 0 0-5 5v3H5v12h14V10h-2V7a5 5 0 0 0-5-5zm-3 8V7a3 3 0 0 1 6 0v3zM11 14h2v4h-2z' },
  { id: 'gear', name: 'Gear', group: 'Things', d: `M10.3 2h3.4l.5 2.6 1.9.8 2.2-1.5 2.4 2.4-1.5 2.2.8 1.9 2.6.5v3.4l-2.6.5-.8 1.9 1.5 2.2-2.4 2.4-2.2-1.5-1.9.8-.5 2.6h-3.4l-.5-2.6-1.9-.8-2.2 1.5-2.4-2.4 1.5-2.2-.8-1.9L2 13.7v-3.4l2.6-.5.8-1.9-1.5-2.2 2.4-2.4 2.2 1.5 1.9-.8z${ring(12, 12, 3.5, 0)}` },
  { id: 'flag', name: 'Flag', group: 'Things', d: 'M5 2h2v20H5zM8 3h12l-3 4.5 3 4.5H8z' },
  // Nature and places.
  { id: 'sun', name: 'Sun', group: 'Nature', d: `${ring(12, 12, 4.5, 0)}M11 1h2v3h-2zM11 20h2v3h-2zM1 11h3v2H1zM20 11h3v2h-3zM4.2 5.6l1.4-1.4 2.1 2.1-1.4 1.4zM16.3 17.7l1.4-1.4 2.1 2.1-1.4 1.4zM4.2 18.4l2.1-2.1 1.4 1.4-2.1 2.1zM16.3 6.3l2.1-2.1 1.4 1.4-2.1 2.1z` },
  { id: 'moon', name: 'Moon', group: 'Nature', d: 'M14.5 2A9 9 0 1 0 22 14.6 7.5 7.5 0 0 1 14.5 2z' },
  { id: 'cloud', name: 'Cloud', group: 'Nature', d: 'M6.5 19A4.5 4.5 0 0 1 6 10a6 6 0 0 1 11.6-1.6A5.3 5.3 0 0 1 18 19z' },
  { id: 'leaf', name: 'Leaf', group: 'Nature', d: 'M20 3C9 3 4 8.5 4 15c0 1.5.3 2.9.8 4.1L3 21l1.4 1.4 1.8-1.8c1.3.6 2.8.9 4.3.9C17 21.5 21 15 20 3zM7.6 18.8C9.2 13.6 12.5 10 17 7.5c-3.6 3-6.2 6.6-7.6 11.3z' },
  { id: 'tree', name: 'Tree', group: 'Nature', d: 'M12 2 5 11h3l-4 6h7v5h2v-5h7l-4-6h3z' },
  { id: 'pin', name: 'Map pin', group: 'Nature', d: `M12 2a7 7 0 0 0-7 7c0 5.3 7 13 7 13s7-7.7 7-13a7 7 0 0 0-7-7z${ring(12, 9, 2.5, 0)}` },
];

export const ICON_GROUPS = [...new Set(ICONS.map((i) => i.group))];
