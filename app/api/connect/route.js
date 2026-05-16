import { connect } from "@/lib/whatsapp";

export const runtime = "nodejs";

export async function POST() {
  connect().catch(() => {});
  return Response.json({ ok: true });
}
