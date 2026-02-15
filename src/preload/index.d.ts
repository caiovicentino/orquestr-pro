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
