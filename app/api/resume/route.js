import { resumeCampaign } from "@/lib/sender";

export const runtime = "nodejs";

export async function POST() {
  resumeCampaign();
  return Response.json({ ok: true });
}
