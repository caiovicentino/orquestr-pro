import { ChildProcess, spawn } from "child_process"
import { existsSync, readFileSync } from "fs"
import { join, resolve, dirname } from "path"
import { app } from "electron"
import { randomUUID } from "crypto"
import { homedir } from "os"
import { getStateDir, getConfigPath, ensureStateDir, ensureGatewayConfig } from "./config"

export type GatewayStatus = "stopped" | "starting" | "running" | "error"

export interface GatewayState {
  status: GatewayStatus
  port: number
  pid: number | null
  error: string | null
  startedAt: number | null
  token: string
  logs: string[]
}

function readTokenFromConfig(): string {
  try {
    const configPath = getConfigPath()
    if (existsSync(configPath)) {
      const raw = readFileSync(configPath, "utf-8")
      const config = JSON.parse(raw)
      if (config?.gateway?.auth?.token) {
        return config.gateway.auth.token
      }
    }
  } catch {}
  return randomUUID()
}

export class GatewayManager {
  private process: ChildProcess | null = null
  private logs: string[] = []
  private state: GatewayState = {
    status: "stopped",
    port: 18789,
    pid: null,
    error: null,
    startedAt: null,
    token: readTokenFromConfig(),
    logs: [],
  }

  private log(msg: string): void {
    const entry = `[${new Date().toISOString()}] ${msg}`
    console.log(`[GatewayManager] ${msg}`)
    this.logs.push(entry)
    if (this.logs.length > 200) this.logs.shift()
    this.state.logs = [...this.logs]
  }

  private resolveOpenClawEntry(): string | null {
    const candidates: string[] = []

    const appPath = app.getAppPath()
    this.log(`app.getAppPath() = ${appPath}`)
    this.log(`app.isPackaged = ${app.isPackaged}`)
    this.log(`__dirname = ${__dirname}`)

    // Packaged app: openclaw is bundled in extraResources
    if (app.isPackaged) {
      candidates.push(join(process.resourcesPath, "openclaw", "openclaw.mjs"))
    }

    // Development / local paths
    candidates.push(
      resolve(appPath, "..", "openclaw", "openclaw.mjs"),
      resolve(appPath, "..", "..", "openclaw", "openclaw.mjs"),
      resolve(__dirname, "..", "..", "..", "openclaw", "openclaw.mjs"),
      resolve(__dirname, "..", "..", "openclaw", "openclaw.mjs"),
      join(homedir(), "clawbusiness", "openclaw", "openclaw.mjs"),
      join(homedir(), ".openclaw", "openclaw", "openclaw.mjs"),
    )

    // Try global installs (npm -g, homebrew, etc.)
    try {
      const { execSync } = require("child_process") as typeof import("child_process")
      const whichResult = execSync("which openclaw 2>/dev/null", { timeout: 3000 }).toString().trim()
      if (whichResult) {
        // 'which openclaw' returns the bin symlink — resolve to find openclaw.mjs
        const realBin = execSync(`readlink -f "${whichResult}" 2>/dev/null || realpath "${whichResult}" 2>/dev/null`, { timeout: 3000 }).toString().trim()
        if (realBin) {
          candidates.push(realBin)
          candidates.push(resolve(dirname(realBin), "..", "lib", "node_modules", "openclaw", "openclaw.mjs"))
        }
      }
    } catch {}
    try {
      const { execSync } = require("child_process") as typeof import("child_process")
      const globalRoot = execSync("npm root -g 2>/dev/null", { timeout: 3000 }).toString().trim()
      if (globalRoot) {
        candidates.push(join(globalRoot, "openclaw", "openclaw.mjs"))
      }
    } catch {}

    for (const candidate of candidates) {
      this.log(`Checking: ${candidate} -> ${existsSync(candidate) ? "FOUND" : "not found"}`)
      if (existsSync(candidate)) return candidate
    }

    return null
  }

  private resolveNodeBin(): string {
    // In packaged app, use Electron's bundled Node.js (process.execPath points to the Electron binary)
    // But we need a standalone node — check if Electron can run as node with ELECTRON_RUN_AS_NODE
    const candidates: string[] = []

    // Prefer system Node.js if available (more compatible)
    candidates.push(
      "/opt/homebrew/bin/node",
      "/usr/local/bin/node",
      "/usr/bin/node",
    )

    for (const candidate of candidates) {
      if (existsSync(candidate)) {
        this.log(`Node binary: ${candidate}`)
        return candidate
      }
    }

    // Fallback: use Electron's own binary with ELECTRON_RUN_AS_NODE=1
    // This makes Electron behave as a regular Node.js runtime
    this.log(`Node binary: using Electron as Node (${process.execPath})`)
    return process.execPath
  }

  private async findAvailablePort(startPort: number): Promise<number> {
    const net = await import("net")
    const { createServer } = net
    return new Promise((resolve) => {
      const server = createServer()
      server.listen(startPort, "127.0.0.1", () => {
        server.close(() => resolve(startPort))
      })
      server.on("error", () => {
        this.log(`Port ${startPort} in use, trying ${startPort + 1}`)
        resolve(this.findAvailablePort(startPort + 1))
      })
    })
  }

