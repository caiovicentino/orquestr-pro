import { useState, useEffect, useCallback } from "react"
import type { GatewayClient } from "@/lib/gateway-client"
import {
  Settings,
  Server,
  Brain,
  Key,
  Coins,
  Globe,
  Bell,
  Palette,
  HardDrive,
  RotateCw,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  Copy,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"

type SettingsTab = "gateway" | "models" | "auth" | "wallets" | "general"

interface SettingsPageProps {
  client: GatewayClient
  isConnected: boolean
}

interface ModelProvider {
  id: string
  name: string
  status: "connected" | "disconnected" | "error"
  models: string[]
  authType: string
  usage: string
}

const mockProviders: ModelProvider[] = [
  {
    id: "anthropic",
    name: "Anthropic",
    status: "connected",
    models: ["claude-opus-4-6", "claude-sonnet-4", "claude-haiku-3.5"],
    authType: "OAuth (Pro subscription)",
    usage: "$45.20 this month",
  },
  {
    id: "openai",
    name: "OpenAI",
    status: "connected",
    models: ["gpt-4.1", "gpt-4.1-mini", "o3-mini"],
    authType: "API Key",
    usage: "$12.80 this month",
  },
  {
    id: "google",
    name: "Google AI",
    status: "disconnected",
    models: ["gemini-2.5-pro", "gemini-2.5-flash"],
    authType: "Not configured",
    usage: "--",
  },
  {
    id: "ollama",
    name: "Ollama (Local)",
    status: "disconnected",
    models: ["llama3", "mistral", "codellama"],
    authType: "Local",
    usage: "Free",
  },
]

export function SettingsPage({ client, isConnected }: SettingsPageProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("gateway")
  const [realProviders, setRealProviders] = useState<ModelProvider[] | null>(null)
  const [config, setConfig] = useState<Record<string, unknown> | null>(null)

  const loadData = useCallback(async () => {
    if (!isConnected) return
    try {
      const [modelsResult, configResult] = await Promise.all([
        client.modelsList() as Promise<{
          models?: Array<{ id: string; name: string; provider: string }>
        }>,
        client.configGet() as Promise<{
          config?: Record<string, unknown>
          resolved?: Record<string, unknown>
        }>,
      ])

      if (modelsResult?.models) {
        const grouped = new Map<string, string[]>()
        for (const m of modelsResult.models) {
          const provider = m.provider || "unknown"
          if (!grouped.has(provider)) grouped.set(provider, [])
          grouped.get(provider)!.push(m.id || m.name)
        }
        setRealProviders(
          Array.from(grouped.entries()).map(([provider, models]) => ({
            id: provider,
            name: provider.charAt(0).toUpperCase() + provider.slice(1),
            status: "connected" as const,
            models: models.slice(0, 5),
            authType: "Configured",
            usage: `${models.length} models`,
          }))
        )
      }

      if (configResult?.config || configResult?.resolved) {
        setConfig((configResult.resolved || configResult.config) as Record<string, unknown>)
      }
    } catch {}
  }, [isConnected, client])

  useEffect(() => {
    loadData()
  }, [loadData])

  const providers = realProviders || mockProviders
  const gw = (config?.gateway || {}) as Record<string, unknown>
  const gwAuth = (gw.auth || {}) as Record<string, unknown>

  const tabs: { id: SettingsTab; label: string; icon: typeof Server }[] = [
    { id: "gateway", label: "Gateway", icon: Server },
    { id: "models", label: "Model Providers", icon: Brain },
    { id: "auth", label: "Authentication", icon: Key },
    { id: "wallets", label: "Wallets", icon: Coins },
    { id: "general", label: "General", icon: Settings },
  ]

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure gateway, model providers, and application settings
        </p>
      </div>

      <div className="flex gap-6">
        <div className="w-[200px] shrink-0 space-y-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 w-full px-3 py-2 rounded-md text-sm transition-colors ${
                activeTab === tab.id
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground"
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 min-w-0">
          {activeTab === "gateway" && <GatewaySettings gw={gw} />}
          {activeTab === "models" && <ModelSettings providers={providers} />}
          {activeTab === "auth" && <AuthSettings gwAuth={gwAuth} />}
          {activeTab === "wallets" && <WalletSettings />}
          {activeTab === "general" && <GeneralSettings config={config} />}
        </div>
      </div>
    </div>
  )
}

