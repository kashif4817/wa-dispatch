import { logout } from "@/lib/whatsapp";

export const runtime = "nodejs";

export async function POST() {
  await logout();
  return Response.json({ ok: true });
}
