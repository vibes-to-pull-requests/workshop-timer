import { useRef, useState } from "react";

import { prepareImageDataUrl } from "../lib/image";
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

export default function WorkshopMoments({ storage, createId, now }: WorkshopMomentsProps) {
  const [moments, setMoments] = useState(() => loadMoments(storage));
  const [caption, setCaption] = useState("");
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [pendingFileName, setPendingFileName] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const fileInputRef = useRef<HTMLInputElement>(null);

  function persist(nextMoments: readonly WorkshopMoment[]) {
    if (!saveMoments(storage, nextMoments)) {
      setErrorMessage("Could not save this moment. Try removing older photos or using a smaller image.");
      return false;
    }
    setMoments([...nextMoments]);
    setErrorMessage(undefined);
    return true;
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setErrorMessage("Choose an image file to capture this moment.");
      return;
    }

    setIsProcessing(true);
    setErrorMessage(undefined);
    try {
      const imageDataUrl = await prepareImageDataUrl(file);
      setPendingImage(imageDataUrl);
      setPendingFileName(file.name);
    } catch {
      setErrorMessage("Could not read that image. Try another photo.");
      setPendingImage(null);
      setPendingFileName(null);
    } finally {
      setIsProcessing(false);
    }
  }

  function addMoment() {
    if (!pendingImage) {
      setErrorMessage("Add a photo before saving this moment.");
      return;
    }

    const nextMoment: WorkshopMoment = {
      id: createId(),
      caption: caption.trim(),
      imageDataUrl: pendingImage,
      createdAtMs: now(),
    };
    const nextMoments = [nextMoment, ...moments];
    if (!persist(nextMoments)) return;

    setCaption("");
    setPendingImage(null);
    setPendingFileName(null);
  }

  function removeMoment(id: string) {
    persist(moments.filter((moment) => moment.id !== id));
  }

  return (
    <section className="moments-view" aria-labelledby="moments-title">
      <div className="moments-intro">
        <p className="eyebrow">Capture</p>
        <h2 id="moments-title">Workshop moments</h2>
        <p>Save photos from the room as you go. Moments stay in this browser until you remove them.</p>
      </div>

      <div className="moments-form">
        <div className="moments-upload">
          <input
            ref={fileInputRef}
            className="moments-file-input"
            type="file"
            accept="image/*"
            capture="environment"
            aria-label="Add workshop photo"
            onChange={(event) => void handleFileChange(event)}
            disabled={isProcessing}
          />
          <button
            type="button"
            className="moments-upload-button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessing}
          >
            {isProcessing ? "Preparing photo..." : pendingImage ? "Replace photo" : "Add photo"}
          </button>
          {pendingFileName ? <span className="moments-file-name">{pendingFileName}</span> : null}
        </div>

        <label className="field moments-caption-field">
          <span>Caption</span>
          <input
            type="text"
            value={caption}
            placeholder="What happened in this moment?"
            onChange={(event) => setCaption(event.target.value)}
          />
        </label>

        <button
          type="button"
          className="moments-save-button"
          onClick={addMoment}
          disabled={isProcessing || !pendingImage}
        >
          Save moment
        </button>
      </div>

      {pendingImage ? (
        <figure className="moments-preview">
          <img src={pendingImage} alt={caption.trim() || "Selected workshop moment"} />
        </figure>
      ) : null}

      {errorMessage ? (
        <div className="persistence-error" role="alert">
          <span>{errorMessage}</span>
        </div>
      ) : null}

      {moments.length === 0 ? (
        <div className="moments-empty">
          <p>No moments yet.</p>
          <span>Add a photo to start your workshop scrapbook.</span>
        </div>
      ) : (
        <div className="moments-grid">
          {moments.map((moment) => (
            <article key={moment.id} className="moment-card">
              <img src={moment.imageDataUrl} alt={moment.caption || "Workshop moment"} />
              <div className="moment-card-body">
                <time dateTime={new Date(moment.createdAtMs).toISOString()}>
                  {formatMomentTime(moment.createdAtMs)}
                </time>
                {moment.caption ? <p>{moment.caption}</p> : null}
                <button type="button" className="moment-delete-button" onClick={() => removeMoment(moment.id)}>
                  Remove
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function formatMomentTime(timestampMs: number): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestampMs));
}