function GatewaySettings({ gw }: { gw: Record<string, unknown> }) {
  const port = String(gw.port || 18789)
  const bind = String(gw.bind || "loopback")
  const mode = String(gw.mode || "local")
  const cui = (gw.controlUi || {}) as Record<string, unknown>

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Gateway Configuration</CardTitle>
          <CardDescription>Core gateway settings and network configuration</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <SettingRow label="Port" description="Gateway WebSocket port">
            <span className="text-sm font-mono">{port}</span>
          </SettingRow>
          <Separator />
          <SettingRow label="Bind Mode" description="Network interface binding">
            <span className="text-sm font-mono capitalize">{bind}</span>
          </SettingRow>
          <Separator />
          <SettingRow label="Mode" description="Gateway operation mode">
            <span className="text-sm font-mono capitalize">{mode}</span>
          </SettingRow>
          <Separator />
          <SettingRow label="Control UI" description="Web-based control panel">
            <span className="text-sm font-mono">{cui.enabled !== false ? "Enabled" : "Disabled"}</span>
          </SettingRow>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">State Directory</CardTitle>
          <CardDescription>Data storage paths and configuration</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <SettingRow label="Config Path" description="Main configuration file">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-muted-foreground">~/.openclaw/openclaw.json</span>
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          </SettingRow>
          <Separator />
          <SettingRow label="State Directory" description="Sessions, credentials, and data">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-muted-foreground">~/.openclaw</span>
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <ExternalLink className="h-3 w-3" />
              </Button>
            </div>
          </SettingRow>
          <Separator />
          <SettingRow label="Workspace" description="Agent workspace directory">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-muted-foreground">~/.openclaw/workspace</span>
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <ExternalLink className="h-3 w-3" />
              </Button>
            </div>
          </SettingRow>
        </CardContent>
      </Card>
    </div>
  )
}

