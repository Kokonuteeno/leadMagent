import { useEffect, useMemo, useRef, useState } from "react";
import { getSession, updateTask, type SessionResponse } from "../lib/functions";

const TOKEN_KEY = "discipline_token";

function getTokenFromUrl(): string | null {
  const t = new URLSearchParams(window.location.search).get("t");
  return t && t.trim() ? t : null;
}

function getStoredToken(): string | null {
  const t = localStorage.getItem(TOKEN_KEY);
  return t && t.trim() ? t : null;
}

function storeToken(t: string) {
  localStorage.setItem(TOKEN_KEY, t);
}

export function useDisciplineSession() {
  const [token, setToken] = useState<string | null>(null);
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // offset to match server time (anti "wrong clock" issues)
  const offsetRef = useRef<number>(0);

  useEffect(() => {
    const tFromUrl = getTokenFromUrl();
    const t = tFromUrl || getStoredToken();
    if (tFromUrl) storeToken(tFromUrl);
    setToken(t ?? null);
  }, []);

  useEffect(() => {
    if (!token) { setLoading(false); return; }

    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const s = await getSession(token);

        // compute offset once per fetch
        offsetRef.current = Date.parse(s.server_now) - Date.now();

        if (!cancelled) setSession(s);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Failed to load session");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [token]);

  const nowMs = () => Date.now() + offsetRef.current;

  const endsAtMs = useMemo(() => session ? Date.parse(session.ends_at) : null, [session]);
  const timeLeftMs = useMemo(() => {
    if (!endsAtMs) return null;
    return Math.max(0, endsAtMs - nowMs());
  }, [endsAtMs, session]); // session triggers recompute when loaded

  const isUnlocked = useMemo(() => {
    if (!endsAtMs) return false;
    return nowMs() >= endsAtMs;
  }, [endsAtMs, session]);

  const tasksState = session?.tasks_state ?? {};

  async function toggleTask(taskId: string, checked: boolean) {
    if (!token) return;

    // optimistic UI
    setSession((prev) => prev ? ({ ...prev, tasks_state: { ...prev.tasks_state, [taskId]: checked } }) : prev);

    try {
      const res = await updateTask(token, taskId, checked);
      setSession((prev) => prev ? ({ ...prev, tasks_state: res.tasks_state }) : prev);
    } catch (e: any) {
      // rollback by refetching session (simplest reliable)
      const fresh = await getSession(token);
      offsetRef.current = Date.parse(fresh.server_now) - Date.now();
      setSession(fresh);
      throw e;
    }
  }

  function resetLocalToken() {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setSession(null);
  }

  return {
    token,
    session,
    tasksState,
    loading,
    error,
    timeLeftMs,
    isUnlocked,
    toggleTask,
    resetLocalToken,
  };
}