import { getProgress } from "@/lib/sender";

export const runtime = "nodejs";

export async function GET() {
  return Response.json(getProgress());
}
