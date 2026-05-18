export function formatDateTime(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const month = date.getMonth() + 1;
  const day = date.getDate();
  const year = date.getFullYear();
  const time = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });

  return `${month}-${day}-${year}, ${time}`;
}

export function formatTime(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function normalizeDateText(text = "") {
  return String(text).replace(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g, "$1-$2-$3");
}

export function campaignName(value = new Date()) {
  return `Campaign ${formatDateTime(value)}`;
}
