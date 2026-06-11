export function normalizeNumber(raw, defaultCountryCode = "") {
  let digits = String(raw || "").replace(/\D/g, "");
  const code = String(defaultCountryCode || "").replace(/\D/g, "");

  if (digits.startsWith("0") && code) {
    digits = `${code}${digits.slice(1)}`;
  }

  if (digits.length < 8 || digits.length > 15) {
    return { valid: false, digits, error: "Number must be 8 to 15 digits" };
  }

  return { valid: true, digits, jid: `${digits}@s.whatsapp.net` };
}

export function dedupeRecipients(recipients) {
  const seen = new Set();
  const unique = [];
  const duplicates = [];

  for (const recipient of recipients) {
    const key = String(recipient.number || "").replace(/\D/g, "");
    if (!key) continue;
    if (seen.has(key)) {
      duplicates.push(recipient);
    } else {
      seen.add(key);
      unique.push(recipient);
    }
  }

  return { unique, duplicates };
}

export function parsePasteInput(text) {
  return String(text || "")
    .split(/\n+/)
    .flatMap((line) => {
      const trimmed = line.trim();
      if (!trimmed) return [];
      const columns = splitCsvColumns(trimmed).map((part) => part.trim()).filter(Boolean);
      if (columns.length >= 2 && /[a-zA-Z]/.test(columns[0]) && /\d/.test(columns[1])) {
        return [{ name: columns[0], number: columns.slice(1).join(" ") }];
      }
      return columns.map((number) => ({ number, name: "" }));
    });
}

export function parseCsvText(text) {
  const [headerLine, ...lines] = splitCsvRows(text).filter((line) => line.trim());
  if (!headerLine) return [];

  const headers = splitCsvColumns(headerLine).map((header) => header.trim().toLowerCase());
  return lines.map((line) => {
    const values = splitCsvColumns(line);
    const row = Object.fromEntries(headers.map((header, index) => [header, values[index]?.trim() || ""]));
    return {
      ...row,
      number: row.number || row.phone || row.mobile || "",
      name: row.name || "",
    };
  });
}

export function parseJsonText(text) {
  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed)) throw new Error("JSON must be an array");

  return parsed.map((item) => {
    if (typeof item === "string" || typeof item === "number") {
      return { number: String(item), name: "" };
    }
    return { ...item, number: item.number || item.phone || "", name: item.name || "" };
  });
}

export function validateRecipients(recipients, defaultCountryCode = "") {
  const valid = [];
  const invalid = [];

  for (const recipient of recipients) {
    const normalized = normalizeNumber(recipient.number, defaultCountryCode);
    if (normalized.valid) {
      valid.push({ ...recipient, number: normalized.digits, jid: normalized.jid });
    } else {
      invalid.push({ ...recipient, error: normalized.error });
    }
  }

  return { valid, invalid };
}

export function personalizeMessage(message, recipient) {
  return String(message || "")
    .replace(/\{([^{}|]+(?:\|[^{}|]+)+)\}/g, (_, body) => {
      const options = body.split("|").map((part) => part.trim()).filter(Boolean);
      return options[Math.floor(Math.random() * options.length)] || "";
    })
    .replace(/\{([a-zA-Z0-9_ -]+)\}/g, (_, key) => {
      const normalizedKey = key.trim();
      if (/^date$/i.test(normalizedKey)) return new Date().toLocaleDateString();
      const value = recipient?.[normalizedKey]
        ?? recipient?.[normalizedKey.toLowerCase()]
        ?? recipient?.[normalizedKey.replace(/\s+/g, "_")]
        ?? "";
      return String(value);
    });
}

function splitCsvRows(text) {
  const rows = [];
  let current = "";
  let quoted = false;

  for (const char of String(text || "")) {
    if (char === "\"") quoted = !quoted;
    if ((char === "\n" || char === "\r") && !quoted) {
      if (current.trim()) rows.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  if (current.trim()) rows.push(current);
  return rows;
}

function splitCsvColumns(line) {
  const columns = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === "\"" && quoted && next === "\"") {
      current += "\"";
      index += 1;
    } else if (char === "\"") {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      columns.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  columns.push(current);
  return columns;
}
