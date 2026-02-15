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
  Trash2,
  Settings,
  Eye,
  EyeOff,
  Save,
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

interface ChannelField {
  key: string
  label: string
  placeholder: string
  type?: string
  required?: boolean
  description?: string
}

interface ChannelOption {
  id: string
  name: string
  description: string
  icon: string
  fields: ChannelField[]
  configMap: (values: Record<string, string>) => Record<string, unknown>
}

const channelOptions: ChannelOption[] = [
  {
    id: "whatsapp",
    name: "WhatsApp",
    icon: "https://cdn.simpleicons.org/whatsapp/25D366",
    description: "Connect via QR code pairing. The gateway handles authentication — just start it and scan the QR code in the agent's chat.",
    fields: [],
    configMap: () => ({}),
  },
  {
    id: "telegram",
    name: "Telegram",
    icon: "https://cdn.simpleicons.org/telegram/26A5E4",
    description: "Connect a Telegram bot. Create one via @BotFather and paste the token below.",
    fields: [
      { key: "botToken", label: "Bot Token", placeholder: "123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw", required: true, description: "Get this from @BotFather on Telegram" },
    ],
    configMap: (v) => ({ botToken: v.botToken, dmPolicy: "open", streamMode: "partial" }),
  },
  {
    id: "slack",
    name: "Slack",
    icon: "https://cdn.simpleicons.org/slack",
    description: "Connect a Slack app with Socket Mode enabled. Create an app at api.slack.com/apps.",
    fields: [
      { key: "botToken", label: "Bot Token", placeholder: "xoxb-...", required: true, description: "Bot User OAuth Token from the app settings" },
      { key: "appToken", label: "App-Level Token", placeholder: "xapp-...", required: true, description: "App-Level Token with connections:write scope" },
    ],
    configMap: (v) => ({ botToken: v.botToken, appToken: v.appToken }),
  },
  {
    id: "discord",
    name: "Discord",
    icon: "https://cdn.simpleicons.org/discord/5865F2",
    description: "Connect a Discord bot. Create one in the Discord Developer Portal.",
    fields: [
      { key: "token", label: "Bot Token", placeholder: "Discord bot token...", required: true, description: "From Discord Developer Portal → Bot → Token" },
    ],
    configMap: (v) => ({ token: v.token, dmPolicy: "open" }),
  },
  {
    id: "signal",
    name: "Signal",
    icon: "https://cdn.simpleicons.org/signal/3A76F0",
    description: "Connect via signal-cli. Requires signal-cli installed and registered on the system.",
    fields: [
      { key: "cliPath", label: "signal-cli Path", placeholder: "/usr/local/bin/signal-cli", description: "Path to signal-cli binary (leave empty for default)" },
    ],
    configMap: (v) => (v.cliPath ? { cliPath: v.cliPath } : {}),
  },
  {
    id: "webchat",
    name: "WebChat",
    icon: "https://cdn.simpleicons.org/googlechat/00AC47",
    description: "Built-in web chat — always available via the Gateway Control UI. No configuration needed.",
    fields: [],
    configMap: () => ({}),
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
    configMap: (v) => {
      const config: Record<string, string> = { email: v.email, credentialsPath: v.credentialsPath }
      if (v.topicName) config.topicName = v.topicName
      if (v.subscriptionName) config.subscriptionName = v.subscriptionName
      return config
    },
  },
  {
    id: "googlechat",
    name: "Google Chat",
    icon: "https://cdn.simpleicons.org/googlechat/00AC47",
    description: "Connect a Google Chat bot via the Chat API.",
    fields: [
      { key: "credentialsPath", label: "Service Account JSON Path", placeholder: "~/.openclaw/google-chat-credentials.json", required: true },
    ],
    configMap: (v) => ({ credentialsPath: v.credentialsPath }),
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
    configMap: (v) => ({ appId: v.appId, appPassword: v.appPassword }),
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
  const [savedChannels, setSavedChannels] = useState<Record<string, unknown>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [editingChannel, setEditingChannel] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const loadChannels = useCallback(async () => {
    if (!isConnected) return
    setIsLoading(true)
    try {
      // Load live channel status from gateway
      const result = await client.channelsStatus() as {
        channelLabels?: Record<string, string>
        channels?: Record<string, { configured?: boolean }>
        channelAccounts?: Record<string, Array<Record<string, unknown>>>
      }

      // Load saved channel configs from disk
      const saved = await window.api.channels.list()
      setSavedChannels(saved || {})

      if (!result) {
        // If gateway not responding, still show saved channels
        const mapped: Channel[] = []
        for (const [channelType] of Object.entries(saved || {})) {
          mapped.push({
            id: channelType,
            name: channelType.charAt(0).toUpperCase() + channelType.slice(1),
            type: channelType,
            status: "disconnected",
            accountId: "configured",
            lastMessage: "Never",
            dmPolicy: "pairing",
            running: false,
            configured: true,
          })
        }
        setChannels(mapped)
        return
      }

      const labels = result.channelLabels || {}
      const mapped: Channel[] = []
      const accounts = result.channelAccounts || {}
      const seenTypes = new Set<string>()

      for (const [channelType, accountList] of Object.entries(accounts)) {
        if (!Array.isArray(accountList)) continue
        seenTypes.add(channelType)
        for (const account of accountList) {
          const connected = !!(account.connected || account.running)
          const hasError = !!account.lastError && !connected
          const accountId = account.accountId as string || "default"

          mapped.push({
            id: `${channelType}-${accountId}`,
            name: `${labels[channelType] || channelType.charAt(0).toUpperCase() + channelType.slice(1)}${accountId !== "default" ? ` (${accountId})` : ""}`,
            type: channelType,
            status: connected ? "connected" : hasError ? "error" : "disconnected",
            accountId: (account.audience as string) || (account.bot as Record<string, unknown>)?.username as string || accountId,
            lastMessage: timeAgo(account.lastInboundAt as string || account.lastMessageAt as string),
            dmPolicy: (account.dmPolicy as string) || "pairing",
            running: !!account.running,
            configured: true,
          })
        }
      }

      // Show saved channels that aren't in the live status (not yet started)
      const configuredChannels = result.channels || {}
      for (const [channelType, info] of Object.entries(configuredChannels)) {
        if (info?.configured && !seenTypes.has(channelType)) {
          seenTypes.add(channelType)
          mapped.push({
            id: channelType,
            name: labels[channelType] || channelType.charAt(0).toUpperCase() + channelType.slice(1),
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

      // Also show channels saved to config but not yet recognized by gateway
      for (const channelType of Object.keys(saved || {})) {
        if (!seenTypes.has(channelType)) {
          seenTypes.add(channelType)
          mapped.push({
            id: channelType,
            name: channelType.charAt(0).toUpperCase() + channelType.slice(1),
            type: channelType,
            status: "disconnected",
            accountId: "saved",
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

  // Auto-dismiss status messages
  useEffect(() => {
    if (statusMessage) {
      const t = setTimeout(() => setStatusMessage(null), 4000)
      return () => clearTimeout(t)
    }
  }, [statusMessage])

  const handleRemoveChannel = async (channelType: string) => {
    const result = await window.api.channels.remove(channelType)
    if (result.success) {
      setStatusMessage({ type: "success", text: `${channelType} removed. Gateway restarting...` })
      setTimeout(loadChannels, 3000)
    } else {
      setStatusMessage({ type: "error", text: result.error || "Failed to remove channel" })
    }
  }

  const connectedCount = channels.filter((c) => c.status === "connected").length

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Channels</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Connect messaging platforms. Configurations persist across restarts.
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

      {statusMessage && (
        <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
          statusMessage.type === "success" ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"
        }`}>
          {statusMessage.type === "success" ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {statusMessage.text}
        </div>
      )}

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
              {isConnected ? "No channels configured. Click Add Channel to get started." : "Start the Gateway to see channels"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {channels.map((channel) => (
            <ChannelCard
              key={channel.id}
              channel={channel}
              onConfigure={() => setEditingChannel(channel.type)}
              onRemove={() => handleRemoveChannel(channel.type)}
            />
          ))}
        </div>
      )}

      {showAddDialog && (
        <AddChannelDialog
          onClose={() => setShowAddDialog(false)}
          onSaved={() => {
            setShowAddDialog(false)
            setStatusMessage({ type: "success", text: "Channel saved. Gateway restarting..." })
            setTimeout(loadChannels, 3000)
          }}
          existingChannels={Object.keys(savedChannels)}
        />
      )}

      {editingChannel && (
        <EditChannelDialog
          channelType={editingChannel}
          savedConfig={(savedChannels[editingChannel] || {}) as Record<string, unknown>}
          onClose={() => setEditingChannel(null)}
          onSaved={() => {
            setEditingChannel(null)
            setStatusMessage({ type: "success", text: "Channel updated. Gateway restarting..." })
            setTimeout(loadChannels, 3000)
          }}
        />
      )}
    </div>
  )
}

function AddChannelDialog({
  onClose,
  onSaved,
  existingChannels,
}: {
  onClose: () => void
  onSaved: () => void
  existingChannels: string[]
}) {
  const [selectedChannel, setSelectedChannel] = useState<ChannelOption | null>(null)
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({})
  const [isSaving, setIsSaving] = useState(false)
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({})
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    if (!selectedChannel) return

    // Validate required fields
    for (const field of selectedChannel.fields) {
      if (field.required && !fieldValues[field.key]?.trim()) {
        setError(`${field.label} is required`)
        return
      }
    }

    setIsSaving(true)
    setError(null)

    const channelConfig = selectedChannel.configMap(fieldValues)
    const result = await window.api.channels.save(selectedChannel.id, channelConfig)

    if (result.success) {
      onSaved()
    } else {
      setError(result.error || "Failed to save channel")
    }
    setIsSaving(false)
  }

  if (selectedChannel) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/60" onClick={onClose} />
        <div className="relative w-[480px] max-h-[80vh] rounded-xl border bg-card shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b">
            <div className="flex items-center gap-3">
              <img src={selectedChannel.icon} alt="" className="h-6 w-6" />
              <h2 className="text-base font-semibold">Configure {selectedChannel.name}</h2>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="p-4 space-y-4">
            <p className="text-sm text-muted-foreground">{selectedChannel.description}</p>

            {selectedChannel.fields.length === 0 ? (
              <div className="bg-secondary/50 rounded-lg p-4 text-sm text-muted-foreground">
                No configuration needed. Just save and the gateway will handle the rest.
              </div>
            ) : (
              selectedChannel.fields.map((field) => (
                <div key={field.key} className="space-y-1.5">
                  <label className="text-sm font-medium">
                    {field.label}
                    {field.required && <span className="text-red-400 ml-1">*</span>}
                  </label>
                  {field.description && (
                    <p className="text-xs text-muted-foreground">{field.description}</p>
                  )}
                  <div className="relative">
                    <input
                      type={field.type === "password" && !showSecrets[field.key] ? "password" : showSecrets[field.key] ? "text" : "text"}
                      placeholder={field.placeholder}
                      value={fieldValues[field.key] || ""}
                      onChange={(e) => setFieldValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                      className="w-full px-3 py-2 text-sm bg-secondary border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 font-mono"
                      autoComplete="off"
                      spellCheck={false}
                    />
                    {(field.type === "password" || field.key.toLowerCase().includes("token") || field.key.toLowerCase().includes("secret") || field.key.toLowerCase().includes("password")) && fieldValues[field.key] && (
                      <button
                        type="button"
                        onClick={() => setShowSecrets((prev) => ({ ...prev, [field.key]: !prev[field.key] }))}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showSecrets[field.key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 text-red-400 text-sm border border-red-500/20">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <Button variant="ghost" size="sm" onClick={() => setSelectedChannel(null)}>
                ← Back
              </Button>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
                <Button size="sm" onClick={handleSave} disabled={isSaving}>
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                  Save & Connect
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
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
            Select a messaging platform to connect. Configuration is saved to disk and persists across restarts.
          </p>
          <div className="grid grid-cols-3 gap-3">
            {channelOptions.map((ch) => {
              const isExisting = existingChannels.includes(ch.id)
              return (
                <button
                  key={ch.id}
                  onClick={() => !isExisting && setSelectedChannel(ch)}
                  disabled={isExisting}
                  className={`flex flex-col items-center gap-2.5 p-4 rounded-lg border transition-colors ${
                    isExisting
                      ? "opacity-40 cursor-not-allowed border-border"
                      : "hover:bg-accent/50 hover:border-primary/50"
                  }`}
                >
                  <img
                    src={ch.icon}
                    alt={ch.name}
                    className="h-9 w-9 object-contain"
                    loading="lazy"
                  />
                  <span className="text-xs font-medium">{ch.name}</span>
                  {isExisting && <span className="text-[10px] text-muted-foreground">Configured</span>}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function EditChannelDialog({
  channelType,
  savedConfig,
  onClose,
  onSaved,
}: {
  channelType: string
  savedConfig: Record<string, unknown>
  onClose: () => void
  onSaved: () => void
}) {
  const channelDef = channelOptions.find((c) => c.id === channelType)
  const [fieldValues, setFieldValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {}
    if (channelDef) {
      for (const field of channelDef.fields) {
        initial[field.key] = (savedConfig[field.key] as string) || ""
      }
    }
    return initial
  })
  const [isSaving, setIsSaving] = useState(false)
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({})
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    if (!channelDef) return

    for (const field of channelDef.fields) {
      if (field.required && !fieldValues[field.key]?.trim()) {
        setError(`${field.label} is required`)
        return
      }
    }

    setIsSaving(true)
    setError(null)

    const channelConfig = channelDef.configMap(fieldValues)
    const result = await window.api.channels.save(channelType, channelConfig)

    if (result.success) {
      onSaved()
    } else {
      setError(result.error || "Failed to save")
    }
    setIsSaving(false)
  }

  const displayName = channelDef?.name || channelType.charAt(0).toUpperCase() + channelType.slice(1)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-[480px] max-h-[80vh] rounded-xl border bg-card shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-3">
            {channelDef && <img src={channelDef.icon} alt="" className="h-6 w-6" />}
            <h2 className="text-base font-semibold">Edit {displayName}</h2>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-4 space-y-4">
          {channelDef && channelDef.fields.length > 0 ? (
            channelDef.fields.map((field) => (
              <div key={field.key} className="space-y-1.5">
                <label className="text-sm font-medium">
                  {field.label}
                  {field.required && <span className="text-red-400 ml-1">*</span>}
                </label>
                {field.description && (
                  <p className="text-xs text-muted-foreground">{field.description}</p>
                )}
                <div className="relative">
                  <input
                    type={showSecrets[field.key] ? "text" : "password"}
                    placeholder={field.placeholder}
                    value={fieldValues[field.key] || ""}
                    onChange={(e) => setFieldValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                    className="w-full px-3 py-2 text-sm bg-secondary border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 font-mono"
                    autoComplete="off"
                    spellCheck={false}
                  />
                  {fieldValues[field.key] && (
                    <button
                      type="button"
                      onClick={() => setShowSecrets((prev) => ({ ...prev, [field.key]: !prev[field.key] }))}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showSecrets[field.key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="bg-secondary/50 rounded-lg p-4 text-sm text-muted-foreground">
              This channel has no editable configuration. It connects automatically when the gateway starts.
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 text-red-400 text-sm border border-red-500/20">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
              Save & Restart
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ChannelCard({
  channel,
  onConfigure,
  onRemove,
}: {
  channel: Channel
  onConfigure: () => void
  onRemove: () => void
}) {
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false)
  const statusConfig = {
    connected: { label: "Connected", badge: "success" as const, icon: CheckCircle2 },
    disconnected: { label: "Disconnected", badge: "secondary" as const, icon: XCircle },
    error: { label: "Error", badge: "destructive" as const, icon: AlertCircle },
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

        <div className="mt-3 flex items-center justify-end gap-2">
          {showRemoveConfirm ? (
            <>
              <span className="text-xs text-red-400 mr-1">Remove?</span>
              <Button variant="destructive" size="sm" className="h-7 text-xs" onClick={() => { onRemove(); setShowRemoveConfirm(false) }}>
                Yes, Remove
              </Button>
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setShowRemoveConfirm(false)}>
                Cancel
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-red-400" onClick={() => setShowRemoveConfirm(true)}>
                <Trash2 className="h-3 w-3 mr-1" />
                Remove
              </Button>
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onConfigure}>
                <Settings className="h-3 w-3 mr-1" />
                Configure
              </Button>
            </>
          )}
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
