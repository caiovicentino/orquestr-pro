import { app, shell, BrowserWindow, ipcMain, Tray, Menu, nativeImage, protocol, net, dialog } from "electron"
import { join } from "path"
import { pathToFileURL } from "url"
import { electronApp, optimizer, is } from "@electron-toolkit/utils"
import pkg from "electron-updater"
const { autoUpdater } = pkg
import { GatewayManager } from "./gateway"
import { readConfig, writeConfig, patchConfig, ensureGatewayConfig, getConfigPath, getStateDir } from "./config"

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let isQuitting = false
const gatewayManager = new GatewayManager()

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    show: false,
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 16, y: 16 },
    backgroundColor: "#09090b",
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, "../preload/index.mjs"),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  mainWindow.on("ready-to-show", () => {
    mainWindow?.show()
  })

  mainWindow.on("close", (event) => {
    if (process.platform === "darwin" && !isQuitting) {
      event.preventDefault()
      mainWindow?.hide()
    }
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: "deny" }
  })

  if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"])
  } else {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"))
  }
}

function createTray(): void {
  const icon = nativeImage.createFromDataURL(
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAASCAYAAABSO15qAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAABsSURBVHgB7ZKxDQAgCAQv7uAUjuFIjsQYTuEOrqCxMDHRwkL9l1Bwwx8A/AMWMBIElkGKEBSmfomBmVMI4M2YSRjyVIgr/8QPaHXPFugkUZ+FroSVrKrVyBkq6FXoTNjAktxO5WMJ0o8OUAFHKCkj7UBrGgAAAABJRU5ErkJggg=="
  )
  tray = new Tray(icon)
  tray.setToolTip("Orquestr Pro")

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Open Orquestr Pro",
      click: () => {
        mainWindow?.show()
        mainWindow?.focus()
      },
    },
    {
      label: "Gateway Status",
      submenu: [
        {
          label: "Start Gateway",
          click: async () => {
            await gatewayManager.start()
            updateTrayMenu()
          },
        },
        {
          label: "Stop Gateway",
          click: () => {
            gatewayManager.stop()
            updateTrayMenu()
          },
        },
        {
          label: "Restart Gateway",
          click: async () => {
            await gatewayManager.restart()
            updateTrayMenu()
          },
        },
      ],
    },
    { type: "separator" },
    {
      label: "Quit Orquestr Pro",
      click: () => {
        gatewayManager.stop()
        app.exit(0)
      },
    },
  ])
  tray.setContextMenu(contextMenu)

  tray.on("click", () => {
    mainWindow?.show()
    mainWindow?.focus()
  })
}

function updateTrayMenu(): void {
  if (tray) {
    createTray()
  }
}

function registerGatewayHandlers(): void {
  ipcMain.handle("gateway:start", async () => {
    console.log("[IPC] gateway:start called")
    try {
      ensureGatewayConfig()
      await new Promise((r) => setTimeout(r, 200))
      const result = await gatewayManager.start()
      console.log("[IPC] gateway:start result:", result.status, result.error)
      return result
    } catch (err) {
      console.error("[IPC] gateway:start error:", err)
      throw err
    }
  })

  ipcMain.handle("gateway:stop", () => {
    console.log("[IPC] gateway:stop called")
    return gatewayManager.stop()
  })

  ipcMain.handle("gateway:restart", async () => {
    return gatewayManager.restart()
  })

  ipcMain.handle("gateway:status", () => {
    return gatewayManager.getStatus()
  })

  ipcMain.handle("gateway:port", () => {
    return gatewayManager.getPort()
  })

  ipcMain.handle("gateway:token", () => {
    return gatewayManager.getToken()
  })

  ipcMain.handle("gateway:ws-url", () => {
    return gatewayManager.getWsUrl()
  })
}

function registerConfigHandlers(): void {
  ipcMain.handle("config:get", () => {
    return readConfig()
  })

  ipcMain.handle("config:set", (_event, config: Record<string, unknown>) => {
    writeConfig(config)
    return readConfig()
  })

  ipcMain.handle("config:patch", (_event, patch: Record<string, unknown>) => {
    return patchConfig(patch)
  })

  ipcMain.handle("config:patch-model", (_event, modelId: string) => {
    // Update agents.defaults.model.primary in config
    return patchConfig({
      agents: {
        defaults: {
          model: {
            primary: modelId,
          },
        },
      },
    })
  })

  ipcMain.handle("config:path", () => {
    return getConfigPath()
  })

  ipcMain.handle("config:state-dir", () => {
    return getStateDir()
  })
}

