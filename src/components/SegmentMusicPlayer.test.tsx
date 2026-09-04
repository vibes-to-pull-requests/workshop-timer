import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import SegmentMusicPlayer from "./SegmentMusicPlayer";

const music = {
  provider: "youtube" as const,
  url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
};

describe("SegmentMusicPlayer", () => {
  it("renders nothing when a segment has no music", () => {
    const { container } = render(
      <SegmentMusicPlayer workshopPaused={false} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("plays and stops the linked soundtrack for the current segment", async () => {
    const user = userEvent.setup();
    render(<SegmentMusicPlayer music={music} workshopPaused={false} />);

    expect(screen.getByText("YouTube soundtrack")).toBeInTheDocument();
    expect(screen.queryByTitle("YouTube player for segment")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Play music" }));
    const frame = screen.getByTitle("YouTube player for segment");
    expect(frame).toHaveAttribute(
      "src",
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&rel=0",
    );

    await user.click(screen.getByRole("button", { name: "Stop music" }));
    expect(screen.queryByTitle("YouTube player for segment")).not.toBeInTheDocument();
  });

  it("hides playback while the workshop is paused and resets when remounted", async () => {
    const user = userEvent.setup();
    const view = render(<SegmentMusicPlayer music={music} workshopPaused={false} />);

    await user.click(screen.getByRole("button", { name: "Play music" }));
    expect(screen.getByTitle("YouTube player for segment")).toBeInTheDocument();

    view.rerender(<SegmentMusicPlayer music={music} workshopPaused={true} />);
    expect(screen.queryByTitle("YouTube player for segment")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Play music" })).toBeInTheDocument();

    view.unmount();
    render(
      <SegmentMusicPlayer
        music={{ provider: "spotify", url: "https://open.spotify.com/track/11dFghVXANMlKmJXsNCbNl" }}
        workshopPaused={false}
      />,
    );
    expect(screen.getByText("Spotify soundtrack")).toBeInTheDocument();
    expect(screen.queryByTitle("YouTube player for segment")).not.toBeInTheDocument();
  });
});
