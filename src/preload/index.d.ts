import { ElectronAPI } from "@electron-toolkit/preload"

interface GatewayState {
  status: "stopped" | "starting" | "running" | "error"
  port: number
  pid: number | null
  error: string | null
  startedAt: number | null
  token: string
  logs: string[]
}

interface ClawBusinessAPI {
  gateway: {
    start: () => Promise<GatewayState>
    stop: () => Promise<GatewayState>
    restart: () => Promise<GatewayState>
    status: () => Promise<GatewayState>
    port: () => Promise<number>
    token: () => Promise<string>
    wsUrl: () => Promise<string>
  }
  config: {
    get: () => Promise<Record<string, unknown>>
    set: (config: Record<string, unknown>) => Promise<Record<string, unknown>>
    patch: (patch: Record<string, unknown>) => Promise<Record<string, unknown>>
    patchModel: (modelId: string) => Promise<Record<string, unknown>>
    path: () => Promise<string>
    stateDir: () => Promise<string>
  }
  app: {
    version: () => Promise<string>
    platform: () => Promise<string>
    arch: () => Promise<string>
    nodeVersion: () => Promise<string>
  }
  cuts: {
    scan: (dirs: string[]) => Promise<Array<{
      name: string
      path: string
      size: string
      duration: string
      createdAt: string
      previewPath: string | null
    }>>
    open: (filePath: string) => Promise<void>
    showInFolder: (filePath: string) => Promise<void>
  }
  fetch: {
    json: (url: string) => Promise<{ data?: unknown; error?: string }>
    post: (url: string, body: unknown) => Promise<{ data?: unknown; error?: string }>
    privy: (method: string, path: string, body?: unknown) => Promise<{ data?: unknown; error?: string }>
  }
  privy: {
    getConfig: () => Promise<{ appId: string; hasSecret: boolean }>
    setConfig: (appId: string, appSecret: string) => Promise<{ success: boolean }>
    getSecret: () => Promise<string>
  }
  channels: {
    list: () => Promise<Record<string, unknown>>
    save: (channelType: string, config: Record<string, unknown>) => Promise<{ success?: boolean; error?: string }>
    remove: (channelType: string) => Promise<{ success?: boolean; error?: string }>
  }
  agent: {
    identity: () => Promise<{ name: string; emoji?: string }>
  }
  credentials: {
    get: () => Promise<Record<string, { configured: boolean; masked: string }>>
    set: (envVar: string, value: string) => Promise<{ success: boolean }>
    delete: (envVar: string) => Promise<{ success: boolean }>
    listProviders: () => Promise<Array<{
      id: string
      name: string
      envVar: string
      color: string
      authTypes: string[]
      description: string
    }>>
  }
  navigation: {
    onNavigate: (callback: (path: string) => void) => void
  }
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: ClawBusinessAPI
  }
}
