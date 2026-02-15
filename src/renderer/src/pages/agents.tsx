import { useState, useEffect, useCallback } from "react"
import type { GatewayClient } from "@/lib/gateway-client"
import {
  Bot,
  Plus,
  MoreHorizontal,
  Settings,
  Brain,
  MessageSquare,
  Clock,
  RefreshCw,
  Loader2,
  Hash,
  Trash2,
  Shield,
  X,
  Container,
  Info,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"

interface AgentsPageProps {
  client: GatewayClient
  isConnected: boolean
}

interface Agent {
  id: string
  name: string
  emoji?: string
  sessions: number
  totalTokens: number
  model?: string
  lastActive?: string
}

export function AgentsPage({ client, isConnected }: AgentsPageProps) {
  const [agents, setAgents] = useState<Agent[]>([])
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [defaultId, setDefaultId] = useState("")
  const [sessions, setSessions] = useState<Array<Record<string, unknown>>>([])
  const [showCreate, setShowCreate] = useState(false)
  const [models, setModels] = useState<string[]>([])

  const loadData = useCallback(async () => {
    if (!isConnected) return
    setIsLoading(true)
    try {
      const [agentsResult, sessionsResult, modelsResult] = await Promise.all([
        client.agentsList() as Promise<{
          defaultId?: string
          agents?: Array<{ id: string; name?: string; identity?: { name?: string; emoji?: string } }>
        }>,
        client.sessionsList() as Promise<{
          sessions?: Array<Record<string, unknown>>
          defaults?: { model?: string }
        }>,
        client.modelsList() as Promise<{
          models?: Array<{ id: string; name: string; provider: string }>
        }>,
      ])

      setDefaultId(agentsResult?.defaultId || "default")
      const sessionList = sessionsResult?.sessions || []
      setSessions(sessionList)
      const defaultModel = sessionsResult?.defaults?.model || ""

      if (modelsResult?.models) {
        setModels(modelsResult.models.map((m) => m.id || m.name))
      }

      const agentRows = agentsResult?.agents || []
      const mapped: Agent[] = agentRows.map((a) => {
        const agentSessions = sessionList.filter((s) => {
          const key = s.key as string || ""
          return key.startsWith(`agent:${a.id}:`)
        })
        const totalTokens = agentSessions.reduce((sum, s) => sum + ((s.totalTokens as number) || 0), 0)
        const lastSession = agentSessions.sort((x, y) =>
          new Date(y.updatedAt as string).getTime() - new Date(x.updatedAt as string).getTime()
        )[0]

        return {
          id: a.id,
          name: a.identity?.name || a.name || a.id,
          emoji: a.identity?.emoji,
          sessions: agentSessions.length,
          totalTokens,
          model: (lastSession?.model as string) || defaultModel,
          lastActive: lastSession?.updatedAt ? timeAgo(lastSession.updatedAt as string) : undefined,
        }
      })

      if (mapped.length === 0) {
        mapped.push({
          id: "default",
          name: "Main Assistant",
          sessions: sessionList.length,
          totalTokens: sessionList.reduce((sum, s) => sum + ((s.totalTokens as number) || 0), 0),
          model: defaultModel,
          lastActive: sessionList[0]?.updatedAt ? timeAgo(sessionList[0].updatedAt as string) : undefined,
        })
      }

      setAgents(mapped)
    } catch {
    } finally {
      setIsLoading(false)
    }
  }, [isConnected, client])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleDelete = useCallback(async (agentId: string) => {
    if (!isConnected || agentId === defaultId) return
    try {
      await client.agentsDelete(agentId)
      setSelectedAgent(null)
      loadData()
    } catch {}
  }, [isConnected, client, defaultId, loadData])

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Agents</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your AI agents and their configurations
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadData} disabled={isLoading || !isConnected}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </Button>
          <Button size="sm" onClick={() => setShowCreate(true)} disabled={!isConnected}>
            <Plus className="h-4 w-4" />
            New Agent
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Total Agents" value={String(agents.length)} />
        <StatCard label="Active Sessions" value={String(sessions.length)} />
        <StatCard label="Total Tokens" value={formatTokens(agents.reduce((s, a) => s + a.totalTokens, 0))} />
      </div>

      {agents.length === 0 && !isLoading ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Bot className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm font-medium text-muted-foreground">
              {isConnected ? "No agents configured" : "Start the Gateway to see agents"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex gap-6">
          <div className="flex-1 space-y-3">
            {agents.map((agent) => (
              <Card
                key={agent.id}
                className={`cursor-pointer transition-colors hover:bg-accent/30 ${
                  selectedAgent?.id === agent.id ? "ring-1 ring-primary" : ""
                }`}
                onClick={() => setSelectedAgent(agent)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center shrink-0 mt-0.5">
                        {agent.emoji ? (
                          <span className="text-lg">{agent.emoji}</span>
                        ) : (
                          <Bot className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{agent.name}</span>
                          {agent.id === defaultId && (
                            <Badge variant="outline" className="text-[10px]">Default</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">ID: {agent.id}</p>
                        <div className="flex items-center gap-3 mt-2">
                          {agent.model && (
                            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                              <Brain className="h-3 w-3" />
                              {agent.model}
                            </span>
                          )}
                          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                            <Hash className="h-3 w-3" />
                            {agent.sessions} sessions
                          </span>
                          {agent.lastActive && (
                            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {agent.lastActive}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {selectedAgent && (
            <div className="w-[320px] shrink-0">
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{selectedAgent.name}</CardTitle>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setSelectedAgent(null)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <CardDescription>Agent ID: {selectedAgent.id}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <DetailRow label="Model" value={selectedAgent.model || "--"} />
                  <DetailRow label="Sessions" value={String(selectedAgent.sessions)} />
                  <DetailRow label="Total Tokens" value={formatTokens(selectedAgent.totalTokens)} />
                  <DetailRow label="Last Active" value={selectedAgent.lastActive || "--"} />
                  <Separator />
                  <DetailRow label="Workspace" value={`~/.openclaw/workspace-${selectedAgent.id}`} />
                  <DetailRow label="Sandbox" value="Configurable" />
                  <Separator />
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1">
                      <MessageSquare className="h-3.5 w-3.5" />
                      Chat
                    </Button>
                    {selectedAgent.id !== defaultId && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDelete(selectedAgent.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}

      {showCreate && (
        <CreateAgentDialog
          client={client}
          models={models}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false)
            loadData()
          }}
        />
      )}
    </div>
  )
}

const CHANNEL_BINDINGS = [
  { id: "whatsapp", name: "WhatsApp", icon: "https://cdn.simpleicons.org/whatsapp/25D366" },
  { id: "telegram", name: "Telegram", icon: "https://cdn.simpleicons.org/telegram/26A5E4" },
  { id: "slack", name: "Slack", icon: "https://cdn.simpleicons.org/slack" },
  { id: "discord", name: "Discord", icon: "https://cdn.simpleicons.org/discord/5865F2" },
  { id: "signal", name: "Signal", icon: "https://cdn.simpleicons.org/signal/3A76F0" },
  { id: "gmail", name: "Gmail", icon: "https://cdn.simpleicons.org/gmail/EA4335" },
  { id: "googlechat", name: "Google Chat", icon: "https://cdn.simpleicons.org/googlechat/00AC47" },
  { id: "msteams", name: "Teams", icon: "https://cdn.simpleicons.org/microsoftteams" },
  { id: "webchat", name: "WebChat", icon: "https://cdn.simpleicons.org/googlechat/00AC47" },
]

function CreateAgentDialog({
  client,
  models,
  onClose,
  onCreated,
}: {
  client: GatewayClient
  models: string[]
  onClose: () => void
  onCreated: () => void
}) {
  const [name, setName] = useState("")
  const [model, setModel] = useState("")
  const [sandboxMode, setSandboxMode] = useState<"off" | "non-main" | "all">("off")
  const [allowControl, setAllowControl] = useState(true)
  const [selectedChannels, setSelectedChannels] = useState<Set<string>>(new Set())
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const agentId = name.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "")

  const toggleChannel = (id: string) => {
    setSelectedChannels((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleCreate = async () => {
    if (!name.trim()) {
      setError("Name is required")
      return
    }
    if (!agentId) {
      setError("Invalid name — must contain at least one letter or number")
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      await client.agentsCreate({ name: name.trim() })

      const patch: Record<string, unknown> = {}

      const agentConfig: Record<string, unknown> = { id: agentId }
      if (model) agentConfig.model = model
      if (sandboxMode !== "off") {
        agentConfig.sandbox = { mode: sandboxMode, scope: "agent" }
      }

      if (Object.keys(agentConfig).length > 1) {
        patch.agents = { list: [agentConfig] }
      }

      const bindings = Array.from(selectedChannels).map((channel) => ({
        agentId,
        match: { channel },
      }))
      if (bindings.length > 0) {
        patch.bindings = bindings
      }

      if (allowControl) {
        if (!patch.agents) patch.agents = {}
        const agents = patch.agents as Record<string, unknown>
        if (!agents.defaults) agents.defaults = {}
        const defaults = agents.defaults as Record<string, unknown>
        defaults.subagents = { allowAgents: ["*"] }
      }

      if (Object.keys(patch).length > 0) {
        await client.configPatch(patch)
      }

      onCreated()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create agent")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-[540px] max-h-[85vh] rounded-xl border bg-card shadow-2xl flex flex-col">
        <div className="flex items-center justify-between p-4 border-b shrink-0">
          <h2 className="text-base font-semibold">New Agent</h2>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-4 space-y-5 overflow-y-auto flex-1">
          <div>
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-3">Identity</p>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Support Agent"
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  autoFocus
                />
                {agentId && (
                  <p className="text-[11px] text-muted-foreground mt-1">
                    ID: <span className="font-mono">{agentId}</span> — Workspace: <span className="font-mono">~/.openclaw/workspace-{agentId}</span>
                  </p>
                )}
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Model</label>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">Default (inherit from gateway)</option>
                  {models.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <Separator />

          <div>
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-3">Isolation</p>
            <div className="grid grid-cols-3 gap-2">
              {([
                {
                  value: "off",
                  label: "Off",
                  desc: "Full host access",
                  tooltip: "The agent runs directly on your machine with full access to the filesystem, terminal, browser, and all system resources. Best for your personal/main agent that you trust completely.",
                },
                {
                  value: "non-main",
                  label: "Non-main",
                  desc: "External sessions sandboxed",
                  tooltip: "Only sessions from external channels (Telegram, WhatsApp, Discord, etc.) run inside a Docker container. Direct chat sessions run on the host. Best for agents that interact with external users but you still want to control directly.",
                },
                {
                  value: "all",
                  label: "Full",
                  desc: "All sessions in Docker",
                  tooltip: "Every session runs inside an isolated Docker container with restricted filesystem access. The agent never touches the host directly. Best for untrusted workloads, data processing from third parties, or multi-tenant scenarios.",
                },
              ] as const).map((opt) => (
                <IsolationCard
                  key={opt.value}
                  selected={sandboxMode === opt.value}
                  onClick={() => setSandboxMode(opt.value)}
                  label={opt.label}
                  desc={opt.desc}
                  tooltip={opt.tooltip}
                  isOff={opt.value === "off"}
                />
              ))}
            </div>
          </div>

          <Separator />

          <div>
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-3">Control</p>
            <button
              onClick={() => setAllowControl(!allowControl)}
              className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors ${
                allowControl ? "border-primary bg-primary/5" : "hover:bg-accent/50"
              }`}
            >
              <div className="text-left">
                <p className="text-sm font-medium">Allow main agent to control</p>
                <p className="text-[11px] text-muted-foreground">
                  The main agent can delegate tasks to this agent via sessions_spawn
                </p>
              </div>
              <div className={`h-5 w-9 rounded-full transition-colors ${allowControl ? "bg-primary" : "bg-secondary"}`}>
                <div className={`h-3.5 w-3.5 rounded-full bg-white mt-[3px] transition-transform ${allowControl ? "translate-x-[18px]" : "translate-x-[3px]"}`} />
              </div>
            </button>
          </div>

          <Separator />

          <div>
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-3">
              Channel Routing {selectedChannels.size > 0 && `(${selectedChannels.size})`}
            </p>
            <p className="text-xs text-muted-foreground mb-3">
              Select which channels this agent will respond to. Incoming messages from these channels will be routed to this agent.
            </p>
            <div className="grid grid-cols-3 gap-2">
              {CHANNEL_BINDINGS.map((ch) => (
                <button
                  key={ch.id}
                  onClick={() => toggleChannel(ch.id)}
                  className={`flex flex-col items-center gap-2 p-3 rounded-lg border transition-colors ${
                    selectedChannels.has(ch.id) ? "border-primary bg-primary/5" : "hover:bg-accent/50"
                  }`}
                >
                  <img src={ch.icon} alt={ch.name} className="h-7 w-7 object-contain" loading="lazy" />
                  <span className="text-[11px] font-medium">{ch.name}</span>
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <p className="text-xs text-red-400">{error}</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 p-4 border-t shrink-0">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={handleCreate} disabled={isSaving || !name.trim()}>
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" />
                Create Agent
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

function IsolationCard({
  selected,
  onClick,
  label,
  desc,
  tooltip,
  isOff,
}: {
  selected: boolean
  onClick: () => void
  label: string
  desc: string
  tooltip: string
  isOff: boolean
}) {
  const [showTooltip, setShowTooltip] = useState(false)

  return (
    <button
      onClick={onClick}
      className={`p-3 rounded-lg border text-left transition-colors relative ${
        selected ? "border-primary bg-primary/5" : "hover:bg-accent/50"
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          {isOff ? (
            <Bot className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <Shield className="h-3.5 w-3.5 text-muted-foreground" />
          )}
          <span className="text-xs font-medium">{label}</span>
        </div>
        <div
          className="relative"
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
        >
          <Info className="h-3.5 w-3.5 text-muted-foreground/50 hover:text-muted-foreground cursor-help" />
          {showTooltip && (
            <div className="fixed w-[280px] p-3 rounded-lg border bg-popover text-popover-foreground shadow-xl z-[100]" style={{ transform: "translate(-240px, -100%)", marginTop: "-8px" }}>
              <p className="text-[11px] leading-relaxed">{tooltip}</p>
            </div>
          )}
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground">{desc}</p>
    </button>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-mono truncate max-w-[180px]">{value}</span>
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

function timeAgo(ts: string | number): string {
  const diff = Date.now() - new Date(ts).getTime()
  if (diff < 60000) return "Just now"
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}
