import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { crypto } from "https://deno.land/std@0.224.0/crypto/mod.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sha256Hex(input: string) {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const { token } = await req.json().catch(() => ({}));
  if (!token || typeof token !== "string") {
    return new Response(JSON.stringify({ error: "Missing token" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: "Missing server env vars" }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const token_hash = await sha256Hex(token);

  const { data: session, error } = await supabase
    .from("discipline_sessions")
    .select("id, started_at, ends_at, tasks_state, completed_at")
    .eq("token_hash", token_hash)
    .maybeSingle();

  if (error || !session) {
    return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });
  }

  const now = new Date();
  const nowIso = now.toISOString();

  let started_at = session.started_at as string | null;
  let ends_at = session.ends_at as string | null;

  if (!started_at || !ends_at) {
    started_at = nowIso;
    ends_at = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

    await supabase.from("discipline_sessions").update({
      started_at,
      ends_at,
      last_seen_at: nowIso,
    }).eq("id", session.id);
  } else {
    await supabase.from("discipline_sessions").update({ last_seen_at: nowIso }).eq("id", session.id);
  }

  return new Response(JSON.stringify({
    server_now: nowIso,
    started_at,
    ends_at,
    tasks_state: session.tasks_state ?? {},
    completed_at: session.completed_at ?? null,
  }), { headers: { ...cors, "Content-Type": "application/json" } });
});