import { selectionQuery, type Selection } from "./model";

/** Embedded previews can have opaque origins and disallow History API writes.
 * A share link is optional; it must never prevent the preview from starting. */
export function selectionUrl(
  selection: Selection,
  ...candidates: string[]
): string | null {
  for (const candidate of candidates) {
    try {
      const url = new URL(candidate);
      if (url.protocol !== "https:" && url.protocol !== "http:") continue;
      url.search = selectionQuery(selection);
      url.hash = "";
      return url.href;
    } catch {
      // about:srcdoc, blobs and local files do not provide a public share URL.
    }
  }
  return null;
}

export function updateLocation(url: string | null): void {
  if (!url) return;
  try {
    history.replaceState(null, "", url);
  } catch {
    // Sandboxed frames and browser rate limits can reject URL writes. The
    // selected location stays in application state and sharing reads that state.
  }
}
