import { useState, useEffect, useCallback } from "react"
import type { GatewayClient } from "@/lib/gateway-client"
import {
  Clock,
  Plus,
  Trash2,
  Play,
  Pause,
  RotateCw,
  Calendar,
  Zap,
  Timer,
  AlertCircle,
  CheckCircle2,
  XCircle,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"

interface CronJob {
  id: string
  name?: string
  schedule: {
    kind: "at" | "every" | "cron"
    at?: string
    everyMs?: number
    expr?: string
    tz?: string
  }
  payload: {
    kind: "systemEvent" | "agentTurn"
    text?: string
    message?: string
    model?: string
  }
  sessionTarget: "main" | "isolated"
  enabled: boolean
  lastRun?: string
  nextRun?: string
  runCount?: number
}

interface CronPageProps {
  client: GatewayClient
  isConnected: boolean
}

export function CronPage({ client, isConnected }: CronPageProps) {
  const [jobs, setJobs] = useState<CronJob[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [runningJobs, setRunningJobs] = useState<Set<string>>(new Set())

  // New job form state
  const [newJobName, setNewJobName] = useState("")
  const [newJobScheduleKind, setNewJobScheduleKind] = useState<"every" | "cron" | "at">("every")
  const [newJobInterval, setNewJobInterval] = useState("30")  // minutes
  const [newJobCronExpr, setNewJobCronExpr] = useState("0 */6 * * *")
  const [newJobAtTime, setNewJobAtTime] = useState("")
  const [newJobPayloadKind, setNewJobPayloadKind] = useState<"systemEvent" | "agentTurn">("agentTurn")
  const [newJobMessage, setNewJobMessage] = useState("")
  const [newJobSessionTarget, setNewJobSessionTarget] = useState<"main" | "isolated">("isolated")

  const loadJobs = useCallback(async () => {
    if (!isConnected) return
    setIsLoading(true)
    setError(null)
    try {
      const result = await client.cronList() as { jobs?: CronJob[] }
      if (result?.jobs) {
        setJobs(result.jobs)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load cron jobs")
    }
    setIsLoading(false)
  }, [isConnected, client])

  useEffect(() => {
    loadJobs()
  }, [loadJobs])

  // Refresh jobs periodically
  useEffect(() => {
    if (!isConnected) return
    const interval = setInterval(loadJobs, 15000)
    return () => clearInterval(interval)
  }, [isConnected, loadJobs])

  const handleCreateJob = async () => {
    if (!isConnected || !newJobMessage.trim()) return

    const job: Record<string, unknown> = {
      name: newJobName.trim() || undefined,
      sessionTarget: newJobSessionTarget,
      enabled: true,
    }

    // Schedule
    if (newJobScheduleKind === "every") {
      job.schedule = { kind: "every", everyMs: parseInt(newJobInterval) * 60000 }
    } else if (newJobScheduleKind === "cron") {
      job.schedule = { kind: "cron", expr: newJobCronExpr }
    } else if (newJobScheduleKind === "at") {
      job.schedule = { kind: "at", at: new Date(newJobAtTime).toISOString() }
    }

    // Payload
    if (newJobPayloadKind === "agentTurn") {
      job.payload = { kind: "agentTurn", message: newJobMessage }
    } else {
      job.payload = { kind: "systemEvent", text: newJobMessage }
    }

    try {
      await client.cronAdd({ job })
      setShowCreateForm(false)
      resetForm()
      await loadJobs()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create job")
    }
  }

  const handleDeleteJob = async (jobId: string) => {
    if (!isConnected) return
    try {
      await client.cronRemove(jobId)
      await loadJobs()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete job")
    }
  }

  const handleRunJob = async (jobId: string) => {
    if (!isConnected) return
    setRunningJobs((prev) => new Set(prev).add(jobId))
    try {
      await client.cronRun(jobId)
      setTimeout(() => {
        setRunningJobs((prev) => {
          const next = new Set(prev)
          next.delete(jobId)
          return next
        })
        loadJobs()
      }, 3000)
    } catch (err) {
      setRunningJobs((prev) => {
        const next = new Set(prev)
        next.delete(jobId)
        return next
      })
      setError(err instanceof Error ? err.message : "Failed to run job")
    }
  }

  const resetForm = () => {
    setNewJobName("")
    setNewJobScheduleKind("every")
    setNewJobInterval("30")
    setNewJobCronExpr("0 */6 * * *")
    setNewJobAtTime("")
    setNewJobPayloadKind("agentTurn")
    setNewJobMessage("")
    setNewJobSessionTarget("isolated")
  }

  const formatSchedule = (schedule: CronJob["schedule"]) => {
    if (schedule.kind === "every" && schedule.everyMs) {
      const mins = schedule.everyMs / 60000
      if (mins < 60) return `Every ${mins}min`
      const hrs = mins / 60
      if (hrs < 24) return `Every ${hrs}h`
      return `Every ${hrs / 24}d`
    }
    if (schedule.kind === "cron") return schedule.expr || "cron"
    if (schedule.kind === "at") {
      return schedule.at ? new Date(schedule.at).toLocaleString() : "one-shot"
    }
    return "unknown"
  }

  const formatTimeAgo = (dateStr?: string) => {
    if (!dateStr) return "never"
    const diff = Date.now() - new Date(dateStr).getTime()
    if (diff < 60000) return "just now"
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
    return `${Math.floor(diff / 86400000)}d ago`
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Cron Jobs</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Schedule recurring tasks, reminders, and automated agent actions
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadJobs} disabled={isLoading}>
            <RotateCw className={`h-3.5 w-3.5 mr-1.5 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setShowCreateForm(!showCreateForm)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            New Job
          </Button>
        </div>
      </div>

      {!isConnected && (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              <div>
                <p className="text-sm font-medium text-amber-200">Gateway not connected</p>
                <p className="text-xs text-amber-300/80">Start the gateway from Dashboard to manage cron jobs</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="border-red-500/50 bg-red-500/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <XCircle className="h-5 w-5 text-red-500" />
                <p className="text-sm text-red-300">{error}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setError(null)}>Dismiss</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create Job Form */}
      {showCreateForm && (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="text-base">Create New Cron Job</CardTitle>
            <CardDescription>Schedule a recurring task or one-shot reminder</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-zinc-400 mb-1.5 block">Job Name (optional)</label>
                <input
                  type="text"
                  value={newJobName}
                  onChange={(e) => setNewJobName(e.target.value)}
                  placeholder="e.g., Daily Market Brief"
                  className="h-9 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-400 mb-1.5 block">Session Target</label>
                <select
                  value={newJobSessionTarget}
                  onChange={(e) => {
                    const target = e.target.value as "main" | "isolated"
                    setNewJobSessionTarget(target)
                    // Auto-adjust payload kind based on target
                    if (target === "main") setNewJobPayloadKind("systemEvent")
                    if (target === "isolated") setNewJobPayloadKind("agentTurn")
                  }}
                  className="h-9 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="isolated">Isolated (background agent)</option>
                  <option value="main">Main Session (system event)</option>
                </select>
              </div>
            </div>

            <Separator />

            <div>
              <label className="text-xs font-medium text-zinc-400 mb-1.5 block">Schedule</label>
              <div className="flex items-center gap-3 mb-3">
                {(["every", "cron", "at"] as const).map((kind) => (
                  <button
                    key={kind}
                    onClick={() => setNewJobScheduleKind(kind)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      newJobScheduleKind === kind
                        ? "bg-primary text-primary-foreground"
                        : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                    }`}
                  >
                    {kind === "every" ? "⏱ Interval" : kind === "cron" ? "📅 Cron Expression" : "🎯 One-shot"}
                  </button>
                ))}
              </div>

              {newJobScheduleKind === "every" && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-400">Every</span>
                  <input
                    type="number"
                    value={newJobInterval}
                    onChange={(e) => setNewJobInterval(e.target.value)}
                    min="1"
                    className="h-9 w-20 rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <span className="text-xs text-zinc-400">minutes</span>
                </div>
              )}
              {newJobScheduleKind === "cron" && (
                <div>
                  <input
                    type="text"
                    value={newJobCronExpr}
                    onChange={(e) => setNewJobCronExpr(e.target.value)}
                    placeholder="0 */6 * * *"
                    className="h-9 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <p className="text-[10px] text-zinc-500 mt-1">Standard cron syntax: minute hour day month weekday</p>
                </div>
              )}
              {newJobScheduleKind === "at" && (
                <input
                  type="datetime-local"
                  value={newJobAtTime}
                  onChange={(e) => setNewJobAtTime(e.target.value)}
                  className="h-9 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                />
              )}
            </div>

            <Separator />

            <div>
              <label className="text-xs font-medium text-zinc-400 mb-1.5 block">
                {newJobPayloadKind === "agentTurn" ? "Agent Prompt" : "System Event Text"}
              </label>
              <textarea
                value={newJobMessage}
                onChange={(e) => setNewJobMessage(e.target.value)}
                placeholder={newJobPayloadKind === "agentTurn"
                  ? "Check crypto prices and post a market update..."
                  : "Reminder: check emails and respond to pending messages"
                }
                rows={3}
                className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => { setShowCreateForm(false); resetForm() }}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleCreateJob} disabled={!newJobMessage.trim() || !isConnected}>
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Create Job
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Job List */}
      <div className="space-y-3">
        {jobs.length === 0 && !isLoading && isConnected && (
          <Card>
            <CardContent className="p-8 text-center">
              <Clock className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <h3 className="text-sm font-medium mb-1">No cron jobs</h3>
              <p className="text-xs text-muted-foreground">
                Create your first scheduled task to automate recurring actions
              </p>
            </CardContent>
          </Card>
        )}

        {jobs.map((job) => (
          <Card key={job.id} className={`overflow-hidden ${!job.enabled ? "opacity-60" : ""}`}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${
                    job.schedule.kind === "every" ? "bg-blue-500/15" :
                    job.schedule.kind === "cron" ? "bg-purple-500/15" : "bg-amber-500/15"
                  }`}>
                    {job.schedule.kind === "every" ? <Timer className="h-4 w-4 text-blue-400" /> :
                     job.schedule.kind === "cron" ? <Calendar className="h-4 w-4 text-purple-400" /> :
                     <Zap className="h-4 w-4 text-amber-400" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-medium truncate">{job.name || job.id.slice(0, 8)}</span>
                      <Badge variant={job.enabled ? "success" : "secondary"} className="text-[9px] px-1.5 py-0">
                        {job.enabled ? "Active" : "Disabled"}
                      </Badge>
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0 font-mono">
                        {job.sessionTarget}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                      <span className="font-mono">{formatSchedule(job.schedule)}</span>
                      <span>•</span>
                      <span>{job.payload.kind}</span>
                      {job.runCount !== undefined && (
                        <>
                          <span>•</span>
                          <span>{job.runCount} runs</span>
                        </>
                      )}
                      {job.lastRun && (
                        <>
                          <span>•</span>
                          <span>Last: {formatTimeAgo(job.lastRun)}</span>
                        </>
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-500 mt-1 truncate max-w-[500px]">
                      {job.payload.message || job.payload.text || "—"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0 ml-4">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => handleRunJob(job.id)}
                    disabled={runningJobs.has(job.id)}
                    title="Run now"
                  >
                    {runningJobs.has(job.id) ? (
                      <RotateCw className="h-3.5 w-3.5 animate-spin text-primary" />
                    ) : (
                      <Play className="h-3.5 w-3.5" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDeleteJob(job.id)}
                    title="Delete job"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Help Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">How Cron Jobs Work</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs text-muted-foreground">
          <p><strong className="text-foreground">Isolated (agentTurn):</strong> Runs an agent in a background session. Perfect for automated tasks like market checks, content creation, or research.</p>
          <p><strong className="text-foreground">Main (systemEvent):</strong> Injects a text event into your main chat session. Great for reminders and alerts.</p>
          <p><strong className="text-foreground">Schedule types:</strong> Interval (every N minutes), Cron expression (precise scheduling), or One-shot (run once at a specific time).</p>
          <p className="text-[10px] text-zinc-600 mt-3">Tip: Use cron expressions for precise timing. Example: <code className="bg-zinc-800 px-1 rounded">0 9 * * 1</code> = Every Monday at 9 AM</p>
        </CardContent>
      </Card>
    </div>
  )
}
