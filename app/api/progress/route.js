import { getProgress } from "@/lib/sender";
import { getSupabase, hasSupabaseConfig } from "@/lib/supabase";

export const runtime = "nodejs";

export async function GET() {
  const progress = getProgress();
  if ((progress.status && progress.status !== "idle") || !hasSupabaseConfig()) {
    return Response.json(progress);
  }

  try {
    const { data } = await getSupabase()
      .from("campaigns")
      .select("id,total,sent,failed,skipped,status,runner_status,scheduled_for,queue_position,name")
      .in("status", ["queued", "scheduled", "running", "retrying", "paused"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data?.id) {
      return Response.json({
        id: data.id,
        total: data.total || 0,
        sent: data.sent || 0,
        failed: data.failed || 0,
        skipped: data.skipped || 0,
        current: null,
        status: data.status || data.runner_status || "queued",
        queued: data.queue_position ? 1 : 0,
        log: [{
          at: new Date().toISOString(),
          status: data.status || "queued",
          number: "system",
          message: data.scheduled_for ? `Persisted campaign scheduled for ${data.scheduled_for}` : "Persisted campaign state loaded from database",
        }],
      });
    }
  } catch {
  }

  return Response.json(progress);
}
