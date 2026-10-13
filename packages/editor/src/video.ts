// Online video (Word's Insert Online Video): a YouTube or Vimeo link kept as
// a block of its own, played in the text through the site's own player.

/** The player's address for a YouTube or Vimeo link (null for other links). YouTube's privacy-enhanced player. */
export function videoEmbed(src: string): string | null {
  let url: URL;
  try {
    url = new URL(src);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www|m)\./, '');
  const id = (s: string | null | undefined) => (s && /^[\w-]{6,20}$/.test(s) ? s : null);
  if (host === 'youtu.be') {
    const v = id(url.pathname.slice(1));
    return v ? `https://www.youtube-nocookie.com/embed/${v}${startOf(url)}` : null;
  }
  if (host === 'youtube.com' || host === 'youtube-nocookie.com' || host === 'music.youtube.com') {
    const v = id(url.searchParams.get('v')) ?? id(/^\/(?:embed|shorts|live)\/([\w-]+)/.exec(url.pathname)?.[1]);
    return v ? `https://www.youtube-nocookie.com/embed/${v}${startOf(url)}` : null;
  }
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const v = /^\/(?:video\/)?(\d{5,12})/.exec(url.pathname)?.[1];
    return v ? `https://player.vimeo.com/video/${v}` : null;
  }
  return null;
}

/** Where a YouTube link starts playing (?t=90 or ?t=1m30s). */
function startOf(url: URL): string {
  const t = url.searchParams.get('t') ?? url.searchParams.get('start');
  if (!t) return '';
  const m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/.exec(t);
  const secs = m ? Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0) : 0;
  return secs ? `?start=${secs}` : '';
}

/** Whether an attached file plays as video or sound in the text. */
export function playable(src: string): 'video' | 'audio' | null {
  const ext = /\.([a-z0-9]{2,5})(?:[?#].*)?$/i.exec(src)?.[1]?.toLowerCase();
  if (ext && ['mp4', 'webm', 'mov', 'm4v', 'ogv'].includes(ext)) return 'video';
  if (ext && ['mp3', 'wav', 'm4a', 'ogg', 'oga', 'aac', 'flac'].includes(ext)) return 'audio';
  return null;
}
