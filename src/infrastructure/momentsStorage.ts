import type { StorageLike } from "./storage";

export const MOMENTS_STORAGE_KEY = "workshop-timer:moments:v1";

export interface WorkshopMoment {
  readonly id: string;
  readonly caption: string;
  readonly imageDataUrl: string;
  readonly createdAtMs: number;
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
  return (
    typeof moment.id === "string" &&
    typeof moment.caption === "string" &&
    typeof moment.imageDataUrl === "string" &&
    moment.imageDataUrl.startsWith("data:image/") &&
    typeof moment.createdAtMs === "number" &&
    Number.isFinite(moment.createdAtMs)
  );
}
