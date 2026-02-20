import { useEffect, useMemo, useRef, useState } from 'react'
import { CheckSquare, Square } from 'lucide-react'

type TaskDef = {
  id: string
  title: string
  description: string
}

type SessionResponse = {
  server_now: string
  started_at: string
  ends_at: string
  tasks_state: Record<string, boolean>
  completed_at: string | null
}

const TOKEN_KEY = 'discipline_token'

const TASKS: TaskDef[] = [
  {
    id: 'no_passive_scrolling',
    title: 'No passive scrolling',
    description:
      "Zero mindless scroll. If you open IG/TikTok, it's for a purpose—then out.",
  },
  {
    id: 'no_negotiating',
    title: 'No negotiating with yourself',
    description: 'No "maybe later". Decide once, then execute.',
  },
  {
    id: 'no_postponing_decisions',
    title: 'No postponing decisions',
    description: 'Make decisions early. Kill mental clutter.',
  },
  {
    id: 'training_done',
    title: 'Training—done without thinking',
    description: 'Train as planned. Not when you feel like it.',
  },
  {
    id: 'plan_tomorrow',
    title: 'Plan tomorrow in 3 minutes',
    description: 'Write your training time + 1 priority task for tomorrow.',
  },
  {
    id: 'action_over_feeling',
    title: 'Action > feeling',
    description: 'Do the next step even if you feel lazy. No drama.',
  },
  {
    id: 'finish_avoided_task',
    title: 'Finish one avoided task',
    description:
      "Complete one thing you've been avoiding (small is fine, but finished).",
  },
]

function getTokenFromUrl(): string | null {
  const t = new URLSearchParams(window.location.search).get('t')
  return t && t.trim() ? t.trim() : null
}

function getStoredToken(): string | null {
  const t = localStorage.getItem(TOKEN_KEY)
  return t && t.trim() ? t.trim() : null
}

function storeToken(t: string) {
  localStorage.setItem(TOKEN_KEY, t)
}

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

function formatRemaining(ms: number) {
  if (ms <= 0) return 'Unlocked'
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  return `${h}h ${pad2(m)}m`
}

