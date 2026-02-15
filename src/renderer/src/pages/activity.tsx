import { useState, useEffect, useCallback, useRef } from "react"
import type { GatewayClient } from "@/lib/gateway-client"
import { useGatewayEvent } from "@/lib/use-gateway"
import {
  Activity,
  MessageSquare,
  Bot,
  Shield,
  Settings,
  Clock,
  Filter,
  Download,
  Trash2,
  RefreshCw,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"

interface ActivityPageProps {
  client: GatewayClient
  isConnected: boolean
}

interface ActivityEvent {
  id: string
  type: "message" | "agent" | "security" | "system" | "channel"
  action: string
  description: string
  timestamp: string
  metadata?: Record<string, string>
}

const typeConfig = {
  message: { icon: MessageSquare, color: "text-blue-400", bg: "bg-blue-500/10" },
  agent: { icon: Bot, color: "text-purple-400", bg: "bg-purple-500/10" },
  security: { icon: Shield, color: "text-amber-400", bg: "bg-amber-500/10" },
  system: { icon: Settings, color: "text-zinc-400", bg: "bg-zinc-500/10" },
  channel: { icon: Activity, color: "text-emerald-400", bg: "bg-emerald-500/10" },
}

export function ActivityPage({ client, isConnected }: ActivityPageProps) {
  const [events, setEvents] = useState<ActivityEvent[]>([])
  const [costToday, setCostToday] = useState<string>("--")
  const [tokensToday, setTokensToday] = useState<string>("--")
  const eventIdCounter = useRef(0)

  const addEvent = useCallback((event: Omit<ActivityEvent, "id" | "timestamp">) => {
    eventIdCounter.current++
    setEvents((prev) => [
      {
        ...event,
        id: `evt-${eventIdCounter.current}`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      },
      ...prev,
    ].slice(0, 200))
  }, [])

  useGatewayEvent("agent", (payload) => {
    const { stream, data, sessionKey } = payload as {
      stream?: string
      data?: { phase?: string; text?: string }
      sessionKey?: string
    }
    if (stream === "lifecycle" && data?.phase === "start") {
      addEvent({
        type: "agent",
        action: "Agent run started",
        description: `Session: ${sessionKey || "unknown"}`,
        metadata: { session: sessionKey || "" },
      })
    }
    if (stream === "lifecycle" && data?.phase === "end") {
      addEvent({
        type: "agent",
        action: "Agent run completed",
        description: `Session: ${sessionKey || "unknown"}`,
      })
    }
  })

  useGatewayEvent("chat", (payload) => {
    const { state, sessionKey } = payload as { state?: string; sessionKey?: string }
    if (state === "final") {
      addEvent({
        type: "message",
        action: "Chat reply sent",
        description: `Session: ${sessionKey || "default"}`,
      })
    }
  })

  useGatewayEvent("health", (payload) => {
    const { ok, durationMs } = payload as { ok?: boolean; durationMs?: number }
    addEvent({
      type: "system",
      action: "Health check",
      description: ok ? `Healthy (${durationMs || 0}ms)` : "Unhealthy",
      metadata: { status: ok ? "ok" : "error", duration: `${durationMs || 0}ms` },
    })
  })

  const loadCosts = useCallback(async () => {
    if (!isConnected) return
    try {
      const result = await client.usageCost() as {
        totals?: { totalCost?: number; totalTokens?: number }
      }
      if (result?.totals) {
        setCostToday(result.totals.totalCost != null ? `$${result.totals.totalCost.toFixed(2)}` : "--")
        setTokensToday(result.totals.totalTokens != null ? formatTokens(result.totals.totalTokens) : "--")
      }
    } catch {}
  }, [isConnected, client])

  useEffect(() => {
    loadCosts()
    const interval = setInterval(loadCosts, 30000)
    return () => clearInterval(interval)
  }, [loadCosts])

  useEffect(() => {
    if (isConnected) {
      addEvent({
        type: "system",
        action: "Gateway connected",
        description: "WebSocket connection established",
      })
    }
  }, [isConnected, addEvent])

  const messageCount = events.filter((e) => e.type === "message").length
  const agentCount = events.filter((e) => e.type === "agent").length

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Activity</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time activity log and usage metrics
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setEvents([])}>
            <Trash2 className="h-4 w-4" />
            Clear
          </Button>
          <Button variant="outline" size="sm" onClick={loadCosts} disabled={!isConnected}>
            <RefreshCw className="h-4 w-4" />
            Refresh Costs
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Live Events" value={String(events.length)} />
        <StatCard label="Chat Replies" value={String(messageCount)} />
        <StatCard label="Agent Runs" value={String(agentCount)} />
        <StatCard label="Est. Cost" value={costToday} />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Event Timeline</CardTitle>
              <CardDescription>Real-time events from the Gateway</CardDescription>
            </div>
            {!isConnected && (
              <Badge variant="secondary">Offline — no live events</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Activity className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-sm font-medium text-muted-foreground">No events yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                {isConnected ? "Events will appear here in real-time as the system runs" : "Start the Gateway to see live events"}
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[500px] pr-3">
              <div className="space-y-1">
                {events.map((event) => (
                  <EventRow key={event.id} event={event} />
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function EventRow({ event }: { event: ActivityEvent }) {
  const config = typeConfig[event.type]
  const Icon = config.icon

  return (
    <div className="flex items-start gap-3 p-3 rounded-md hover:bg-accent/30 transition-colors">
      <div className={`h-8 w-8 rounded-lg ${config.bg} flex items-center justify-center shrink-0 mt-0.5`}>
        <Icon className={`h-4 w-4 ${config.color}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{event.action}</span>
          <Badge variant="outline" className="text-[10px] capitalize">{event.type}</Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{event.description}</p>
        {event.metadata && (
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
            {Object.entries(event.metadata).map(([key, value]) => (
              <span key={key} className="text-[10px] text-muted-foreground">
                <span className="text-muted-foreground/60">{key}:</span> {value}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <Clock className="h-3 w-3 text-muted-foreground" />
        <span className="text-[11px] text-muted-foreground whitespace-nowrap">{event.timestamp}</span>
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-semibold mt-1">{value}</p>
      </CardContent>
    </Card>
  )
}

function formatTokens(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
  return String(n)
}
