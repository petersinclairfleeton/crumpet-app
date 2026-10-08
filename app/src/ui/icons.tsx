import markUrl from './assets/mark.png';
// Line icons, drawn at 24×24 and coloured by currentColor.

import type { ReactElement } from 'react';

type Props = { size?: number; className?: string };

function icon(paths: ReactElement, fill = false) {
  return function Icon({ size = 16, className }: Props) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill={fill ? 'currentColor' : 'none'}
        stroke={fill ? 'none' : 'currentColor'}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className={className}
      >
        {paths}
      </svg>
    );
  };
}

export const IconPlus = icon(<path d="M12 5v14M5 12h14" />);
export const IconNote = icon(<path d="M6 3h9l4 4v14H6zM9 11h7M9 15h7" />);
export const IconNotebook = icon(<path d="M6 3h11a2 2 0 0 1 2 2v16H8a2 2 0 0 1-2-2zM10 3v18" />);
export const IconStack = icon(<path d="M4 7h13v13H4zM7 4h13v13" />);
export const IconStar = icon(<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" />);
export const IconStarFilled = icon(<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" />, true);
export const IconTag = icon(
  <>
    <path d="M3 12V4h8l10 10-8 8z" />
    <circle cx="7.5" cy="8.5" r="1.5" />
  </>,
);
export const IconBook = icon(<path d="M3 5.5C5.5 4 9 4 12 6c3-2 6.5-2 9-.5V19c-2.5-1.5-6-1.5-9 .5-3-2-6.5-2-9-.5zM12 6v13.5" />);
export const IconPen = icon(<path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" />);
export const IconTrash = icon(<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />);
export const IconSearch = icon(
  <>
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-3.5-3.5" />
  </>,
);
export const IconChevron = icon(<path d="M9 6l6 6-6 6" />);
export const IconChevronDown = icon(<path d="M6 9l6 6 6-6" />);
export const IconBack = icon(<path d="M15 5l-7 7 7 7" />);
export const IconMore = icon(
  <>
    <circle cx="5" cy="12" r="1.6" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
    <circle cx="19" cy="12" r="1.6" fill="currentColor" stroke="none" />
  </>,
);
export const IconMenu = icon(<path d="M4 6h16M4 12h16M4 18h16" />);
export const IconClose = icon(<path d="M6 6l12 12M18 6L6 18" />);
export const IconLink = icon(
  <>
    <path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1" />
    <path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" />
  </>,
);
export const IconUndo = icon(<path d="M9 14L4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3" />);
export const IconRedo = icon(<path d="M15 14l5-5-5-5M20 9H9a5 5 0 0 0 0 10h3" />);
export const IconRestore = icon(<path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5" />);
export const IconSettings = icon(
  <>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2" />
  </>,
);
export const IconSun = icon(<path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />);
export const IconChart = icon(<path d="M4 20V10M10 20V4M16 20v-7M21 20H3" />);
export const IconSidebar = icon(<path d="M4 4h16v16H4zM9 4v16" />);
export const IconLayout = icon(<path d="M4 4h16v16H4zM12 4v16" />);
export const IconFocus = icon(<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />);
export const IconList = icon(<path d="M4 6h16M4 12h16M4 18h16" />);
export const IconPage = icon(<path d="M6 3h9l4 4v14H6zM9 9h6M9 13h6M9 17h4" />);
export const IconPicture = icon(<path d="M4 5h16v14H4zM4 16l5-5 4 4 2-2 5 5M15.5 9.5h.01" />);
export const IconCopy = icon(<path d="M8 8h12v12H8zM4 16V4h12" />);
export const IconDownload = icon(<path d="M12 4v11M7 10l5 5 5-5M5 20h14" />);
export const IconPrint = icon(<path d="M7 9V3h10v6M7 17H4v-7h16v7h-3M7 14h10v7H7z" />);
export const IconCards = icon(<path d="M4 4h16v7H4zM4 15h16v5H4z" />);

/** The crumpet logo: a crumpet with a page curling off it. */
export function Logo({ size = 20 }: { size?: number }) {
  return <img className="logo" src={markUrl} width={size} height={size} alt="" aria-hidden="true" draggable={false} />;
}

/** A notebook icon filled with the notebook's colour. */
export function NotebookIcon({ color, size = 13, cut = 'var(--side-bg)' }: { color: string; size?: number; cut?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 3h11a2 2 0 0 1 2 2v16H8a2 2 0 0 1-2-2z" fill={color} />
      <path d="M10 3v18" stroke={cut} strokeWidth={1.6} />
    </svg>
  );
}