  async start(): Promise<GatewayState> {
    if (this.state.status === "running" && this.process) {
      this.log("Gateway already running")
      return this.getStatus()
    }

    this.state.status = "starting"
    this.state.error = null
    this.log("Starting gateway...")

    // Find an available port (auto-increment if default is taken by system OpenClaw)
    const port = await this.findAvailablePort(this.state.port)
    if (port !== this.state.port) {
      this.log(`Default port ${this.state.port} in use, using ${port}`)
      this.state.port = port
    }

    const entry = this.resolveOpenClawEntry()
    if (!entry) {
      this.state.status = "error"
      this.state.error = "OpenClaw engine not found. Please reinstall Orquestr Pro or contact support at orquestr.ai"
      this.log(`ERROR: ${this.state.error}`)
      return this.getStatus()
    }

    this.log(`Using entry: ${entry}`)
    const cwd = dirname(entry)
    this.log(`CWD: ${cwd}`)

    const nodeBin = this.resolveNodeBin()

    try {
      const args = [
        entry,
        "gateway",
        "--port", String(this.state.port),
        "--allow-unconfigured",
        "--dev",
      ]

      this.log(`Spawning: ${nodeBin} ${args.join(" ")}`)

      // If using Electron as Node runtime, set ELECTRON_RUN_AS_NODE
      const useElectronAsNode = nodeBin === process.execPath
      // Use Orquestr Pro's own isolated state dir (not ~/.openclaw)
      const stateDir = getStateDir()
      const configPath = getConfigPath()
      const spawnEnv: Record<string, string> = {
        ...process.env as Record<string, string>,
        NODE_ENV: "production",
        FORCE_COLOR: "0",
        OPENCLAW_STATE_DIR: stateDir,
        OPENCLAW_CONFIG_PATH: configPath,
      }
      if (useElectronAsNode) {
        spawnEnv.ELECTRON_RUN_AS_NODE = "1"
        this.log("Using ELECTRON_RUN_AS_NODE=1")
      }
      this.log(`Config: ${configPath}`)
      this.log(`State dir: ${stateDir}`)

      // Load user credentials (API keys) into gateway env
      try {
        const credsPath = join(getStateDir(), "credentials.json")
        if (existsSync(credsPath)) {
          const creds = JSON.parse(readFileSync(credsPath, "utf-8"))
          for (const [key, value] of Object.entries(creds)) {
            if (typeof value === "string" && value.trim()) {
              spawnEnv[key] = value
            }
          }
          this.log(`Loaded ${Object.keys(creds).length} credential(s)`)
        }
      } catch (e) {
        this.log(`Warning: could not load credentials: ${e}`)
      }

      // Ensure config file exists before spawning
      ensureStateDir()
      ensureGatewayConfig()
      this.log(`Config file exists: ${existsSync(configPath)}`)
      if (existsSync(configPath)) {
        try {
          const configContent = readFileSync(configPath, "utf-8")
          this.log(`Config content: ${configContent.slice(0, 200)}`)
        } catch {}
      }

      this.process = spawn(nodeBin, args, {
        stdio: ["ignore", "pipe", "pipe"],
        env: spawnEnv,
        detached: false,
        cwd,
      })

      this.state.pid = this.process.pid ?? null
      this.log(`Process spawned with PID: ${this.state.pid}`)

      this.process.stdout?.on("data", (data: Buffer) => {
        const chunk = data.toString().trim()
        if (chunk) this.log(`[stdout] ${chunk.slice(0, 300)}`)

        if (this.state.status === "starting") {
          const lower = chunk.toLowerCase()
          if (
            lower.includes("listen") ||
            lower.includes("gateway") ||
            lower.includes("ready") ||
            lower.includes("started") ||
            lower.includes(String(this.state.port))
          ) {
            this.state.status = "running"
            this.state.startedAt = Date.now()
            this.log("Gateway is RUNNING")
          }
        }
      })

      this.process.stderr?.on("data", (data: Buffer) => {
        const chunk = data.toString().trim()
        if (chunk) this.log(`[stderr] ${chunk.slice(0, 300)}`)
      })

      this.process.on("exit", (code, signal) => {
        this.log(`Process exited: code=${code}, signal=${signal}`)
        this.state.status = code === 0 ? "stopped" : "error"
        this.state.pid = null
        if (code !== 0 && code !== null) {
          this.state.error = `Gateway exited with code ${code}`
        }
        this.process = null
      })

      this.process.on("error", (err) => {
        this.log(`Process error: ${err.message}`)
        this.state.status = "error"
        this.state.error = `Spawn error: ${err.message}`
        this.state.pid = null
        this.process = null
      })

      await this.waitForReady(15000)
      this.log(`After wait: status=${this.state.status}`)

      return this.getStatus()
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error"
      this.log(`Exception: ${msg}`)
      this.state.status = "error"
      this.state.error = msg
      return this.getStatus()
    }
  }

  stop(): GatewayState {
    this.log("Stopping gateway...")
    if (this.process) {
      try {
        this.process.kill("SIGTERM")
      } catch (e) {
        this.log(`Kill error: ${e}`)
      }
      this.process = null
    }
    this.state.status = "stopped"
    this.state.pid = null
    this.state.startedAt = null
    this.state.error = null
    return this.getStatus()
  }

  async restart(): Promise<GatewayState> {
    this.stop()
    await new Promise((r) => setTimeout(r, 1000))
    return this.start()
  }

  getStatus(): GatewayState {
    return { ...this.state, logs: [...this.logs.slice(-20)] }
  }

  getPort(): number {
    return this.state.port
  }

  getToken(): string {
    return this.state.token
  }

  getWsUrl(): string {
    return `ws://127.0.0.1:${this.state.port}`
  }

  private waitForReady(timeoutMs: number): Promise<void> {
    return new Promise((resolve) => {
      const start = Date.now()
      const interval = setInterval(() => {
        if (this.state.status === "running" || this.state.status === "error") {
          clearInterval(interval)
          resolve()
          return
        }
        if (Date.now() - start > timeoutMs) {
          clearInterval(interval)
          if (this.state.status === "starting") {
            this.log("Timeout waiting for ready - marking as running anyway")
            this.state.status = "running"
            this.state.startedAt = Date.now()
          }
          resolve()
        }
      }, 500)
    })
  }
}