function registerCutsHandlers(): void {
  ipcMain.handle("cuts:scan", async (_event, dirs: string[]) => {
    const { readdirSync, statSync } = await import("fs")
    const { join, basename } = await import("path")
    const { execSync } = await import("child_process")
    const results: Array<{
      name: string
      path: string
      size: string
      duration: string
      createdAt: string
      previewPath: string | null
    }> = []

    for (const dir of dirs) {
      try {
        const files = readdirSync(dir)
        for (const file of files) {
          if (!file.endsWith("_final.mp4") && !file.endsWith(".mp4")) continue
          if (file.includes("preview") || file.includes("_preview")) continue
          const fullPath = join(dir, file)
          try {
            const stat = statSync(fullPath)
            const sizeMB = (stat.size / (1024 * 1024)).toFixed(1) + " MB"
            let duration = ""
            try {
              const probe = execSync(
                `ffprobe -v error -show_entries format=duration -of csv=p=0 "${fullPath}"`,
                { timeout: 5000 }
              ).toString().trim()
              const secs = parseFloat(probe)
              if (!isNaN(secs)) {
                const m = Math.floor(secs / 60)
                const s = Math.floor(secs % 60)
                duration = `${m}:${s.toString().padStart(2, "0")}`
              }
            } catch {}

            const previewName = file.replace(".mp4", "_preview.jpg").replace("_final_preview", "_preview")
            const previewPath = readdirSync(dir).includes(previewName) ? join(dir, previewName) : null

            results.push({
              name: basename(file, ".mp4").replace("_final", "").replace(/_/g, " "),
              path: fullPath,
              size: sizeMB,
              duration,
              createdAt: stat.mtime.toISOString(),
              previewPath,
            })
          } catch {}
        }
      } catch {}
    }

    results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    return results
  })

  ipcMain.handle("cuts:open", async (_event, filePath: string) => {
    shell.openPath(filePath)
  })

  ipcMain.handle("cuts:show-in-folder", async (_event, filePath: string) => {
    shell.showItemInFolder(filePath)
  })
}

function registerFetchHandlers(): void {
  ipcMain.handle("fetch:json", async (_event, url: string) => {
    try {
      const res = await fetch(url)
      if (!res.ok) return { error: `HTTP ${res.status}` }
      return { data: await res.json() }
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Fetch failed" }
    }
  })

  ipcMain.handle("fetch:post", async (_event, url: string, body: unknown) => {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) return { error: `HTTP ${res.status}` }
      return { data: await res.json() }
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Fetch failed" }
    }
  })

  // Authenticated fetch for Privy API
  ipcMain.handle("fetch:privy", async (_event, method: string, path: string, body?: unknown) => {
    try {
      const { existsSync: fsExists, readFileSync: fsRead } = require("fs") as typeof import("fs")
      const { join: pathJoin } = require("path") as typeof import("path")
      const privyPath = pathJoin(getStateDir(), "privy.json")
      if (!fsExists(privyPath)) return { error: "Privy not configured" }
      const privy = JSON.parse(fsRead(privyPath, "utf-8"))
      if (!privy.appId || !privy.appSecret) return { error: "Privy credentials incomplete" }

      const auth = Buffer.from(`${privy.appId}:${privy.appSecret}`).toString("base64")
      const headers: Record<string, string> = {
        "Authorization": `Basic ${auth}`,
        "privy-app-id": privy.appId,
        "Content-Type": "application/json",
      }

      const fetchOpts: RequestInit = { method, headers }
      if (body && (method === "POST" || method === "PUT" || method === "PATCH")) {
        fetchOpts.body = JSON.stringify(body)
      }

      const res = await fetch(`https://api.privy.io${path}`, fetchOpts)
      if (!res.ok) {
        const text = await res.text()
        return { error: `HTTP ${res.status}: ${text.slice(0, 200)}` }
      }
      const data = await res.json()
      return { data }
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Privy API call failed" }
    }
  })
}

