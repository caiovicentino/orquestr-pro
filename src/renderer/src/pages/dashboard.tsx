import { useState, useEffect } from "react"
import {
  Bot,
  MessageSquare,
  Activity,
  Shield,
  Zap,
  Terminal,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"

interface DashboardProps {
  gatewayStatus: "stopped" | "starting" | "running" | "error"
  onStartGateway: () => void
  onStopGateway: () => void
  connectionState: "disconnected" | "connecting" | "handshaking" | "connected" | "error"
  isConnected: boolean
}

export function DashboardPage({ gatewayStatus, onStartGateway, onStopGateway, connectionState, isConnected }: DashboardProps) {
  const [gatewayError, setGatewayError] = useState<string | null>(null)
  const [gatewayLogs, setGatewayLogs] = useState<string[]>([])
  const [gatewayPort, setGatewayPort] = useState<number | null>(null)

  const isElectron = typeof window !== "undefined" && !!window.api

  useEffect(() => {
    if (!isElectron) return
    const fetchPort = async () => {
      try {
        const port = await window.api.gateway.port()
        setGatewayPort(port)
      } catch {}
    }
    fetchPort()
    const interval = setInterval(fetchPort, 5000)
    return () => clearInterval(interval)
  }, [isElectron])

  useEffect(() => {
    console.log("[Dashboard] isElectron:", isElectron, "window.api:", typeof window !== "undefined" ? !!window.api : "no window")
  }, [isElectron])

  useEffect(() => {
    if (!isElectron) return
    const interval = setInterval(async () => {
      try {
        const status = await window.api.gateway.status()
        setGatewayError(status.error)
        setGatewayLogs(status.logs || [])
      } catch {
        // ignore
      }
    }, 2000)
    return () => clearInterval(interval)
  }, [isElectron])
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Overview of your Orquestr Pro workspace
          </p>
        </div>
        {gatewayStatus === "running" ? (
          <Button variant="outline" size="sm" onClick={onStopGateway}>
            Stop Gateway
          </Button>
        ) : (
          <Button size="sm" onClick={onStartGateway} disabled={gatewayStatus === "starting"}>
            <Zap className="h-4 w-4" />
            {gatewayStatus === "starting" ? "Starting..." : "Start Gateway"}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatCard
          title="Active Agents"
          value="0"
          description="No agents configured"
          icon={Bot}
        />
        <StatCard
          title="Channels"
          value="0"
          description="No channels connected"
          icon={MessageSquare}
        />
        <StatCard
          title="Messages Today"
          value="0"
          description="No activity yet"
          icon={Activity}
        />
        <StatCard
          title="Security Score"
          value="--"
          description="Run audit to check"
          icon={Shield}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quick Setup</CardTitle>
            <CardDescription>Get started with Orquestr Pro</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <SetupStep
                number={1}
                title="Start the Gateway"
                description="Launch the local AI gateway"
                isDone={gatewayStatus === "running"}
              />
              <SetupStep
                number={2}
                title="Configure a Model"
                description="Connect Anthropic, OpenAI, or other providers"
                isDone={false}
              />
              <SetupStep
                number={3}
                title="Connect a Channel"
                description="Link WhatsApp, Slack, Telegram, or other channels"
                isDone={false}
              />
              <SetupStep
                number={4}
                title="Create an Agent"
                description="Set up your first AI agent with custom tools"
                isDone={false}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Gateway Status</CardTitle>
            <CardDescription>Real-time system information</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <StatusRow label="Gateway">
                <GatewayStatusBadge status={gatewayStatus} />
              </StatusRow>
              <StatusRow label="WebSocket">
                <Badge variant={isConnected ? "success" : "secondary"}>
                  {connectionState}
                </Badge>
              </StatusRow>
              <StatusRow label="Port">
                <span className="text-sm font-mono">{gatewayPort || "—"}</span>
              </StatusRow>
              {gatewayError && (
                <div className="p-2 rounded-md bg-destructive/10 border border-destructive/20">
                  <p className="text-xs text-red-400 font-mono">{gatewayError}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {gatewayLogs.length > 0 && (
          <Card className="col-span-2">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Terminal className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base">Gateway Logs</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[200px]">
                <div className="space-y-0.5 font-mono text-[11px]">
                  {gatewayLogs.map((log, i) => (
                    <p key={i} className="text-muted-foreground leading-relaxed">{log}</p>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

function StatCard({
  title,
  value,
  description,
  icon: Icon,
}: {
  title: string
  value: string
  description: string
  icon: typeof Bot
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-muted-foreground">{title}</span>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="text-2xl font-semibold">{value}</div>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </CardContent>
    </Card>
  )
}

function SetupStep({
  number,
  title,
  description,
  isDone,
}: {
  number: number
  title: string
  description: string
  isDone: boolean
}) {
  return (
    <div className="flex items-start gap-3">
      <div
        className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 text-xs font-medium ${
          isDone
            ? "bg-emerald-500/15 text-emerald-400"
            : "bg-secondary text-muted-foreground"
        }`}
      >
        {isDone ? "✓" : number}
      </div>
      <div className="min-w-0">
        <p className={`text-sm font-medium ${isDone ? "text-muted-foreground line-through" : ""}`}>
          {title}
        </p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}

function StatusRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      {children}
    </div>
  )
}

function GatewayStatusBadge({ status }: { status: string }) {
  const config = {
    stopped: { label: "Offline", variant: "secondary" as const },
    starting: { label: "Starting", variant: "warning" as const },
    running: { label: "Online", variant: "success" as const },
    error: { label: "Error", variant: "destructive" as const },
  }
  const { label, variant } = config[status as keyof typeof config] || config.stopped
  return <Badge variant={variant}>{label}</Badge>
}
