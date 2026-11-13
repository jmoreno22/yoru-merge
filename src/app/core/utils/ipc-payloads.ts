import type { BlameLine, BlameResult } from '../models';

/**
 * What `invoke` resolves with for a command returning a raw
 * `tauri::ipc::Response`: an `ArrayBuffer`, or a plain number array when the
 * custom IPC protocol is blocked and Tauri falls back to `postMessage`.
 */
export type RawResponse = ArrayBuffer | number[];

// `ignoreBOM` keeps a leading byte-order mark in a file's text, as the JSON
// string this replaced did.
const utf8 = new TextDecoder('utf-8', { ignoreBOM: true });

export function decodeText(raw: RawResponse): string {
  return utf8.decode(new Uint8Array(raw));
}

/** Base64 of the bytes, encoded by the browser rather than in a script loop. */
export function encodeBase64(raw: RawResponse): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result as string;
      resolve(url.slice(url.indexOf(',') + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(new Blob([new Uint8Array(raw)]));
  });
}

/** One {@link BlameLine} per line; lines of one commit share its strings. */
export function expandBlame(blame: BlameResult): BlameLine[] {
  return blame.lines.map(({ commit, line_no, content }) => ({
    ...blame.commits[commit],
    line_no,
    content,
  }));
}
