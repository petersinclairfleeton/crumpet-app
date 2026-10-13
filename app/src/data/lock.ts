// A note protected with a password (Word's Encrypt with Password): its text
// scrambled with AES-GCM under a key made from the password (PBKDF2, 210,000
// rounds of SHA-256), so the file in the folder or Drive is unreadable
// without it. The note keeps its title; its text is one ```locked block
// holding the scrambled text. Forget the password and the text is gone: no
// one can open it, Crumpet included.

import type { Doc } from '@crumpet/editor/model';
import { makeBlock } from '@crumpet/editor/model';
import { fromMarkdown, toMarkdown } from '@crumpet/editor/markdown';

const ROUNDS = 210_000;

interface Sealed {
  v: 1;
  salt: string;
  iv: string;
  data: string;
}

const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function keyFor(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: salt as BufferSource, iterations: ROUNDS, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

/** Whether a note's text is locked with a password. */
export function isLocked(doc: Doc): boolean {
  return doc.blocks.length === 1 && doc.blocks[0].type === 'code' && doc.blocks[0].code?.lang === 'locked';
}

/** A note opened with its password: the text, and the key to lock it again as it changes (made once: it's slow on purpose). */
export interface Opened {
  doc: Doc;
  key: CryptoKey;
  salt: Uint8Array;
}

/** The text scrambled with the password, as a locked note's text (and the key, to save changes). */
export async function lockDoc(doc: Doc, password: string): Promise<{ doc: Doc; opened: Opened }> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await keyFor(password, salt);
  return { doc: await sealWith(doc, key, salt), opened: { doc, key, salt } };
}

/** The text locked again with a key already made (a new random start each time). */
export async function sealWith(doc: Doc, key: CryptoKey, salt: Uint8Array): Promise<Doc> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(toMarkdown(doc))));
  // (In chunks: a long note is too many bytes for one call.)
  let raw = '';
  for (let i = 0; i < data.length; i += 0x8000) raw += String.fromCharCode(...data.subarray(i, i + 0x8000));
  const sealed: Sealed = { v: 1, salt: b64(salt), iv: b64(iv), data: btoa(raw) };
  return { blocks: [makeBlock('code', '', [], { code: { lang: 'locked', text: JSON.stringify(sealed) } })] };
}

/** The text back from a locked note (and the key, to save changes); throws when the password is wrong. */
export async function unlockDoc(doc: Doc, password: string): Promise<Opened> {
  const sealed = JSON.parse(doc.blocks[0]?.code?.text ?? '{}') as Sealed;
  if (sealed.v !== 1) throw new Error('This note was locked by a newer Crumpet.');
  const salt = unb64(sealed.salt);
  const key = await keyFor(password, salt);
  let plain: ArrayBuffer;
  try {
    plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(sealed.iv) as BufferSource }, key, unb64(sealed.data) as BufferSource);
  } catch {
    throw new Error('That isn’t the password.');
  }
  return { doc: fromMarkdown(new TextDecoder().decode(plain)), key, salt };
}
