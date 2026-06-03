import { pauseCampaign } from "@/lib/sender";

export const runtime = "nodejs";

export async function POST() {
  pauseCampaign();
  return Response.json({ ok: true });
}