async function postFn<T>(path: string, body: unknown): Promise<T> {
  const base = import.meta.env.VITE_FUNCTIONS_BASE as string
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string

  if (!base) throw new Error('Missing VITE_FUNCTIONS_BASE')
  if (!anon) throw new Error('Missing VITE_SUPABASE_ANON_KEY')

  const res = await fetch(`${base}/${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anon,
      Authorization: `Bearer ${anon}`,
    },
    body: JSON.stringify(body),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg =
      (data && (data.error || data.message)) || `HTTP ${res.status}`
    throw new Error(msg)
  }
  return data as T
}

async function getSession(token: string) {
  return postFn<SessionResponse>('get-session', { token })
}

async function updateTask(token: string, taskId: string, checked: boolean) {
  return postFn<{ tasks_state: Record<string, boolean> }>('update-tasks', {
    token,
    taskId,
    checked,
  })
}

const DisciplineTracker = () => {
  const [token, setToken] = useState<string | null>(null)
  const [session, setSession] = useState<SessionResponse | null>(null)
  const [tasksState, setTasksState] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [isDoneForToday, setIsDoneForToday] = useState(false)
  const [showResult, setShowResult] = useState(false)

  const offsetMsRef = useRef(0)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const fromUrl = getTokenFromUrl()
    const stored = getStoredToken()
    const t = fromUrl || stored
    if (fromUrl) storeToken(fromUrl)
    setToken(t ?? null)
  }, [])

  useEffect(() => {
    if (!token) {
      setLoading(false)
      return
    }

    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        setError(null)
        const s = await getSession(token)

        offsetMsRef.current = Date.parse(s.server_now) - Date.now()

        if (cancelled) return
        setSession(s)
        setTasksState(s.tasks_state ?? {})
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? 'Failed to load session')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [token])

  useEffect(() => {
    const id = window.setInterval(() => setTick((x) => x + 1), 1000)
    return () => window.clearInterval(id)
  }, [])

  const totalTasks = TASKS.length

  const completedCount = useMemo(() => {
    return TASKS.reduce((acc, t) => acc + (tasksState[t.id] ? 1 : 0), 0)
  }, [tasksState])

  const endsAtMs = session ? Date.parse(session.ends_at) : null
  const nowMs = () => Date.now() + offsetMsRef.current

  const remainingMs = useMemo(() => {
    if (!endsAtMs) return null
    return Math.max(0, endsAtMs - nowMs())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endsAtMs, tick])

  const isTimerExpired = useMemo(() => {
    if (!endsAtMs) return false
    return nowMs() >= endsAtMs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endsAtMs, tick])

  const getResultText = () => {
    if (completedCount === 0) return 'No system, no control. Start building structure.'
    if (completedCount <= 2) return 'Weak foundation. Keep showing up.'
    if (completedCount <= 4) return 'Progress visible. Stay consistent.'
    if (completedCount <= 6) return "Strong momentum. Don't stop now."
    return 'Full execution. This is discipline.'
  }

  const getResultTitle = () => {
    if (completedCount === 0) return 'Discipline: Unstable'
    if (completedCount <= 2) return 'Discipline: Forming'
    if (completedCount <= 4) return 'Discipline: Building'
    if (completedCount <= 6) return 'Discipline: Strong'
    return 'Discipline: Elite'
  }

  const toggleTask = async (taskId: string) => {
    if (!token || isDoneForToday || actionLoading) return

    const next = !tasksState[taskId]
    setTasksState((prev) => ({ ...prev, [taskId]: next }))

    try {
      setActionLoading(true)
      const res = await updateTask(token, taskId, next)
      setTasksState(res.tasks_state ?? {})
    } catch (e: any) {
      try {
        const fresh = await getSession(token)
        offsetMsRef.current = Date.parse(fresh.server_now) - Date.now()
        setSession(fresh)
        setTasksState(fresh.tasks_state ?? {})
      } catch {}
      setError(e?.message ?? 'Failed to update task')
    } finally {
      setActionLoading(false)
    }
  }

  const resetProgress = async () => {
    if (!token || actionLoading) return
    try {
      setActionLoading(true)
      setError(null)
      await Promise.all(
        TASKS.map((t) => updateTask(token, t.id, false))
      )
      const fresh = await getSession(token)
      offsetMsRef.current = Date.parse(fresh.server_now) - Date.now()
      setSession(fresh)
      setTasksState(fresh.tasks_state ?? {})
      setIsDoneForToday(false)
      setShowResult(false)
    } catch (e: any) {
      setError(e?.message ?? 'Failed to reset progress')
    } finally {
      setActionLoading(false)
    }
  }

  const markDone = () => setIsDoneForToday(true)
  const unlockProgress = () => setIsDoneForToday(false)

  if (loading) {
    return (
      <div className="min-h-screen bg-[#202020] flex items-center justify-center p-4">
        <div className="text-[#F9F6EE] opacity-80">Loading…</div>
      </div>
    )
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-[#202020] flex items-center justify-center p-4">
        <div className="w-full max-w-xl bg-[#1a1a1a] rounded-2xl border border-[#2a2a2a] p-6 text-[#F9F6EE]">
          <h1 className="text-xl font-bold mb-2">No session found</h1>
          <p className="opacity-70 text-sm">
            Open this page from the landing link after submitting your email.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#202020] flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-2xl bg-[#1a1a1a] rounded-2xl shadow-2xl overflow-hidden border border-[#2a2a2a]">
        <div className="p-6 sm:p-8 lg:p-10">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-[#F9F6EE] mb-2">
                24-Hour Discipline Reset
              </h1>
              <p className="text-[#F9F6EE] text-sm opacity-60 flex items-center gap-2">
                by <img src="/LogoPNG.png" alt="Drivewealth" className="h-4 opacity-80" />
              </p>
            </div>
          </div>

          <p className="text-[#F9F6EE] text-sm mb-6 opacity-80 leading-relaxed">
            This is not motivation. Follow a system for one day. Check the boxes as you complete them.
            After 24 hours, your result unlocks a reward.
          </p>

          <div className="flex flex-wrap items-center gap-4 mb-8 pb-6 border-b border-[#2a2a2a]">
            <div className="text-[#F9F6EE]">
              <span className="text-sm opacity-60">Score: </span>
              <span className="text-lg font-semibold">
                {completedCount}/{totalTasks}
              </span>
            </div>

            <div className="text-[#F9F6EE] text-sm">
              <span className="opacity-60">Unlock in: </span>
              <span className="font-medium">
                {remainingMs == null ? '…' : formatRemaining(remainingMs)}
              </span>
            </div>

            <button
              onClick={isDoneForToday ? unlockProgress : markDone}
              className="text-[#F9F6EE] text-sm px-4 py-1.5 rounded-lg bg-[#2a2a2a] hover:bg-[#333333] transition-colors disabled:opacity-50"
              disabled={actionLoading}
            >
              {isDoneForToday ? 'Continue tracking' : "I'm done for today"}
            </button>

            <button
              onClick={resetProgress}
              className="text-[#F9F6EE] text-sm px-4 py-1.5 rounded-lg bg-[#2a2a2a] hover:bg-[#333333] transition-colors disabled:opacity-50"
              disabled={actionLoading}
            >
              Reset progress
            </button>
          </div>

          {error && (
            <div className="mb-6 rounded-xl border border-[#3a3a3a] bg-[#2a2a2a] p-4 text-[#F9F6EE]">
              <div className="text-sm opacity-80">Error: {error}</div>
            </div>
          )}

          <div className="space-y-3 mb-8">
            {TASKS.map((task) => {
              const completed = !!tasksState[task.id]
              return (
                <div
                  key={task.id}
                  onClick={() => toggleTask(task.id)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer ${
                    completed
                      ? 'bg-[#2a2a2a] border-[#3a3a3a]'
                      : 'bg-[#1a1a1a] border-[#2a2a2a] hover:border-[#3a3a3a]'
                  } ${isDoneForToday || actionLoading ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex-shrink-0">
                      {completed ? (
                        <CheckSquare className="w-5 h-5 text-[#F9F6EE]" />
                      ) : (
                        <Square className="w-5 h-5 text-[#F9F6EE] opacity-40" />
                      )}
                    </div>
                    <div className="flex-1">
                      <h3
                        className={`font-semibold mb-1 ${
                          completed ? 'text-[#F9F6EE] line-through opacity-60' : 'text-[#F9F6EE]'
                        }`}
                      >
                        {task.title}
                      </h3>
                      <p
                        className={`text-sm ${
                          completed ? 'text-[#F9F6EE] opacity-40' : 'text-[#F9F6EE] opacity-70'
                        }`}
                      >
                        {task.description}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="bg-[#2a2a2a] rounded-xl p-6 border border-[#3a3a3a]">
            {!showResult ? (
              <>
                <button
                  disabled={!isTimerExpired}
                  onClick={() => setShowResult(true)}
                  className={`w-full px-6 py-3 rounded-lg font-bold text-lg transition-all ${
                    isTimerExpired
                      ? 'bg-[#F9F6EE] text-[#202020] hover:bg-[#e5e2d5] cursor-pointer'
                      : 'bg-[#F9F6EE] text-[#202020] opacity-50 cursor-not-allowed'
                  }`}
                >
                  Unlock reward
                </button>

                <button
                  onClick={() => {}}
                  className="w-full mt-4 px-6 py-3 bg-[#1a1a1a] text-[#F9F6EE] border border-[#2a2a2a] rounded-lg font-medium hover:bg-[#2a2a2a] transition-all cursor-pointer"
                >
                  Get the full 21-day system
                </button>

                <p className="text-xs text-[#F9F6EE] opacity-50 mt-4 text-center leading-relaxed">
                  {isTimerExpired
                    ? 'Reward unlocked'
                    : `Unlock reward in ${remainingMs == null ? '…' : formatRemaining(remainingMs)}`}
                </p>
              </>
            ) : (
              <>
                <h2 className="text-lg font-bold text-[#F9F6EE] mb-3">Your result</h2>
                <p className="text-sm text-[#F9F6EE] opacity-70 mb-4 leading-relaxed">
                  Result tier is based on your score. Reward unlocks after 24h from when you started.
                  Don&apos;t overthink it—execute.
                </p>

                <div className="bg-[#1a1a1a] rounded-lg p-4 mb-4 border border-[#2a2a2a]">
                  <p className="text-[#F9F6EE] font-semibold mb-1">{getResultTitle()}</p>
                  <p className="text-sm text-[#F9F6EE] opacity-70">{getResultText()}</p>
                </div>

                <button
                  onClick={() => setShowResult(false)}
                  className="w-full px-6 py-2.5 bg-[#1a1a1a] text-[#F9F6EE] rounded-lg font-medium border border-[#2a2a2a] hover:bg-[#2a2a2a] transition-colors"
                >
                  Back
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default DisciplineTracker