function registerPrivyHandlers(): void {
  const privyPath = () => {
    const { join } = require("path") as typeof import("path")
    return join(getStateDir(), "privy.json")
  }

  const readPrivy = (): Record<string, string> => {
    const { existsSync, readFileSync } = require("fs") as typeof import("fs")
    const p = privyPath()
    if (!existsSync(p)) return {}
    try { return JSON.parse(readFileSync(p, "utf-8")) } catch { return {} }
  }

  const writePrivy = (data: Record<string, string>) => {
    const { writeFileSync } = require("fs") as typeof import("fs")
    writeFileSync(privyPath(), JSON.stringify(data, null, 2), { mode: 0o600 })
  }

  ipcMain.handle("privy:get-config", () => {
    const privy = readPrivy()
    return { appId: privy.appId || "", hasSecret: !!privy.appSecret }
  })

  ipcMain.handle("privy:set-config", (_event, appId: string, appSecret: string) => {
    const current = readPrivy()
    if (appId) current.appId = appId
    if (appSecret) current.appSecret = appSecret
    writePrivy(current)
    return { success: true }
  })

  ipcMain.handle("privy:get-secret", () => {
    return readPrivy().appSecret || ""
  })
}

function registerCredentialsHandlers(): void {
  const { existsSync, readFileSync, writeFileSync } = require("fs") as typeof import("fs")
  const { join } = require("path") as typeof import("path")

  const SUPPORTED_PROVIDERS = [
    // --- API Key providers ---
    { id: "anthropic", name: "Anthropic", envVar: "ANTHROPIC_API_KEY", color: "#D97706", authTypes: ["API Key"], description: "Claude models (Opus, Sonnet, Haiku)" },
    { id: "openai", name: "OpenAI", envVar: "OPENAI_API_KEY", color: "#10B981", authTypes: ["API Key"], description: "GPT-4, o3, and other OpenAI models" },
    { id: "google", name: "Google AI", envVar: "GEMINI_API_KEY", color: "#3B82F6", authTypes: ["API Key"], description: "Gemini models (API key)" },
    { id: "openrouter", name: "OpenRouter", envVar: "OPENROUTER_API_KEY", color: "#8B5CF6", authTypes: ["API Key"], description: "Access 200+ models from all providers" },
    { id: "xai", name: "xAI (Grok)", envVar: "XAI_API_KEY", color: "#EF4444", authTypes: ["API Key"], description: "Grok models with X/Twitter integration" },
    { id: "groq", name: "Groq", envVar: "GROQ_API_KEY", color: "#F97316", authTypes: ["API Key"], description: "Ultra-fast inference (Llama, Mixtral)" },
    { id: "mistral", name: "Mistral AI", envVar: "MISTRAL_API_KEY", color: "#FF6B35", authTypes: ["API Key"], description: "Mistral, Mixtral, and Codestral models" },
    { id: "deepseek", name: "DeepSeek", envVar: "DEEPSEEK_API_KEY", color: "#0EA5E9", authTypes: ["API Key"], description: "DeepSeek reasoning and coding models" },
    { id: "together", name: "Together AI", envVar: "TOGETHER_API_KEY", color: "#22D3EE", authTypes: ["API Key"], description: "Open-source models hosted (Llama, Qwen, etc.)" },
    { id: "cerebras", name: "Cerebras", envVar: "CEREBRAS_API_KEY", color: "#A855F7", authTypes: ["API Key"], description: "Ultra-fast inference on custom hardware" },
    { id: "perplexity", name: "Perplexity", envVar: "PERPLEXITY_API_KEY", color: "#06B6D4", authTypes: ["API Key"], description: "Search-augmented AI models" },
    { id: "venice", name: "Venice AI", envVar: "VENICE_API_KEY", color: "#EC4899", authTypes: ["API Key"], description: "Privacy-focused uncensored models" },
    // --- OAuth providers ---
    { id: "anthropic-oauth", name: "Anthropic (OAuth)", envVar: "ANTHROPIC_OAUTH_TOKEN", color: "#D97706", authTypes: ["OAuth Token"], description: "Claude Max/Pro subscription — unlimited usage, run 'openclaw auth login anthropic'" },
    { id: "google-antigravity", name: "Google Antigravity (OAuth)", envVar: "GOOGLE_ANTIGRAVITY_OAUTH_TOKEN", color: "#3B82F6", authTypes: ["OAuth Token"], description: "Free Gemini via Google account — run 'openclaw auth login google-antigravity'" },
    { id: "google-gemini-cli", name: "Google Gemini CLI (OAuth)", envVar: "GOOGLE_GEMINI_CLI_OAUTH_TOKEN", color: "#3B82F6", authTypes: ["OAuth Token"], description: "Gemini CLI auth — run 'openclaw auth login google-gemini-cli'" },
    { id: "copilot", name: "GitHub Copilot (OAuth)", envVar: "COPILOT_GITHUB_TOKEN", color: "#6E7681", authTypes: ["OAuth Token"], description: "Use Copilot subscription for models — run 'openclaw auth login copilot'" },
    { id: "minimax-portal", name: "MiniMax (OAuth)", envVar: "MINIMAX_OAUTH_TOKEN", color: "#FF4081", authTypes: ["OAuth Token"], description: "MiniMax portal models — run 'openclaw auth login minimax-portal'" },
    { id: "qwen-portal", name: "Qwen (OAuth)", envVar: "QWEN_OAUTH_TOKEN", color: "#7C3AED", authTypes: ["OAuth Token"], description: "Alibaba Qwen models — run 'openclaw auth login qwen-portal'" },
    { id: "chutes", name: "Chutes (OAuth)", envVar: "CHUTES_OAUTH_TOKEN", color: "#14B8A6", authTypes: ["OAuth Token"], description: "Chutes AI models — run 'openclaw auth login chutes'" },
    // --- Local ---
    { id: "ollama", name: "Ollama", envVar: "", color: "#6B7280", authTypes: ["Local"], description: "Run models locally (Llama, Mistral, etc.)" },
  ]

  const credsPath = () => join(getStateDir(), "credentials.json")

  const readCreds = (): Record<string, string> => {
    const p = credsPath()
    if (!existsSync(p)) return {}
    try {
      return JSON.parse(readFileSync(p, "utf-8"))
    } catch {
      return {}
    }
  }

  const writeCreds = (data: Record<string, string>) => {
    writeFileSync(credsPath(), JSON.stringify(data, null, 2), { mode: 0o600 })
  }

  const maskKey = (key: string): string => {
    if (!key || key.length < 12) return "••••••••"
    return key.slice(0, 8) + "..." + key.slice(-4)
  }

  // Get credentials (masked for UI display)
  ipcMain.handle("credentials:get", () => {
    const creds = readCreds()
    const result: Record<string, { configured: boolean; masked: string }> = {}
    
    for (const provider of SUPPORTED_PROVIDERS) {
      if (!provider.envVar) continue // Skip Ollama (local)
      const hasKey = !!creds[provider.envVar]
      result[provider.envVar] = {
        configured: hasKey,
        masked: hasKey ? maskKey(creds[provider.envVar]) : "",
      }
    }
    
    return result
  })

  // Sanitize credential value: strip all whitespace (common copy-paste issue)
  const sanitizeCredential = (value: string): string => {
    return value.replace(/\s+/g, "").trim()
  }

  // Set a credential
  ipcMain.handle("credentials:set", (_event, envVar: string, value: string) => {
    const creds = readCreds()
    const cleanValue = sanitizeCredential(value || "")
    if (cleanValue) {
      creds[envVar] = cleanValue
    }
    writeCreds(creds)

    // Auto-set default model based on first configured provider
    const MODEL_MAP: Record<string, string> = {
      "ANTHROPIC_API_KEY": "anthropic/claude-sonnet-4-5",
      "ANTHROPIC_OAUTH_TOKEN": "anthropic/claude-sonnet-4-5",
      "OPENAI_API_KEY": "openai/gpt-5.2",
      "GEMINI_API_KEY": "google/gemini-3-flash-preview",
      "OPENROUTER_API_KEY": "openrouter/auto",
      "XAI_API_KEY": "xai/grok-41-fast",
      "GROQ_API_KEY": "groq/llama-4-scout-17b-16e-instruct",
      "MISTRAL_API_KEY": "mistral/mistral-large-latest",
      "DEEPSEEK_API_KEY": "deepseek/deepseek-chat",
      "COPILOT_GITHUB_TOKEN": "copilot/claude-sonnet-4-5",
      "GOOGLE_ANTIGRAVITY_OAUTH_TOKEN": "google/gemini-3-flash-preview",
      "GOOGLE_GEMINI_CLI_OAUTH_TOKEN": "google/gemini-3-flash-preview",
    }

    if (MODEL_MAP[envVar]) {
      const config = readConfig()
      const agents = (config.agents || {}) as Record<string, unknown>
      const defaults = (agents.defaults || {}) as Record<string, unknown>
      const model = (defaults.model || {}) as Record<string, unknown>
      // Only auto-set if no model is configured yet
      if (!model.primary) {
        model.primary = MODEL_MAP[envVar]
        defaults.model = model
        agents.defaults = defaults
        config.agents = agents
        writeConfig(config)
      }
    }

    const { existsSync: fsExists, mkdirSync: fsMkdir, readFileSync: fsRead, writeFileSync: fsWrite } = require("fs") as typeof import("fs")
    const { join: pathJoin } = require("path") as typeof import("path")
    const agentDir = pathJoin(getStateDir(), "agents", "main", "agent")
    if (!fsExists(agentDir)) fsMkdir(agentDir, { recursive: true })

    // ── Write auth-profiles.json (OpenClaw's credential resolver) ──
    const authProfilesPath = pathJoin(agentDir, "auth-profiles.json")
    let authStore: Record<string, unknown> = {}
    try { if (fsExists(authProfilesPath)) authStore = JSON.parse(fsRead(authProfilesPath, "utf-8")) } catch {}
    if (!authStore.profiles) authStore.profiles = {}
    const profiles = authStore.profiles as Record<string, unknown>

    // auth-profiles.json format: profiles are FLAT objects (NOT nested under "credential")
    // e.g. { "anthropic:default": { type: "token", provider: "anthropic", token: "sk-..." } }
    const AUTH_PROFILE_MAP: Record<string, { profileId: string; provider: string; type: string }> = {
      "ANTHROPIC_API_KEY": { profileId: "anthropic:default", provider: "anthropic", type: "api_key" },
      "ANTHROPIC_OAUTH_TOKEN": { profileId: "anthropic:default", provider: "anthropic", type: "token" },
      "OPENAI_API_KEY": { profileId: "openai:default", provider: "openai", type: "api_key" },
      "GEMINI_API_KEY": { profileId: "google:default", provider: "google", type: "api_key" },
      "OPENROUTER_API_KEY": { profileId: "openrouter:default", provider: "openrouter", type: "api_key" },
      "XAI_API_KEY": { profileId: "xai:default", provider: "xai", type: "api_key" },
      "GROQ_API_KEY": { profileId: "groq:default", provider: "groq", type: "api_key" },
      "MISTRAL_API_KEY": { profileId: "mistral:default", provider: "mistral", type: "api_key" },
      "DEEPSEEK_API_KEY": { profileId: "deepseek:default", provider: "deepseek", type: "api_key" },
      "COPILOT_GITHUB_TOKEN": { profileId: "github-copilot:default", provider: "github-copilot", type: "token" },
    }

    const profileMapping = AUTH_PROFILE_MAP[envVar]
    if (profileMapping && cleanValue) {
      if (profileMapping.type === "api_key") {
        profiles[profileMapping.profileId] = {
          type: "api_key",
          provider: profileMapping.provider,
          key: cleanValue,
        }
      } else {
        // "token" type — used for OAuth tokens pasted directly (e.g. sk-ant-oat01-...)
        profiles[profileMapping.profileId] = {
          type: "token",
          provider: profileMapping.provider,
          token: cleanValue,
        }
      }
      authStore.profiles = profiles
      fsWrite(authProfilesPath, JSON.stringify(authStore, null, 2), { mode: 0o600 })
    }

    // ── Write auth.json (pi-coding-agent's AuthStorage) ──
    // This is the file that the underlying model runtime actually reads
    const authJsonPath = pathJoin(agentDir, "auth.json")
    let piAuth: Record<string, unknown> = {}
    try { if (fsExists(authJsonPath)) piAuth = JSON.parse(fsRead(authJsonPath, "utf-8")) } catch {}

    // Map env vars to pi-coding-agent provider IDs
    const PI_AUTH_MAP: Record<string, { provider: string }> = {
      "ANTHROPIC_API_KEY": { provider: "anthropic" },
      "ANTHROPIC_OAUTH_TOKEN": { provider: "anthropic" },
      "OPENAI_API_KEY": { provider: "openai" },
      "GEMINI_API_KEY": { provider: "google" },
      "OPENROUTER_API_KEY": { provider: "openrouter" },
      "XAI_API_KEY": { provider: "xai" },
      "GROQ_API_KEY": { provider: "groq" },
      "MISTRAL_API_KEY": { provider: "mistral" },
      "DEEPSEEK_API_KEY": { provider: "deepseek" },
      "COPILOT_GITHUB_TOKEN": { provider: "github-copilot" },
    }

    const piMapping = PI_AUTH_MAP[envVar]
    if (piMapping && cleanValue) {
      // Detect if it's an OAuth token (Anthropic Max: sk-ant-oat01-...)
      const isOAuthToken = cleanValue.includes("sk-ant-oat")
      if (isOAuthToken) {
        // Store as api_key type (AuthStorage treats it the same — the provider
        // detects OAuth via isOAuthToken() check on the actual key string)
        piAuth[piMapping.provider] = {
          type: "api_key",
          key: cleanValue,
        }
      } else {
        piAuth[piMapping.provider] = {
          type: "api_key",
          key: cleanValue,
        }
      }
      fsWrite(authJsonPath, JSON.stringify(piAuth, null, 2), { mode: 0o600 })
    }

    return { success: true }
  })

  // Delete a credential
  ipcMain.handle("credentials:delete", (_event, envVar: string) => {
    const creds = readCreds()
    delete creds[envVar]
    writeCreds(creds)
    return { success: true }
  })

  // List supported providers
  ipcMain.handle("credentials:list-providers", () => {
    return SUPPORTED_PROVIDERS
  })
}