// Model IDs available per provider — matching OpenClaw's latest model-selection.ts
// Keys must match provider.id from SUPPORTED_PROVIDERS in main/index.ts
// Aliases: opus = claude-opus-4-6, sonnet = claude-sonnet-4-5, gpt = gpt-5.2
const PROVIDER_MODELS: Record<string, Array<{ id: string; name: string; providerPrefix: string }>> = {
  // --- Anthropic (API Key) ---
  "anthropic": [
    { id: "claude-opus-4-6", name: "Claude Opus 4.6", providerPrefix: "anthropic" },
    { id: "claude-opus-4-5", name: "Claude Opus 4.5", providerPrefix: "anthropic" },
    { id: "claude-sonnet-4-5", name: "Claude Sonnet 4.5", providerPrefix: "anthropic" },
  ],
  // --- Anthropic (OAuth — Max/Pro plan) ---
  "anthropic-oauth": [
    { id: "claude-opus-4-6", name: "Claude Opus 4.6", providerPrefix: "anthropic" },
    { id: "claude-opus-4-5", name: "Claude Opus 4.5", providerPrefix: "anthropic" },
    { id: "claude-sonnet-4-5", name: "Claude Sonnet 4.5", providerPrefix: "anthropic" },
  ],
  // --- OpenAI ---
  "openai": [
    { id: "gpt-5.2", name: "GPT-5.2", providerPrefix: "openai" },
    { id: "gpt-5-mini", name: "GPT-5 Mini", providerPrefix: "openai" },
    { id: "gpt-5.3-codex", name: "GPT-5.3 Codex", providerPrefix: "openai" },
    { id: "gpt-5.1-codex", name: "GPT-5.1 Codex", providerPrefix: "openai" },
    { id: "gpt-oss-120b", name: "GPT OSS 120B", providerPrefix: "openai" },
  ],
  // --- Google (API Key) ---
  "google": [
    { id: "gemini-3-pro-preview", name: "Gemini 3 Pro", providerPrefix: "google" },
    { id: "gemini-3-flash-preview", name: "Gemini 3 Flash", providerPrefix: "google" },
    { id: "gemini-3-pro", name: "Gemini 3 Pro (stable)", providerPrefix: "google" },
    { id: "gemini-3-flash", name: "Gemini 3 Flash (stable)", providerPrefix: "google" },
  ],
  // --- Google Antigravity (OAuth) ---
  "google-antigravity": [
    { id: "gemini-3-pro-preview", name: "Gemini 3 Pro", providerPrefix: "google" },
    { id: "gemini-3-flash-preview", name: "Gemini 3 Flash", providerPrefix: "google" },
  ],
  // --- Google Gemini CLI (OAuth) ---
  "google-gemini-cli": [
    { id: "gemini-3-pro-preview", name: "Gemini 3 Pro", providerPrefix: "google" },
    { id: "gemini-3-flash-preview", name: "Gemini 3 Flash", providerPrefix: "google" },
  ],
  // --- OpenRouter ---
  "openrouter": [
    { id: "auto", name: "OpenRouter Auto", providerPrefix: "openrouter" },
  ],
  // --- xAI (Grok) ---
  "xai": [
    { id: "grok-41-fast", name: "Grok 4.1 Fast", providerPrefix: "xai" },
    { id: "grok-code-fast-1", name: "Grok Code Fast", providerPrefix: "xai" },
  ],
  // --- Groq ---
  "groq": [
    { id: "llama-4-scout-17b-16e-instruct", name: "Llama 4 Scout 17B", providerPrefix: "groq" },
    { id: "llama-4-maverick-17b-128e-instruct", name: "Llama 4 Maverick 17B", providerPrefix: "groq" },
  ],
  // --- DeepSeek ---
  "deepseek": [
    { id: "deepseek-chat", name: "DeepSeek V3.2", providerPrefix: "deepseek" },
    { id: "deepseek-reasoner", name: "DeepSeek R1", providerPrefix: "deepseek" },
  ],
  // --- Mistral ---
  "mistral": [
    { id: "mistral-large-latest", name: "Mistral Large", providerPrefix: "mistral" },
  ],
  // --- Together AI ---
  "together": [
    { id: "meta-llama/Llama-4-Scout-17B-16E-Instruct", name: "Llama 4 Scout", providerPrefix: "together" },
    { id: "meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8", name: "Llama 4 Maverick", providerPrefix: "together" },
    { id: "deepseek-ai/DeepSeek-V3.1", name: "DeepSeek V3.1", providerPrefix: "together" },
    { id: "deepseek-ai/DeepSeek-R1", name: "DeepSeek R1", providerPrefix: "together" },
    { id: "moonshotai/Kimi-K2.5", name: "Kimi K2.5", providerPrefix: "together" },
  ],
  // --- Cerebras ---
  "cerebras": [
    { id: "llama-4-scout-17b-16e-instruct", name: "Llama 4 Scout (Cerebras)", providerPrefix: "cerebras" },
  ],
  // --- Perplexity ---
  "perplexity": [
    { id: "sonar-pro", name: "Sonar Pro", providerPrefix: "perplexity" },
    { id: "sonar", name: "Sonar", providerPrefix: "perplexity" },
  ],
  // --- Venice AI ---
  "venice": [
    { id: "llama-3.3-70b", name: "Llama 3.3 70B", providerPrefix: "venice" },
    { id: "deepseek-v3.2", name: "DeepSeek V3.2", providerPrefix: "venice" },
    { id: "claude-opus-45", name: "Claude Opus 4.5 (via Venice)", providerPrefix: "venice" },
    { id: "claude-sonnet-45", name: "Claude Sonnet 4.5 (via Venice)", providerPrefix: "venice" },
    { id: "openai-gpt-52", name: "GPT-5.2 (via Venice)", providerPrefix: "venice" },
    { id: "grok-41-fast", name: "Grok 4.1 Fast (via Venice)", providerPrefix: "venice" },
    { id: "gemini-3-pro-preview", name: "Gemini 3 Pro (via Venice)", providerPrefix: "venice" },
  ],
  // --- GitHub Copilot (OAuth) ---
  "copilot": [
    { id: "claude-sonnet-4-5", name: "Claude Sonnet 4.5 (via Copilot)", providerPrefix: "copilot" },
    { id: "gpt-5.2", name: "GPT-5.2 (via Copilot)", providerPrefix: "copilot" },
  ],
  // --- MiniMax (OAuth) ---
  "minimax-portal": [
    { id: "MiniMax-M2.5", name: "MiniMax M2.5", providerPrefix: "minimax-portal" },
    { id: "MiniMax-M2.5-Lightning", name: "MiniMax M2.5 Lightning", providerPrefix: "minimax-portal" },
    { id: "MiniMax-M2.1-lightning", name: "MiniMax M2.1 Lightning", providerPrefix: "minimax-portal" },
  ],
  // --- Qwen (OAuth) ---
  "qwen-portal": [
    { id: "qwen3-235b-a22b-thinking-2507", name: "Qwen3 235B Thinking", providerPrefix: "qwen-portal" },
    { id: "qwen3-235b-a22b-instruct-2507", name: "Qwen3 235B Instruct", providerPrefix: "qwen-portal" },
    { id: "qwen3-coder-480b-a35b-instruct", name: "Qwen3 Coder 480B", providerPrefix: "qwen-portal" },
  ],
}

