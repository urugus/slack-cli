export function parseScheduledTimestamp(value: string): number | null {
  const trimmed = value.trim();

  if (/^\d+$/.test(trimmed)) {
    const timestamp = Number.parseInt(trimmed, 10);
    return Number.isSafeInteger(timestamp) ? timestamp : null;
  }

  const parsedMs = Date.parse(trimmed);
  if (Number.isNaN(parsedMs)) {
    return null;
  }

  return Math.floor(parsedMs / 1000);
}

export function resolvePostAt(
  at: string | undefined,
  afterMinutes: string | undefined,
  nowMs = Date.now()
): number | null {
  if (at) {
    return parseScheduledTimestamp(at);
  }

  if (!afterMinutes) {
    return null;
  }

  const minutes = Number.parseInt(afterMinutes, 10);
  if (!Number.isSafeInteger(minutes) || minutes <= 0) {
    return null;
  }

  return Math.floor(nowMs / 1000) + minutes * 60;
}
