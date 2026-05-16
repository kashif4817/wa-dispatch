import { getSupabase, hasSupabaseConfig } from "@/lib/supabase";

export const runtime = "nodejs";

export async function GET() {
  if (!hasSupabaseConfig()) {
    return Response.json({
      pin: process.env.NEXT_PUBLIC_APP_PIN || "1234",
      source: "env",
    });
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("pins")
    .select("pin")
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data?.pin) {
    return Response.json({
      pin: process.env.NEXT_PUBLIC_APP_PIN || "1234",
      source: "env",
    });
  }

  return Response.json({ pin: data.pin, source: "database" });
}
