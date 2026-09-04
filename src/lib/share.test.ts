import { afterEach, describe, expect, it, vi } from "vitest";

import { canShareImage, downloadImage, shareImageForInstagram } from "./share";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("share", () => {
  it("downloads when native sharing is unavailable", async () => {
    const click = vi.fn();
    const link = { click } as HTMLAnchorElement;
    vi.spyOn(document, "createElement").mockReturnValue(link);

    const result = await shareImageForInstagram("data:image/jpeg;base64,abc", {
      fileName: "workshop-moment.jpg",
      caption: "Team huddle",
    });

    expect(result).toBe("downloaded");
    expect(link.download).toBe("workshop-moment.jpg");
    expect(click).toHaveBeenCalledOnce();
  });

  it("uses the native share sheet when image sharing is supported", async () => {
    const share = vi.fn(async () => undefined);
    const canShare = vi.fn(() => true);
    vi.stubGlobal("navigator", { share, canShare });

    const result = await shareImageForInstagram("data:image/jpeg;base64,abc", {
      fileName: "workshop-moment.jpg",
      caption: "Team huddle",
    });

    expect(result).toBe("shared");
    expect(share).toHaveBeenCalledOnce();
  });

  it("detects when image sharing is supported", () => {
    const file = new File(["photo"], "workshop.jpg", { type: "image/jpeg" });
    vi.stubGlobal("navigator", {
      share: vi.fn(),
      canShare: vi.fn(() => true),
    });

    expect(canShareImage(file)).toBe(true);
  });

  it("downloads an image directly", () => {
    const click = vi.fn();
    const link = { click, href: "", download: "" } as HTMLAnchorElement;
    vi.spyOn(document, "createElement").mockReturnValue(link);

    downloadImage("data:image/jpeg;base64,abc", "workshop.jpg");

    expect(link.download).toBe("workshop.jpg");
    expect(click).toHaveBeenCalledOnce();
  });
});