function registerAppHandlers(): void {
  ipcMain.handle("app:version", () => {
    return app.getVersion()
  })

  ipcMain.handle("app:platform", () => {
    return process.platform
  })

  ipcMain.handle("app:arch", () => {
    return process.arch
  })

  ipcMain.handle("app:node-version", () => {
    return process.version
  })
}

function registerNavigationHandlers(): void {
  ipcMain.on("navigate", (_event, path: string) => {
    mainWindow?.webContents.send("navigate", path)
  })
}

protocol.registerSchemesAsPrivileged([
  {
    scheme: "orquestr-media",
    privileges: { stream: true, bypassCSP: true, supportFetchAPI: true },
  },
])

app.whenReady().then(() => {
  electronApp.setAppUserModelId("ai.orquestr.pro")

  const { session } = require("electron") as typeof import("electron")
  session.defaultSession.webRequest.onBeforeSendHeaders(
    { urls: ["ws://127.0.0.1:*/*", "ws://localhost:*/*"] },
    (details, callback) => {
      // Use the actual gateway port (dynamic, may not be 18789)
      const port = gatewayManager.getPort()
      details.requestHeaders["Origin"] = `http://127.0.0.1:${port}`
      callback({ requestHeaders: details.requestHeaders })
    }
  )

  protocol.handle("orquestr-media", (request) => {
    let filePath = request.url.replace("orquestr-media://", "")
    filePath = decodeURIComponent(filePath)
    if (!filePath.startsWith("/")) filePath = "/" + filePath
    console.log("[Media] Serving:", filePath)
    return net.fetch(pathToFileURL(filePath).href)
  })

  app.on("browser-window-created", (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  registerGatewayHandlers()
  registerConfigHandlers()
  registerCutsHandlers()
  registerFetchHandlers()
  registerPrivyHandlers()
  registerCredentialsHandlers()
  registerAppHandlers()
  registerNavigationHandlers()

  createTray()
  createWindow()

  // Auto-start gateway on launch
  setTimeout(async () => {
    try {
      console.log("[AutoStart] Starting gateway...")
      const result = await gatewayManager.start()
      console.log("[AutoStart] Gateway started:", result.status)
      updateTrayMenu()
    } catch (err) {
      console.error("[AutoStart] Gateway start failed:", err)
    }
  }, 500)

  // Auto-updater setup
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.on("update-available", (info) => {
    console.log("[AutoUpdater] Update available:", info.version)
    mainWindow?.webContents.send("update-available", info)
  })
  autoUpdater.on("update-downloaded", (info) => {
    console.log("[AutoUpdater] Update downloaded:", info.version)
    mainWindow?.webContents.send("update-downloaded", info)
    dialog.showMessageBox(mainWindow!, {
      type: "info",
      title: "Update Ready",
      message: `Version ${info.version} has been downloaded. Restart to apply the update.`,
      buttons: ["Restart Now", "Later"],
    }).then((result) => {
      if (result.response === 0) {
        autoUpdater.quitAndInstall()
      }
    })
  })
  autoUpdater.on("error", (err) => {
    console.log("[AutoUpdater] Error:", err.message)
  })
  // Check for updates after a delay (don't block startup)
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(() => {})
  }, 5000)

  // IPC for manual update check
  ipcMain.handle("updater:check", () => autoUpdater.checkForUpdates())
  ipcMain.handle("updater:install", () => autoUpdater.quitAndInstall())

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    } else {
      mainWindow?.show()
      mainWindow?.focus()
    }
  })
})

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    gatewayManager.stop()
    app.quit()
  }
})

app.on("before-quit", () => {
  isQuitting = true
  gatewayManager.stop()
})
