import { useState, useEffect, useCallback } from "react"
import type { GatewayClient } from "@/lib/gateway-client"
import {
  MessageSquare,
  Plus,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Clock,
  Loader2,
  X,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"

interface ChannelsPageProps {
  client: GatewayClient
  isConnected: boolean
}

interface Channel {
  id: string
  name: string
  type: string
  status: "connected" | "disconnected" | "error"
  accountId: string
  lastMessage: string
  dmPolicy: string
  running: boolean
  configured: boolean
}

const channelIcons: Record<string, string> = {
  whatsapp: "WA",
  telegram: "TG",
  slack: "SL",
  discord: "DC",
  webchat: "WC",
  teams: "MS",
  msteams: "MS",
  signal: "SG",
  imessage: "iM",
  bluebubbles: "iM",
  googlechat: "GC",
  gmail: "GM",
}

interface ChannelOption {
  id: string
  name: string
  description: string
  icon: string
  fields: Array<{ key: string; label: string; placeholder: string; type?: string; required?: boolean }>
}

const channelOptions: ChannelOption[] = [
  {
    id: "whatsapp",
    name: "WhatsApp",
    icon: "https://cdn.simpleicons.org/whatsapp/25D366",
    description: "Connect via QR code pairing. No credentials needed — login happens via the agent.",
    fields: [],
  },
  {
    id: "telegram",
    name: "Telegram",
    icon: "https://cdn.simpleicons.org/telegram/26A5E4",
    description: "Connect a Telegram bot. Create one via @BotFather and paste the token.",
    fields: [
      { key: "botToken", label: "Bot Token", placeholder: "123456:ABCDEF...", required: true },
    ],
  },
  {
    id: "slack",
    name: "Slack",
    icon: "https://cdn.simpleicons.org/slack",
    description: "Connect a Slack app with Socket Mode enabled.",
    fields: [
      { key: "botToken", label: "Bot Token", placeholder: "xoxb-...", required: true },
      { key: "appToken", label: "App Token", placeholder: "xapp-...", required: true },
    ],
  },
  {
    id: "discord",
    name: "Discord",
    icon: "https://cdn.simpleicons.org/discord/5865F2",
    description: "Connect a Discord bot. Create one in the Discord Developer Portal.",
    fields: [
      { key: "token", label: "Bot Token", placeholder: "Discord bot token...", required: true },
    ],
  },
  {
    id: "signal",
    name: "Signal",
    icon: "https://cdn.simpleicons.org/signal/3A76F0",
    description: "Connect via signal-cli. Requires signal-cli installed on the system.",
    fields: [
      { key: "cliPath", label: "signal-cli Path", placeholder: "/usr/local/bin/signal-cli" },
    ],
  },
  {
    id: "webchat",
    name: "WebChat",
    icon: "https://cdn.simpleicons.org/googlechat/00AC47",
    description: "Built-in web chat — always available via the Gateway. No configuration needed.",
    fields: [],
  },
  {
    id: "gmail",
    name: "Gmail",
    icon: "https://cdn.simpleicons.org/gmail/EA4335",
    description: "Receive emails as agent triggers via Gmail Pub/Sub.",
    fields: [
      { key: "email", label: "Gmail Address", placeholder: "you@gmail.com", required: true },
      { key: "credentialsPath", label: "Service Account JSON Path", placeholder: "~/.openclaw/gmail-credentials.json", required: true },
      { key: "topicName", label: "Pub/Sub Topic", placeholder: "projects/my-project/topics/openclaw-gmail" },
      { key: "subscriptionName", label: "Pub/Sub Subscription", placeholder: "projects/my-project/subscriptions/openclaw-gmail-sub" },
    ],
  },
  {
    id: "googlechat",
    name: "Google Chat",
    icon: "https://cdn.simpleicons.org/googlechat/00AC47",
    description: "Connect a Google Chat bot via the Chat API.",
    fields: [
      { key: "credentialsPath", label: "Service Account JSON Path", placeholder: "~/.openclaw/google-chat-credentials.json", required: true },
    ],
  },
  {
    id: "msteams",
    name: "Microsoft Teams",
    icon: "https://cdn.simpleicons.org/microsoftteams",
    description: "Connect via Bot Framework. Requires an Azure Bot registration.",
    fields: [
      { key: "appId", label: "App ID", placeholder: "Azure Bot App ID...", required: true },
      { key: "appPassword", label: "App Password", placeholder: "Azure Bot App Password...", required: true, type: "password" },
    ],
  },
]

function timeAgo(ts: string | number | null | undefined): string {
  if (!ts) return "Never"
  const diff = Date.now() - new Date(ts).getTime()
  if (diff < 0) return "Just now"
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "Just now"
  if (mins < 60) return `${mins} min ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export function ChannelsPage({ client, isConnected }: ChannelsPageProps) {
  const [channels, setChannels] = useState<Channel[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showAddDialog, setShowAddDialog] = useState(false)

  const loadChannels = useCallback(async () => {
    if (!isConnected) return
    setIsLoading(true)
    try {
      const result = await client.channelsStatus() as {
        channelLabels?: Record<string, string>
        channels?: Record<string, { configured?: boolean }>
        channelAccounts?: Record<string, Array<Record<string, unknown>>>
      }
      if (!result) return

      const labels = result.channelLabels || {}
      const mapped: Channel[] = []
      const accounts = result.channelAccounts || {}

      for (const [channelType, accountList] of Object.entries(accounts)) {
        if (!Array.isArray(accountList)) continue
        for (const account of accountList) {
          const connected = !!(account.connected || account.running)
          const hasError = !!account.lastError && !connected
          const accountId = account.accountId as string || "default"

          mapped.push({
            id: `${channelType}-${accountId}`,
            name: `${labels[channelType] || channelType}${accountId !== "default" ? ` (${accountId})` : ""}`,
            type: channelType,
            status: connected ? "connected" : hasError ? "error" : "disconnected",
            accountId: (account.audience as string) || (account.bot as Record<string, unknown>)?.username as string || accountId,
            lastMessage: timeAgo(account.lastInboundAt as string || account.lastMessageAt as string),
            dmPolicy: (account.dmPolicy as string) || "pairing",
            running: !!account.running,
            configured: !!account.configured,
          })
        }
      }

      const configuredChannels = result.channels || {}
      for (const [channelType, info] of Object.entries(configuredChannels)) {
        if (info?.configured && !mapped.find((m) => m.type === channelType)) {
          mapped.push({
            id: channelType,
            name: labels[channelType] || channelType,
            type: channelType,
            status: "disconnected",
            accountId: "default",
            lastMessage: "Never",
            dmPolicy: "pairing",
            running: false,
            configured: true,
          })
        }
      }

      setChannels(mapped)
    } catch {
    } finally {
      setIsLoading(false)
    }
  }, [isConnected, client])

  useEffect(() => {
    loadChannels()
  }, [loadChannels])

  const connectedCount = channels.filter((c) => c.status === "connected").length

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Channels</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Connect and manage messaging channels
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadChannels} disabled={isLoading || !isConnected}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </Button>
          <Button size="sm" onClick={() => setShowAddDialog(true)} disabled={!isConnected}>
            <Plus className="h-4 w-4" />
            Add Channel
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Total Channels" value={String(channels.length)} />
        <StatCard label="Connected" value={String(connectedCount)} />
        <StatCard label="Configured" value={String(channels.filter((c) => c.configured).length)} />
      </div>

      {channels.length === 0 && !isLoading ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <MessageSquare className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm font-medium text-muted-foreground">
              {isConnected ? "No channels configured" : "Start the Gateway to see channels"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {channels.map((channel) => (
            <ChannelCard key={channel.id} channel={channel} />
          ))}
        </div>
      )}

      {showAddDialog && (
        <AddChannelDialog
          client={client}
          onClose={() => setShowAddDialog(false)}
        />
      )}
    </div>
  )
}

function AddChannelDialog({
  client,
  onClose,
}: {
  client: GatewayClient
  onClose: () => void
}) {
  const [isSending, setIsSending] = useState(false)

  const handleSelect = async (channel: ChannelOption) => {
    setIsSending(true)
    try {
      await client.chatSend("default",
        `I want to set up ${channel.name} as a new channel. Guide me through the complete setup process step by step. Ask me for any credentials or tokens needed and configure everything.`,
        { thinking: "high" }
      )
    } catch {}
    setIsSending(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-[560px] max-h-[80vh] rounded-xl border bg-card shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-base font-semibold">Add Channel</h2>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-4">
          <p className="text-sm text-muted-foreground mb-4">
            Select a channel and the AI agent will guide you through the setup process via Chat.
          </p>
          <div className="grid grid-cols-3 gap-3">
            {channelOptions.map((ch) => (
              <button
                key={ch.id}
                onClick={() => handleSelect(ch)}
                disabled={isSending}
                className="flex flex-col items-center gap-2.5 p-4 rounded-lg border hover:bg-accent/50 hover:border-primary/50 transition-colors disabled:opacity-50"
              >
                <img
                  src={ch.icon}
                  alt={ch.name}
                  className="h-9 w-9 object-contain"
                  loading="lazy"
                />
                <span className="text-xs font-medium">{ch.name}</span>
              </button>
            ))}
          </div>
          {isSending && (
            <div className="flex items-center justify-center gap-2 mt-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Sending to agent...
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ChannelCard({ channel }: { channel: Channel }) {
  const statusConfig = {
    connected: { label: "Connected", badge: "success" as const },
    disconnected: { label: "Disconnected", badge: "secondary" as const },
    error: { label: "Error", badge: "destructive" as const },
  }

  const config = statusConfig[channel.status]
  const abbr = channelIcons[channel.type] || channel.type.slice(0, 2).toUpperCase()

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center shrink-0">
              <span className="text-xs font-bold text-muted-foreground">{abbr}</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{channel.name}</span>
                <Badge variant={config.badge} className="text-[10px]">
                  {config.label}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{channel.accountId}</p>
            </div>
          </div>
        </div>

        <Separator className="mb-3" />

        <div className="grid grid-cols-2 gap-y-2 gap-x-4">
          <InfoRow icon={Clock} label="Last msg" value={channel.lastMessage} />
          <InfoRow icon={MessageSquare} label="DM Policy" value={channel.dmPolicy} />
        </div>

        <div className="mt-3 flex items-center justify-end">
          <Button variant="outline" size="sm" className="h-7 text-xs">
            Configure
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function InfoRow({ icon: Icon, label, value }: { icon: typeof MessageSquare; label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon className="h-3 w-3 text-muted-foreground" />
      <span className="text-[11px] text-muted-foreground">{label}:</span>
      <span className="text-[11px] font-medium capitalize">{value}</span>
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
