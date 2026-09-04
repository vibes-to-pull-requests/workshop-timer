export async function dataUrlToFile(dataUrl: string, fileName: string): Promise<File> {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  return new File([blob], fileName, { type: blob.type || "image/jpeg" });
}

export function canShareImage(file: File): boolean {
  if (typeof navigator === "undefined" || typeof navigator.share !== "function") return false;
  return !navigator.canShare || navigator.canShare({ files: [file] });
}

export function downloadImage(dataUrl: string, fileName: string): void {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = fileName;
  link.rel = "noopener";
  link.click();
}

export async function shareImageForInstagram(
  dataUrl: string,
  options: { fileName: string; caption?: string },
): Promise<"shared" | "downloaded"> {
  const file = await dataUrlToFile(dataUrl, options.fileName);
  if (canShareImage(file)) {
    await navigator.share({
      files: [file],
      title: "Workshop moment",
      text: options.caption,
    });
    return "shared";
  }

  downloadImage(dataUrl, options.fileName);
  return "downloaded";
}
