import { useRef, useState } from "react";

import { prepareImageDataUrl } from "../lib/media";
import { shareImageForInstagram } from "../lib/share";
import {
  loadMoments,
  saveMoments,
  type WorkshopMoment,
} from "../infrastructure/momentsStorage";
import type { StorageLike } from "../infrastructure/storage";

interface WorkshopMomentsProps {
  readonly storage: StorageLike;
  readonly createId: () => string;
  readonly now: () => number;
}

type PendingMedia = {
  readonly dataUrl: string;
  readonly mimeType: string;
  readonly fileName: string;
};

export default function WorkshopMoments({ storage, createId, now }: WorkshopMomentsProps) {
  const [moments, setMoments] = useState(() => loadMoments(storage));
  const [caption, setCaption] = useState("");
  const [note, setNote] = useState("");
  const [pendingImage, setPendingImage] = useState<PendingMedia | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [statusMessage, setStatusMessage] = useState<string | undefined>();
  const imageInputRef = useRef<HTMLInputElement>(null);

  function persist(nextMoments: readonly WorkshopMoment[]) {
    if (!saveMoments(storage, nextMoments)) {
      setErrorMessage("Could not save this moment. Try removing older entries or using a smaller file.");
      return false;
    }
    setMoments([...nextMoments]);
    setErrorMessage(undefined);
    return true;
  }

  function resetDraft() {
    setCaption("");
    setNote("");
    setPendingImage(null);
  }

  async function handleImageChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setErrorMessage("Choose an image file for a photo moment.");
      return;
    }

    setIsProcessing(true);
    setErrorMessage(undefined);
    try {
      const dataUrl = await prepareImageDataUrl(file);
      setPendingImage({
        dataUrl,
        mimeType: "image/jpeg",
        fileName: file.name,
      });
    } catch {
      setErrorMessage("Could not read that image. Try another photo.");
      setPendingImage(null);
    } finally {
      setIsProcessing(false);
    }
  }

  function addMoment() {
    let nextMoment: WorkshopMoment | undefined;

    if (pendingImage) {
      nextMoment = {
        id: createId(),
        kind: "image",
        caption: caption.trim(),
        dataUrl: pendingImage.dataUrl,
        mimeType: pendingImage.mimeType,
        createdAtMs: now(),
      };
    } else if (note.trim()) {
      nextMoment = {
        id: createId(),
        kind: "note",
        caption: caption.trim(),
        note: note.trim(),
        createdAtMs: now(),
      };
    } else {
      setErrorMessage("Add a photo or note before saving this moment.");
      return;
    }

    if (!persist([nextMoment, ...moments])) return;
    resetDraft();
  }

  function removeMoment(id: string) {
    persist(moments.filter((moment) => moment.id !== id));
  }

  async function shareMomentToInstagram(dataUrl: string, caption: string) {
    try {
      const result = await shareImageForInstagram(dataUrl, {
        fileName: `workshop-moment-${Date.now()}.jpg`,
        caption: caption || undefined,
      });
      setStatusMessage(
        result === "shared"
          ? "Choose Instagram in the share menu to post this moment."
          : "Photo downloaded. Open Instagram and upload it from your photos.",
      );
      setErrorMessage(undefined);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setErrorMessage("Could not share this moment. Try again or save the photo first.");
    }
  }

  return (
    <section className="moments-view" aria-labelledby="moments-title">
      <div className="moments-intro">
        <p className="eyebrow">Document</p>
        <h2 id="moments-title">Workshop moments</h2>
        <p>Capture photos and quick notes from the room. Share photo moments to Instagram when you are ready.</p>
      </div>

      <div className="moments-form">
        <div className="moments-upload">
          <input
            ref={imageInputRef}
            className="moments-file-input"
            type="file"
            accept="image/*"
            capture="environment"
            aria-label="Add workshop photo"
            onChange={(event) => void handleImageChange(event)}
            disabled={isProcessing}
          />
          <button
            type="button"
            className="moments-action-button"
            onClick={() => imageInputRef.current?.click()}
            disabled={isProcessing}
          >
            {isProcessing ? "Preparing photo..." : pendingImage ? "Replace photo" : "Add photo"}
          </button>
          {pendingImage ? <span className="moments-file-name">{pendingImage.fileName}</span> : null}
        </div>

        <label className="field moments-note-field">
          <span className="sr-only">Moment note</span>
          <textarea
            rows={4}
            value={note}
            placeholder="What happened in this moment?"
            onChange={(event) => setNote(event.target.value)}
          />
        </label>

        <label className="field moments-caption-field">
          <span>Caption</span>
          <input
            type="text"
            value={caption}
            placeholder="Optional label for this moment"
            onChange={(event) => setCaption(event.target.value)}
          />
        </label>

        <button
          type="button"
          className="moments-save-button"
          onClick={addMoment}
          disabled={isProcessing}
        >
          Save moment
        </button>
      </div>

      {pendingImage ? (
        <figure className="moments-preview">
          <img src={pendingImage.dataUrl} alt={caption.trim() || "Selected workshop photo"} />
          <figcaption className="moments-preview-actions">
            <button
              type="button"
              className="moment-share-button"
              onClick={() => void shareMomentToInstagram(pendingImage.dataUrl, caption.trim())}
            >
              Share to Instagram
            </button>
          </figcaption>
        </figure>
      ) : null}

      {statusMessage ? (
        <div className="moments-status" role="status">
          <span>{statusMessage}</span>
        </div>
      ) : null}

      {errorMessage ? (
        <div className="persistence-error" role="alert">
          <span>{errorMessage}</span>
        </div>
      ) : null}

      {moments.length === 0 ? (
        <div className="moments-empty">
          <p>No moments yet.</p>
          <span>Add a photo or note to start documenting the workshop.</span>
        </div>
      ) : (
        <div className="moments-grid">
          {moments.map((moment) => (
            <article key={moment.id} className="moment-card">
              <MomentMedia moment={moment} />
              <div className="moment-card-body">
                <time dateTime={new Date(moment.createdAtMs).toISOString()}>
                  {formatMomentTime(moment.createdAtMs)}
                </time>
                {moment.caption ? <p className="moment-caption">{moment.caption}</p> : null}
                {moment.kind !== "note" && moment.note ? <p className="moment-note">{moment.note}</p> : null}
                <div className="moment-card-actions">
                  {moment.kind === "image" && moment.dataUrl ? (
                    <button
                      type="button"
                      className="moment-share-button"
                      onClick={() => void shareMomentToInstagram(moment.dataUrl!, moment.caption)}
                    >
                      Share to Instagram
                    </button>
                  ) : null}
                  <button type="button" className="moment-delete-button" onClick={() => removeMoment(moment.id)}>
                    Remove
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function MomentMedia({ moment }: { readonly moment: WorkshopMoment }) {
  if (moment.kind === "image" && moment.dataUrl) {
    return <img src={moment.dataUrl} alt={moment.caption || "Workshop photo"} />;
  }

  if (moment.kind === "audio" && moment.dataUrl) {
    return (
      <div className="moment-audio-wrap">
        <audio controls src={moment.dataUrl}>
          Your browser does not support audio playback.
        </audio>
      </div>
    );
  }

  return <div className="moment-note-preview">{moment.note}</div>;
}

function formatMomentTime(timestampMs: number): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestampMs));
}
