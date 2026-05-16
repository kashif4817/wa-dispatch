import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function hasSupabaseConfig() {
  return Boolean(url && anon && !url.includes("xxx"));
}

export function getSupabase() {
  if (!hasSupabaseConfig()) {
    throw new Error("Missing Supabase configuration. Fill .env.local first.");
  }

  return createClient(url, anon, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function getPublicUrl(bucket, path) {
  if (!hasSupabaseConfig() || !path) return "";
  return createClient(url, anon).storage.from(bucket).getPublicUrl(path).data.publicUrl;
}
