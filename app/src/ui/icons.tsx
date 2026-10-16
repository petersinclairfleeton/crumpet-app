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
        className={className ? `ic ${className}` : 'ic'}
      >
        {paths}
      </svg>
    );
  };
}

export const IconPlus = icon(<path d="M12 5v14M5 12h14" />);
export const IconNote = icon(<path d="M7 3h7l5 5v13H7zM14 3v5h5" />);
export const IconNotebook = icon(<path d="M6 3h11a2 2 0 0 1 2 2v16H8a2 2 0 0 1-2-2zM10 3v18" />);
export const IconStack = icon(<path d="M4 7h13v13H4zM7 4h13v13" />);
export const IconStar = icon(<path d="m12 4 2.4 5 5.4.6-4 3.7 1.1 5.4L12 16l-4.9 2.7 1.1-5.4-4-3.7 5.4-.6z" />);
export const IconBell = icon(<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20.5a2.2 2.2 0 0 0 4 0" />);
export const IconStarFilled = icon(<path d="m12 4 2.4 5 5.4.6-4 3.7 1.1 5.4L12 16l-4.9 2.7 1.1-5.4-4-3.7 5.4-.6z" />, true);
export const IconTag = icon(
  <>
    <path d="M3 12V4h8l10 10-8 8z" />
    <circle cx="7.5" cy="8.5" r="1.5" />
  </>,
);
export const IconBook = icon(<path d="M4 5.5C6.5 4 9.5 4 12 6c2.5-2 5.5-2 8-.5V19c-2.5-1.5-5.5-1.5-8 .5-2.5-2-5.5-2-8-.5zM12 6v13.5" />);
export const IconPen = icon(<path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" />);
export const IconTrash = icon(<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />);
export const IconSearch = icon(
  <>
    <circle cx="11" cy="11" r="6" />
    <path d="m20 20-4.5-4.5" />
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
    <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
  </>,
);
export const IconSun = icon(
  <>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" />
  </>,
);
export const IconPeople = icon(
  <>
    <circle cx="9" cy="8" r="3" />
    <path d="M3 19c.5-3 3-5 6-5s5.5 2 6 5M16 5a3 3 0 0 1 0 6M18 14c1.6.6 2.7 2.4 3 5" />
  </>,
);
export const IconBox = icon(<path d="M4 6h16v13H4zM9 6V4h6v2" />);
export const IconInbox = icon(<path d="M4 13h4l2 3h4l2-3h4M5 5h14l1 8v5H4v-5z" />);
export const IconCheck = icon(<path d="m5 12 4 4 10-10" />);
/** The crumpet itself: a round with its holes. */
export const IconCrumpet = icon(
  <>
    <ellipse cx="12" cy="13" rx="8" ry="5" />
    <path d="M7 11.5h.01M11 10.5h.01M15 11h.01M10 14h.01M14 14.5h.01" />
  </>,
);
export const IconChart = icon(<path d="M4 20V10M10 20V4M16 20v-7M21 20H3" />);
export const IconSidebar = icon(
  <>
    <rect x="3" y="4" width="18" height="16" rx="3" />
    <path d="M9 4v16" />
  </>,
);
export const IconFoldLeft = icon(<path d="M11 17l-5-5 5-5M18 17l-5-5 5-5" />);
export const IconFoldRight = icon(<path d="M13 17l5-5-5-5M6 17l5-5-5-5" />);
export const IconListPanel = icon(<path d="M4 4h16v16H4zM9 4v16M12 9h5M12 13h5" />);
export const IconRightPanel = icon(
  <>
    <rect x="3" y="4" width="18" height="16" rx="3" />
    <path d="M15 4v16" />
  </>,
);
export const IconGraph = icon(
  <>
    <circle cx="6" cy="6.5" r="2.5" />
    <circle cx="18" cy="7" r="2.5" />
    <circle cx="12" cy="18" r="2.5" />
    <path d="M8.5 6.6h7M7.2 8.7l3.6 7M16.8 9.2l-3.6 6.6" />
  </>,
);
export const IconLayout = icon(<path d="M4 4h16v16H4zM12 4v16" />);
export const IconFocus = icon(<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />);
export const IconBullets = icon(<path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" />);
export const IconList = icon(<path d="M4 6h16M4 12h16M4 18h16" />);
export const IconPage = icon(<path d="M6 3h9l4 4v14H6zM9 9h6M9 13h6M9 17h4" />);
export const IconPicture = icon(<path d="M4 5h16v14H4zM4 16l5-5 4 4 2-2 5 5M15.5 9.5h.01" />);
export const IconUpload = icon(<path d="M12 20V9M7 14l5-5 5 5M5 4h14" />);
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
export const IconHelp = icon(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 9.5a2.5 2.5 0 0 1 4.9.7c0 1.7-2.4 2.2-2.4 3.8M12 17h.01" />
  </>,
);
