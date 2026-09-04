import { useState } from "react";

import { formatMusicProviderLabel, getSegmentMusicEmbedUrl } from "../domain/music";
import type { SegmentMusic } from "../domain/types";

interface SegmentMusicPlayerProps {
  readonly music?: SegmentMusic;
  readonly workshopPaused: boolean;
}

export default function SegmentMusicPlayer({
  music,
  workshopPaused,
}: SegmentMusicPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const active = isPlaying && !workshopPaused;

  if (!music) return null;

  const providerLabel = formatMusicProviderLabel(music.provider);
  const embedUrl = getSegmentMusicEmbedUrl(music, active);

  return (
    <div className="segment-music" data-testid="segment-music-player" data-provider={music.provider}>
      <div className="segment-music-header">
        <span className="segment-music-label">{providerLabel} soundtrack</span>
        <button
          type="button"
          className="segment-music-toggle"
          aria-pressed={active}
          onClick={() => setIsPlaying((playing) => !playing)}
        >
          {active ? "Stop music" : "Play music"}
        </button>
      </div>
      {active ? (
        <iframe
          className="segment-music-embed"
          src={embedUrl}
          title={`${providerLabel} player for segment`}
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      ) : null}
    </div>
  );
}
