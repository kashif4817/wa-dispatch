import { parseCsvText, parseJsonText, validateRecipients } from "@/lib/parsers";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    const format = form.get("format");
    const defaultCountryCode = form.get("defaultCountryCode") || "";

    if (!file) {
      return Response.json({ error: "No file uploaded" }, { status: 400 });
    }

    const text = await file.text();
    const recipients = format === "json" ? parseJsonText(text) : parseCsvText(text);
    const { valid, invalid } = validateRecipients(recipients, defaultCountryCode);

    return Response.json({ recipients: valid, invalid, total: recipients.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }
}
