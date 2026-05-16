import { autoConnectFromSession, getWhatsAppState } from "@/lib/whatsapp";

export const runtime = "nodejs";

export async function GET() {
  try {
    await autoConnectFromSession();
  } catch {
  }
  return Response.json(getWhatsAppState());
}
