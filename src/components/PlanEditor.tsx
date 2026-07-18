import { useState } from "react";

import type { Segment } from "../domain/types";

interface PlanEditorProps {
  readonly segments: readonly Segment[];
  readonly onChange: (segments: readonly Segment[]) => void;
  readonly onStart: (segments: readonly Segment[]) => void;
  readonly onRetry: (segments: readonly Segment[]) => void;
  readonly createId: () => string;
  readonly canPersist: boolean;
  readonly persistenceMessage?: string;
}

export default function PlanEditor({
  segments: initialSegments,
  onChange,
  onStart,
  onRetry,
  createId,
  canPersist,
  persistenceMessage,
}: PlanEditorProps) {
  const [segments, setSegments] = useState(() => [...initialSegments]);
  const [durationInputs, setDurationInputs] = useState<Record<string, string>>(
    () => Object.fromEntries(initialSegments.map((segment) => [segment.id, String(segment.durationMinutes)])),
  );

  const validity = segments.map((segment) => ({
    name: segment.name.trim().length > 0,
    duration: isPositiveWholeMinutes(durationInputs[segment.id] ?? ""),
  }));
  const planIsValid = segments.length > 0 && validity.every((item) => item.name && item.duration);
  const totalMinutes = segments.reduce(
    (total, segment, index) => total + (validity[index]?.duration ? segment.durationMinutes : 0),
    0,
  );

  function publish(next: readonly Segment[]) {
    setSegments([...next]);
    onChange(next);
  }

  function addSegment() {
    const id = createId();
    const next = [...segments, { id, name: "", durationMinutes: 0 }];
    setDurationInputs((current) => ({ ...current, [id]: "" }));
    publish(next);
  }

  function updateSegment(id: string, updates: Partial<Pick<Segment, "name" | "durationMinutes">>) {
    publish(segments.map((segment) => (segment.id === id ? { ...segment, ...updates } : segment)));
  }

  function updateDuration(id: string, value: string) {
    setDurationInputs((current) => ({ ...current, [id]: value }));
    const parsed = Number(value);
    updateSegment(id, Number.isFinite(parsed) ? { durationMinutes: parsed } : { durationMinutes: 0 });
  }

  function removeSegment(id: string) {
    setDurationInputs((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    publish(segments.filter((segment) => segment.id !== id));
  }

  function moveSegment(index: number, offset: -1 | 1) {
    const target = index + offset;
    if (target < 0 || target >= segments.length) return;
    const next = [...segments];
    [next[index], next[target]] = [next[target]!, next[index]!];
    publish(next);
  }

  return (
    <section className="plan-editor" aria-labelledby="plan-title">
      <div className="plan-intro">
        <p className="eyebrow">Your run of show</p>
        <h1 id="plan-title">Plan your workshop</h1>
        <p>Build one continuous sequence. You can fine-tune it until the workshop starts.</p>
      </div>

      {persistenceMessage ? (
        <div className="persistence-error" role="alert">
          <span>{persistenceMessage}</span>
          <button type="button" onClick={() => onRetry(segments)}>Retry save</button>
        </div>
      ) : null}

      <div className="segment-list" aria-label="Workshop segments">
        {segments.length === 0 ? (
          <div className="empty-plan">
            <p>No segments yet.</p>
            <span>Add the first part of your workshop to begin.</span>
          </div>
        ) : null}

        {segments.map((segment, index) => {
          const nameErrorId = `${segment.id}-name-error`;
          const durationErrorId = `${segment.id}-duration-error`;
          const itemValidity = validity[index]!;
          return (
            <div className="segment-row" data-testid={`segment-${segment.id}`} key={segment.id}>
              <span className="segment-number" aria-hidden="true">{index + 1}</span>
              <div className="field segment-name-field">
                <label htmlFor={`${segment.id}-name`}>Segment name</label>
                <input
                  id={`${segment.id}-name`}
                  value={segment.name}
                  aria-invalid={!itemValidity.name}
                  aria-describedby={!itemValidity.name ? nameErrorId : undefined}
                  placeholder="e.g. Welcome and context"
                  onChange={(event) => updateSegment(segment.id, { name: event.target.value })}
                />
                {!itemValidity.name ? <span className="field-error" id={nameErrorId}>Enter a segment name.</span> : null}
              </div>
              <div className="field duration-field">
                <label htmlFor={`${segment.id}-duration`}>Duration in minutes</label>
                <div className="duration-input">
                  <input
                    id={`${segment.id}-duration`}
                    inputMode="numeric"
                    value={durationInputs[segment.id] ?? ""}
                    aria-invalid={!itemValidity.duration}
                    aria-describedby={!itemValidity.duration ? durationErrorId : undefined}
                    onChange={(event) => updateDuration(segment.id, event.target.value)}
                  />
                  <span>min</span>
                </div>
                {!itemValidity.duration ? <span className="field-error" id={durationErrorId}>Enter a positive whole number of minutes.</span> : null}
              </div>
              <div className="segment-actions" aria-label={`Reorder ${segment.name || `segment ${index + 1}`}`}>
                <button type="button" disabled={index === 0} aria-label={`Move ${segment.name || `segment ${index + 1}`} up`} onClick={() => moveSegment(index, -1)}>↑</button>
                <button type="button" disabled={index === segments.length - 1} aria-label={`Move ${segment.name || `segment ${index + 1}`} down`} onClick={() => moveSegment(index, 1)}>↓</button>
                <button className="delete-button" type="button" aria-label={`Delete ${segment.name || `segment ${index + 1}`}`} onClick={() => removeSegment(segment.id)}>Delete</button>
              </div>
            </div>
          );
        })}
      </div>

      <button className="add-button" type="button" aria-label="Add segment" onClick={addSegment}>+ Add segment</button>

      <footer className="plan-footer">
        <div>
          <span className="footer-label">Planned duration</span>
          <strong>{formatTotal(totalMinutes)}</strong>
        </div>
        <button className="start-button" type="button" disabled={!planIsValid || !canPersist} onClick={() => onStart(segments)}>Start workshop</button>
      </footer>
    </section>
  );
}

function isPositiveWholeMinutes(value: string): boolean {
  return /^[1-9]\d*$/.test(value);
}

function formatTotal(minutes: number): string {
  if (minutes === 0) return "0 min total";
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours === 0) return `${remainder} min total`;
  if (remainder === 0) return `${hours} hr total`;
  return `${hours} hr ${remainder} min total`;
}
