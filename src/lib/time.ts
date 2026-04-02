function parseTimestamp(timestamp: string) {
  const direct = new Date(timestamp);
  if (!Number.isNaN(direct.getTime())) {
    return direct;
  }

  const normalized = timestamp.includes("T")
    ? timestamp
    : timestamp.replace(" ", "T");
  const withZone = /[zZ]|[+-]\d{2}:\d{2}$/.test(normalized)
    ? normalized
    : `${normalized}Z`;
  return new Date(withZone);
}

export function formatRelativeTime(timestamp: string) {
  const parsed = parseTimestamp(timestamp);
  if (Number.isNaN(parsed.getTime())) {
    return timestamp;
  }

  const diff = Date.now() - parsed.getTime();
  const minutes = Math.max(Math.floor(diff / 60000), 0);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return parsed.toLocaleString();
}

export function formatAbsoluteTime(timestamp: string) {
  const parsed = parseTimestamp(timestamp);
  if (Number.isNaN(parsed.getTime())) {
    return timestamp;
  }
  return parsed.toLocaleString();
}
