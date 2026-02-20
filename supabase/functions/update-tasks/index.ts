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

  const { token, taskId, checked } = await req.json().catch(() => ({}));
  if (!token || typeof token !== "string") return new Response(JSON.stringify({ error: "Missing token" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
  if (!taskId || typeof taskId !== "string") return new Response(JSON.stringify({ error: "Missing taskId" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
  if (typeof checked !== "boolean") return new Response(JSON.stringify({ error: "Missing checked" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: "Missing server env vars" }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const token_hash = await sha256Hex(token);

  const { data: session, error } = await supabase
    .from("discipline_sessions")
    .select("id, tasks_state")
    .eq("token_hash", token_hash)
    .maybeSingle();

  if (error || !session) return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });

  const tasks_state = { ...(session.tasks_state ?? {}) };
  tasks_state[taskId] = checked;

  const { error: upErr } = await supabase
    .from("discipline_sessions")
    .update({ tasks_state, last_seen_at: new Date().toISOString() })
    .eq("id", session.id);

  if (upErr) return new Response(JSON.stringify({ error: upErr.message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });

  return new Response(JSON.stringify({ tasks_state }), { headers: { ...cors, "Content-Type": "application/json" } });
});