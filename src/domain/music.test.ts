import { describe, expect, it } from "vitest";

import {
  formatMusicProviderLabel,
  getSegmentMusicEmbedUrl,
  parseSegmentMusicUrl,
} from "./music";

describe("parseSegmentMusicUrl", () => {
  it("accepts an empty value", () => {
    expect(parseSegmentMusicUrl("   ")).toEqual({ ok: true, empty: true });
  });

  it.each([
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "youtube"],
    ["https://youtu.be/dQw4w9WgXcQ", "youtube"],
    ["https://www.youtube.com/embed/dQw4w9WgXcQ", "youtube"],
    ["https://open.spotify.com/track/11dFghVXANMlKmJXsNCbNl", "spotify"],
    ["https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M", "spotify"],
    ["spotify:track:11dFghVXANMlKmJXsNCbNl", "spotify"],
  ])("accepts %s as %s", (url, provider) => {
    const parsed = parseSegmentMusicUrl(url);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok || !("music" in parsed)) throw new Error("Expected music");
    expect(parsed.music.provider).toBe(provider);
  });

  it("rejects unsupported links", () => {
    expect(parseSegmentMusicUrl("https://example.com/song")).toEqual({
      ok: false,
      message: "Enter a valid YouTube or Spotify link.",
    });
  });
});

describe("getSegmentMusicEmbedUrl", () => {
  it("builds provider embed URLs", () => {
    expect(
      getSegmentMusicEmbedUrl({
        provider: "youtube",
        url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      }, true),
    ).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&rel=0");

    expect(
      getSegmentMusicEmbedUrl({
        provider: "spotify",
        url: "https://open.spotify.com/track/11dFghVXANMlKmJXsNCbNl",
      }, true),
    ).toBe("https://open.spotify.com/embed/track/11dFghVXANMlKmJXsNCbNl?autoplay=1");
  });
});

describe("formatMusicProviderLabel", () => {
  it("labels providers for display", () => {
    expect(formatMusicProviderLabel("youtube")).toBe("YouTube");
    expect(formatMusicProviderLabel("spotify")).toBe("Spotify");
  });
});
