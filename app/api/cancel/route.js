import { cancelCampaign } from "@/lib/sender";

export const runtime = "nodejs";

export async function POST() {
  cancelCampaign();
  return Response.json({ ok: true });
}
