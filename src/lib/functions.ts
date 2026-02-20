type Json = Record<string, any>;

const base = import.meta.env.VITE_FUNCTIONS_BASE as string;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

async function post<T>(path: string, body: Json): Promise<T> {
  const res = await fetch(`${base}/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": anon,
      "Authorization": `Bearer ${anon}`,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (data && (data.error || data.message)) ? (data.error || data.message) : `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data as T;
}

export type SessionResponse = {
  server_now: string;
  started_at: string;
  ends_at: string;
  tasks_state: Record<string, boolean>;
  completed_at: string | null;
};

export async function createSession(email: string) {
  return post<{ token: string }>("create-session", { email });
}

export async function getSession(token: string) {
  return post<SessionResponse>("get-session", { token });
}

export async function updateTask(token: string, taskId: string, checked: boolean) {
  return post<{ tasks_state: Record<string, boolean> }>("update-tasks", { token, taskId, checked });
}