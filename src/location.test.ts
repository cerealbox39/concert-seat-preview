import { describe, expect, it, vi } from "vitest";
import { DEFAULT_SELECTION } from "./model";
import { selectionUrl, updateLocation } from "./location";

describe("preview-safe location handling", () => {
  it("builds the current selection link under the site's existing subpath", () => {
    expect(
      selectionUrl(
        DEFAULT_SELECTION,
        "https://example.com/concert-seat-preview/?block=999#old",
      ),
    ).toBe("https://example.com/concert-seat-preview/?block=211&row=6&seat=12");
  });
  it("uses a hosted base URL in an embedded document when one is provided", () => {
    expect(
      selectionUrl(
        DEFAULT_SELECTION,
        "about:srcdoc",
        "https://example.com/concert-seat-preview/",
      ),
    ).toBe("https://example.com/concert-seat-preview/?block=211&row=6&seat=12");
  });
  it("does not manufacture a shareable URL for a local or opaque preview", () => {
    for (const url of [
      "about:srcdoc",
      "about:blank",
      "blob:https://example.com/id",
      "file:///preview.html",
      "invalid",
    ])
      expect(selectionUrl(DEFAULT_SELECTION, url)).toBeNull();
  });
  it("does not throw when the embedded browser rejects a History API write", () => {
    vi.stubGlobal("history", {
      replaceState: () => {
        throw new DOMException("Blocked by sandbox", "SecurityError");
      },
    });
    try {
      expect(() =>
        updateLocation("https://example.com/?block=211"),
      ).not.toThrow();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
