import type { StorageLike } from "./storage";

export const MOMENTS_STORAGE_KEY = "workshop-timer:moments:v1";

export type WorkshopMomentKind = "image" | "audio" | "note";

export interface WorkshopMoment {
  readonly id: string;
  readonly kind: WorkshopMomentKind;
  readonly caption: string;
  readonly createdAtMs: number;
  readonly dataUrl?: string;
  readonly mimeType?: string;
  readonly note?: string;
}

export function loadMoments(storage: StorageLike): WorkshopMoment[] {
  try {
    const raw = storage.getItem(MOMENTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isWorkshopMoment);
  } catch {
    return [];
  }
}

export function saveMoments(storage: StorageLike, moments: readonly WorkshopMoment[]): boolean {
  try {
    storage.setItem(MOMENTS_STORAGE_KEY, JSON.stringify(moments));
    return true;
  } catch {
    return false;
  }
}

function isWorkshopMoment(value: unknown): value is WorkshopMoment {
  if (!value || typeof value !== "object") return false;
  const moment = value as Partial<WorkshopMoment>;
  if (
    typeof moment.id !== "string" ||
    typeof moment.caption !== "string" ||
    typeof moment.createdAtMs !== "number" ||
    !Number.isFinite(moment.createdAtMs)
  ) {
    return false;
  }

  if (moment.kind === "note") {
    return typeof moment.note === "string" && moment.note.trim().length > 0;
  }

  if (moment.kind === "image" || moment.kind === "audio") {
    return (
      typeof moment.dataUrl === "string" &&
      moment.dataUrl.startsWith("data:") &&
      typeof moment.mimeType === "string"
    );
  }

  return false;
}
