import type { SegmentMusic, MusicProvider } from "./types";

type ParseResult =
  | { readonly ok: true; readonly empty: true }
  | { readonly ok: true; readonly music: SegmentMusic }
  | { readonly ok: false; readonly message: string };

const YOUTUBE_ID_PATTERN = /^[a-zA-Z0-9_-]{11}$/;
const SPOTIFY_RESOURCE_TYPES = new Set(["track", "album", "playlist", "episode"]);

export function parseSegmentMusicUrl(input: string): ParseResult {
  const trimmed = input.trim();
  if (!trimmed) return { ok: true, empty: true };

  const youtube = parseYouTubeUrl(trimmed);
  if (youtube) {
    return {
      ok: true,
      music: { provider: "youtube", url: youtube.canonicalUrl },
    };
  }

  const spotify = parseSpotifyUrl(trimmed);
  if (spotify) {
    return {
      ok: true,
      music: { provider: "spotify", url: spotify.canonicalUrl },
    };
  }

  return {
    ok: false,
    message: "Enter a valid YouTube or Spotify link.",
  };
}

export function getSegmentMusicEmbedUrl(music: SegmentMusic, autoplay = false): string {
  if (music.provider === "youtube") {
    const parsed = parseYouTubeUrl(music.url);
    if (!parsed) throw new Error("Invalid YouTube URL");
    const params = new URLSearchParams({
      autoplay: autoplay ? "1" : "0",
      rel: "0",
    });
    return `https://www.youtube-nocookie.com/embed/${parsed.videoId}?${params}`;
  }

  const parsed = parseSpotifyUrl(music.url);
  if (!parsed) throw new Error("Invalid Spotify URL");
  const suffix = autoplay ? "?autoplay=1" : "";
  return `https://open.spotify.com/embed/${parsed.type}/${parsed.id}${suffix}`;
}

export function formatMusicProviderLabel(provider: MusicProvider): string {
  return provider === "youtube" ? "YouTube" : "Spotify";
}

function parseYouTubeUrl(
  input: string,
): { readonly videoId: string; readonly canonicalUrl: string } | null {
  try {
    const url = new URL(input);
    const host = url.hostname.replace(/^www\./, "");
    let videoId: string | null = null;

    if (host === "youtu.be") {
      videoId = url.pathname.split("/").filter(Boolean)[0] ?? null;
    } else if (host === "youtube.com" || host === "music.youtube.com" || host === "www.youtube-nocookie.com") {
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts[0] === "watch") {
        videoId = url.searchParams.get("v");
      } else if (parts[0] === "embed" || parts[0] === "shorts") {
        videoId = parts[1] ?? null;
      }
    }

    if (!videoId || !YOUTUBE_ID_PATTERN.test(videoId)) return null;
    return {
      videoId,
      canonicalUrl: `https://www.youtube.com/watch?v=${videoId}`,
    };
  } catch {
    return null;
  }
}

function parseSpotifyUrl(
  input: string,
): { readonly type: string; readonly id: string; readonly canonicalUrl: string } | null {
  const uriMatch = /^spotify:(track|album|playlist|episode):([a-zA-Z0-9]+)$/i.exec(input);
  if (uriMatch) {
    const [, type, id] = uriMatch;
    if (!type || !id) return null;
    return {
      type,
      id,
      canonicalUrl: `https://open.spotify.com/${type}/${id}`,
    };
  }

  try {
    const url = new URL(input);
    if (!url.hostname.endsWith("spotify.com")) return null;
    const parts = url.pathname.split("/").filter(Boolean);
    const typeIndex = parts.findIndex((part) => SPOTIFY_RESOURCE_TYPES.has(part));
    if (typeIndex === -1) return null;
    const type = parts[typeIndex]!;
    const id = parts[typeIndex + 1];
    if (!id || !/^[a-zA-Z0-9]+$/.test(id)) return null;
    return {
      type,
      id,
      canonicalUrl: `https://open.spotify.com/${type}/${id}`,
    };
  } catch {
    return null;
  }
}