function ModelSettings({ providers }: { providers: ModelProvider[] }) {
  const [credentialsList, setCredentialsList] = useState<Record<string, { configured: boolean; masked: string }>>({})
  const [supportedProviders, setSupportedProviders] = useState<any[]>([])
  const [editingProvider, setEditingProvider] = useState<string | null>(null)
  const [apiKeyInput, setApiKeyInput] = useState<Record<string, string>>({})
  const [showKey, setShowKey] = useState<Record<string, boolean>>({})
  const [isSaving, setIsSaving] = useState<Record<string, boolean>>({})
  const [needsRestart, setNeedsRestart] = useState(false)
  const [activeModel, setActiveModel] = useState<string>("")
  const [savingModel, setSavingModel] = useState(false)

  const isElectron = typeof window !== "undefined" && !!window.api

  useEffect(() => {
    if (!isElectron) return
    
    Promise.all([
      window.api.credentials.get(),
      window.api.credentials.listProviders(),
      window.api.config.get(),
    ]).then(([creds, providers, config]) => {
      setCredentialsList(creds)
      setSupportedProviders(providers)
      // Extract current model from config
      const agents = (config as any)?.agents?.defaults?.model?.primary
      if (agents) setActiveModel(agents)
    })
  }, [isElectron])

  // Get configured provider IDs from credentials
  const configuredProviderIds = new Set<string>()
  for (const provider of supportedProviders) {
    if (credentialsList[provider.envVar]?.configured) {
      configuredProviderIds.add(provider.id)
    }
  }

  // Build list of all available models from configured providers
  const availableModels: Array<{ provider: string; id: string; name: string; fullId: string }> = []
  const seenFullIds = new Set<string>()
  for (const [provId, models] of Object.entries(PROVIDER_MODELS)) {
    if (configuredProviderIds.has(provId)) {
      for (const m of models) {
        const fullId = `${m.providerPrefix}/${m.id}`
        if (!seenFullIds.has(fullId)) {
          seenFullIds.add(fullId)
          availableModels.push({
            provider: m.providerPrefix,
            id: m.id,
            name: m.name,
            fullId,
          })
        }
      }
    }
  }

  const handleModelChange = async (fullModelId: string) => {
    if (!isElectron) return
    setActiveModel(fullModelId)
    setSavingModel(true)
    try {
      await window.api.config.patchModel(fullModelId)
      setNeedsRestart(true)
    } catch (e) {
      console.error("Failed to update model:", e)
    }
    setSavingModel(false)
  }

  const handleSave = async (envVar: string) => {
    if (!isElectron || !apiKeyInput[envVar]?.trim()) return
    
    setIsSaving({ ...isSaving, [envVar]: true })
    try {
      await window.api.credentials.set(envVar, apiKeyInput[envVar].trim())
      const updated = await window.api.credentials.get()
      setCredentialsList(updated)
      setApiKeyInput({ ...apiKeyInput, [envVar]: "" })
      setEditingProvider(null)
      setNeedsRestart(true)
    } catch (e) {
      console.error("Failed to save credential:", e)
    }
    setIsSaving({ ...isSaving, [envVar]: false })
  }

  const handleDelete = async (envVar: string) => {
    if (!isElectron) return
    
    try {
      await window.api.credentials.delete(envVar)
      const updated = await window.api.credentials.get()
      setCredentialsList(updated)
      setNeedsRestart(true)
    } catch (e) {
      console.error("Failed to delete credential:", e)
    }
  }

  const handleRestart = async () => {
    if (!isElectron) return
    try {
      await window.api.gateway.restart()
      setNeedsRestart(false)
    } catch (e) {
      console.error("Failed to restart gateway:", e)
    }
  }

  return (
    <div className="space-y-6">
      {needsRestart && (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Bell className="h-5 w-5 text-amber-500" />
                <div>
                  <p className="text-sm font-medium text-amber-200">Gateway restart required</p>
                  <p className="text-xs text-amber-300/80">Changes will take effect after restarting the gateway</p>
                </div>
              </div>
              <Button size="sm" onClick={handleRestart} className="bg-amber-600 hover:bg-amber-700">
                <RotateCw className="h-3.5 w-3.5 mr-1.5" />
                Restart Gateway
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active Model Selector — shown when at least one provider is configured */}
      {availableModels.length > 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center">
                  <Brain className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Default Model</p>
                  <p className="text-xs text-muted-foreground">Model used for new chat sessions</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={activeModel}
                  onChange={(e) => handleModelChange(e.target.value)}
                  disabled={savingModel}
                  className="h-9 w-[280px] rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">Select a model...</option>
                  {availableModels.map((m) => (
                    <option key={m.fullId} value={m.fullId}>
                      {m.name} ({m.provider}/{m.id})
                    </option>
                  ))}
                </select>
                {savingModel && (
                  <span className="text-xs text-muted-foreground animate-pulse">Saving...</span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {supportedProviders.map((provider) => {
          const envVar = provider.envVar
          const isLocal = provider.id === "ollama"
          const isConfigured = isLocal || credentialsList[envVar]?.configured
          const isEditing = editingProvider === envVar
          const colorClass = provider.color
          const providerModels = PROVIDER_MODELS[provider.id] || []

          return (
            <Card key={provider.id} className="overflow-hidden">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="h-10 w-10 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: `${provider.color}20` }}
                    >
                      <Brain className="h-5 w-5" style={{ color: provider.color }} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{provider.name}</span>
                        <Badge 
                          variant={isConfigured ? "success" : "secondary"} 
                          className="text-[10px] px-2 py-0.5"
                        >
                          {isConfigured ? "Configured" : "Not configured"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {provider.description || provider.authTypes.join(", ")}
                        {isConfigured && !isLocal && (
                          <span className="ml-2 font-mono text-[10px]">
                            {credentialsList[envVar]?.masked}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  
                  {!isLocal && (
                    <div className="flex gap-2">
                      {isConfigured && !isEditing && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10"
                          onClick={() => handleDelete(envVar)}
                        >
                          Disconnect
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => {
                          setEditingProvider(isEditing ? null : envVar)
                          if (!isEditing) {
                            setApiKeyInput({ ...apiKeyInput, [envVar]: "" })
                          }
                        }}
                      >
                        {isEditing ? "Cancel" : isConfigured ? "Update" : "Configure"}
                      </Button>
                    </div>
                  )}
                </div>

                {isEditing && (
                  <div className="space-y-3 mt-4 pt-4 border-t border-zinc-800">
                    <div>
                      <label className="text-xs font-medium text-zinc-400 mb-2 block">
                        {provider.authTypes?.includes("OAuth Token") ? "OAuth Token" : "API Key"}
                      </label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <input
                            type={showKey[envVar] ? "text" : "password"}
                            value={apiKeyInput[envVar] || ""}
                            onChange={(e) => setApiKeyInput({ ...apiKeyInput, [envVar]: e.target.value })}
                            placeholder={provider.authTypes?.includes("OAuth Token") 
                              ? "Paste your Anthropic OAuth token..." 
                              : `Enter your ${provider.name} API key...`}
                            className="h-9 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 pr-10 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-ring"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleSave(envVar)
                            }}
                          />
                          <button
                            onClick={() => setShowKey({ ...showKey, [envVar]: !showKey[envVar] })}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                          >
                            {showKey[envVar] ? (
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                              </svg>
                            ) : (
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            )}
                          </button>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleSave(envVar)}
                          disabled={isSaving[envVar] || !apiKeyInput[envVar]?.trim()}
                          className="h-9"
                        >
                          {isSaving[envVar] ? "Saving..." : "Save"}
                        </Button>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {provider.authTypes?.includes("OAuth Token") 
                        ? "Your OAuth token from the Anthropic Max/Pro plan. Run 'openclaw auth login anthropic' to get it, or paste your token directly."
                        : "Your API key will be stored securely and passed to the OpenClaw gateway."}
                    </p>
                  </div>
                )}

                {/* Model Selection — shown when provider is configured */}
                {isConfigured && !isLocal && providerModels.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-zinc-800">
                    <label className="text-xs font-medium text-zinc-400 mb-2 block">
                      Available Models
                    </label>
                    <div className="space-y-1.5">
                      {providerModels.map((m) => {
                        const fullId = `${m.providerPrefix}/${m.id}`
                        const isActive = activeModel === fullId
                        return (
                          <div
                            key={m.id}
                            className={`flex items-center justify-between px-3 py-2 rounded-md border transition-colors ${
                              isActive
                                ? "border-primary/50 bg-primary/10"
                                : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <div className={`h-2 w-2 rounded-full ${isActive ? "bg-primary" : "bg-zinc-600"}`} />
                              <span className="text-sm font-medium">{m.name}</span>
                              <span className="text-[10px] font-mono text-muted-foreground">{m.id}</span>
                            </div>
                            {isActive ? (
                              <Badge variant="success" className="text-[10px] px-2 py-0.5">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Active
                              </Badge>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 text-[10px] text-muted-foreground hover:text-foreground"
                                disabled={savingModel}
                                onClick={() => handleModelChange(fullId)}
                              >
                                Set as Default
                              </Button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {isLocal && (
                  <div className="mt-3 p-3 rounded-md bg-zinc-900 border border-zinc-800">
                    <p className="text-xs text-zinc-400">
                      Ollama runs locally on your machine. Install from{" "}
                      <a
                        href="https://ollama.ai"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                        onClick={(e) => { e.preventDefault(); window.open("https://ollama.ai", "_blank") }}
                      >
                        ollama.ai
                      </a>
                      {" "}and models will be automatically detected.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">How API Keys Work</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs text-muted-foreground">
          <p>1. Enter your API key for each provider you want to use</p>
          <p>2. Keys are stored securely in: <code className="text-[10px] px-1 py-0.5 rounded bg-zinc-800">~/Library/Application Support/orquestr-pro/openclaw-state/credentials.json</code></p>
          <p>3. When you restart the gateway, your keys are loaded into the environment</p>
          <p>4. The OpenClaw gateway uses these keys to authenticate with AI providers</p>
          <p>5. Your keys never leave your machine</p>
        </CardContent>
      </Card>
    </div>
  )
}

function AuthSettings({ gwAuth }: { gwAuth: Record<string, unknown> }) {
  const authMode = String(gwAuth.mode || "token")
  const token = String(gwAuth.token || "")
  const maskedToken = token ? token.slice(0, 8) + "..." + token.slice(-4) : "--"

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Gateway Authentication</CardTitle>
          <CardDescription>Authentication for gateway access</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <SettingRow label="Auth Mode" description="Primary authentication method">
            <span className="text-sm font-mono capitalize">{authMode}</span>
          </SettingRow>
          <Separator />
          <SettingRow label="Gateway Token" description="Bearer token for API and WebSocket auth">
            <span className="text-sm font-mono">{maskedToken}</span>
          </SettingRow>
          <Separator />
          <SettingRow label="Rate Limiting" description="Max auth attempts per IP window">
            <span className="text-sm font-mono">10 / 60s</span>
          </SettingRow>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">SSO Configuration</CardTitle>
          <CardDescription>Enterprise Single Sign-On (coming soon)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <SettingRow label="Provider" description="Identity provider for SSO">
            <select disabled className="h-8 w-[160px] rounded-md border bg-background px-3 text-sm opacity-50">
              <option>None</option>
              <option>Okta</option>
              <option>Azure AD</option>
              <option>Google Workspace</option>
            </select>
          </SettingRow>
          <Separator />
          <SettingRow label="MFA" description="Require multi-factor authentication">
            <ToggleSwitch />
          </SettingRow>
        </CardContent>
      </Card>
    </div>
  )
}

function WalletSettings() {
  const [appId, setAppId] = useState("")
  const [appSecret, setAppSecret] = useState("")
  const [hasSecret, setHasSecret] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const isElectron = typeof window !== "undefined" && !!window.api

  useEffect(() => {
    if (!isElectron) return
    window.api.privy.getConfig().then((config: { appId: string; hasSecret: boolean }) => {
      setAppId(config.appId || "")
      setHasSecret(config.hasSecret)
    })
  }, [isElectron])

  const handleSave = async () => {
    if (!isElectron) return
    setIsSaving(true)
    try {
      await window.api.privy.setConfig(appId, appSecret)
      setHasSecret(!!appSecret)
      setAppSecret("")
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {}
    setIsSaving(false)
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Privy Server Wallets</CardTitle>
            <a
              href="https://dashboard.privy.io"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline flex items-center gap-1"
              onClick={(e) => { e.preventDefault(); window.open("https://dashboard.privy.io", "_blank") }}
            >
              Open Privy Dashboard
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <CardDescription>
            Connect Privy to enable agents to create and manage crypto wallets (Ethereum, Solana, Bitcoin, and more).{" "}
            <a
              href="https://privy.io"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
              onClick={(e) => { e.preventDefault(); window.open("https://privy.io", "_blank") }}
            >
              Create a free account at privy.io
            </a>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <SettingRow label="App ID" description="Your Privy application ID">
            <input
              type="text"
              value={appId}
              onChange={(e) => setAppId(e.target.value)}
              placeholder="clwxxxxxxxxxxxxxxx"
              className="h-8 w-[280px] rounded-md border bg-background px-3 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </SettingRow>
          <Separator />
          <SettingRow label="App Secret" description={hasSecret ? "Secret is configured (enter new value to replace)" : "Your Privy app secret key"}>
            <input
              type="password"
              value={appSecret}
              onChange={(e) => setAppSecret(e.target.value)}
              placeholder={hasSecret ? "••••••••••••••••" : "Enter app secret..."}
              className="h-8 w-[280px] rounded-md border bg-background px-3 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </SettingRow>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Status</p>
              <p className="text-xs text-muted-foreground">Privy API connection</p>
            </div>
            <Badge variant={appId && hasSecret ? "success" : "secondary"}>
              {appId && hasSecret ? "Configured" : "Not configured"}
            </Badge>
          </div>
          <div className="flex justify-end">
            <Button size="sm" onClick={handleSave} disabled={isSaving || !appId.trim()}>
              {saved ? "Saved" : isSaving ? "Saving..." : "Save Credentials"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Supported Chains</CardTitle>
          <CardDescription>Agents can create wallets on any of these networks</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-2">
            {["Ethereum", "Solana", "Bitcoin", "Cosmos", "Sui", "Aptos", "Tron", "Near", "TON", "Starknet", "Stellar", "Spark"].map((chain) => (
              <div key={chain} className="flex items-center gap-2 p-2 rounded bg-accent/30 text-xs font-medium">
                <div className="h-2 w-2 rounded-full bg-emerald-500" />
                {chain}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">How it works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs text-muted-foreground">
          <p>1. Configure your Privy credentials above</p>
          <p>2. Ask your agent: "create a Solana wallet"</p>
          <p>3. The agent uses the wallet-manager skill to call the Privy API</p>
          <p>4. Wallets are server-side — no browser or user interaction needed</p>
          <p>5. Sub-agents can have their own wallets stored in their workspace</p>
        </CardContent>
      </Card>
    </div>
  )
}

function GeneralSettings({ config }: { config: Record<string, unknown> | null }) {
  const logging = (config?.logging || {}) as Record<string, unknown>
  const agent = (config?.agent || config?.agents || {}) as Record<string, unknown>
  const defaults = (agent.defaults || {}) as Record<string, unknown>
  const model = String(defaults.model || agent.model || "--")

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Agent Model</CardTitle>
          <CardDescription>Default model used for agent sessions</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <SettingRow label="Default Model" description="Primary model for new sessions">
            <span className="text-sm font-mono">{model}</span>
          </SettingRow>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Logging</CardTitle>
          <CardDescription>Gateway logging configuration</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <SettingRow label="Log Level" description="Verbosity of gateway logs">
            <span className="text-sm font-mono">{String(logging.level || "info")}</span>
          </SettingRow>
          <Separator />
          <SettingRow label="Redact Sensitive" description="Redact sensitive data in tool logs">
            <span className="text-sm font-mono">{String(logging.redactSensitive || "tools")}</span>
          </SettingRow>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Updates</CardTitle>
          <CardDescription>Application update preferences</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <SettingRow label="Auto-update" description="Automatically download and install updates">
            <ToggleSwitch defaultChecked />
          </SettingRow>
          <Separator />
          <SettingRow label="Update Channel" description="Release channel for updates">
            <select className="h-8 w-[140px] rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
              <option>Stable</option>
              <option>Beta</option>
              <option>Dev</option>
            </select>
          </SettingRow>
          <Separator />
          <SettingRow label="Current Version" description="Installed application version">
            <span className="text-sm font-mono">1.0.0</span>
          </SettingRow>
        </CardContent>
      </Card>
    </div>
  )
}

function SettingRow({
  label,
  description,
  children,
}: {
  label: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      {children}
    </div>
  )
}

function ToggleSwitch({ defaultChecked = false }: { defaultChecked?: boolean }) {
  const [checked, setChecked] = useState(defaultChecked)

  return (
    <button
      onClick={() => setChecked(!checked)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
        checked ? "bg-primary" : "bg-secondary"
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
          checked ? "translate-x-[18px]" : "translate-x-[3px]"
        }`}
      />
    </button>
  )
}
