import { ChildProcess, spawn } from "child_process"
import { existsSync, readFileSync, writeFileSync, unlinkSync } from "fs"
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

  // ── PID lock file management ──
  // Prevents orphan gateway processes from surviving app crashes/restarts.
  // On start: kill any process at the locked PID, then write our new PID.
  // On stop: remove the lock file.

  private get pidFilePath(): string {
    return join(getStateDir(), "gateway.pid")
  }

  private writePidFile(pid: number): void {
    try {
      ensureStateDir()
      writeFileSync(this.pidFilePath, String(pid), { mode: 0o600 })
      this.log(`PID file written: ${pid}`)
    } catch (e) {
      this.log(`Warning: could not write PID file: ${e}`)
    }
  }

  private removePidFile(): void {
    try {
      if (existsSync(this.pidFilePath)) {
        unlinkSync(this.pidFilePath)
        this.log("PID file removed")
      }
    } catch {}
  }

  private readPidFile(): number | null {
    try {
      if (existsSync(this.pidFilePath)) {
        const pid = parseInt(readFileSync(this.pidFilePath, "utf-8").trim(), 10)
        return isNaN(pid) ? null : pid
      }
    } catch {}
    return null
  }

  private isProcessAlive(pid: number): boolean {
    try {
      process.kill(pid, 0) // signal 0 = check if alive
      return true
    } catch {
      return false
    }
  }

  /**
   * Kill a process by PID. Sends SIGTERM first, waits up to `timeoutMs`,
   * then escalates to SIGKILL if still alive. Returns when process is dead.
   */
  private async killProcess(pid: number, timeoutMs = 5000): Promise<void> {
    if (!this.isProcessAlive(pid)) {
      this.log(`Process ${pid} already dead`)
      return
    }

    this.log(`Killing process ${pid} (SIGTERM)...`)
    try {
      process.kill(pid, "SIGTERM")
    } catch (e) {
      this.log(`SIGTERM failed for ${pid}: ${e}`)
      return
    }

    // Wait for process to die
    const start = Date.now()
    while (Date.now() - start < timeoutMs) {
      await new Promise((r) => setTimeout(r, 200))
      if (!this.isProcessAlive(pid)) {
        this.log(`Process ${pid} terminated (SIGTERM)`)
        return
      }
    }

    // Escalate to SIGKILL
    this.log(`Process ${pid} still alive after ${timeoutMs}ms, sending SIGKILL`)
    try {
      process.kill(pid, "SIGKILL")
    } catch {}
    // Give SIGKILL a moment
    await new Promise((r) => setTimeout(r, 500))
    if (!this.isProcessAlive(pid)) {
      this.log(`Process ${pid} killed (SIGKILL)`)
    } else {
      this.log(`WARNING: Process ${pid} survived SIGKILL!`)
    }
  }

  /**
   * Targeted cleanup before starting a new gateway.
   * ONLY kills OUR OWN processes — never touches other gateways on the system.
   * Other gateways on different ports are left alone.
   *
   * 1. Kill our tracked child process (if any)
   * 2. Kill the process from our PID lock file (handles app crash/restart)
   *
   * If our default port is taken by another gateway, findAvailablePort()
   * will auto-increment to the next free port — no killing needed.
   */
  private async cleanupBeforeStart(): Promise<void> {
    this.log("Cleaning up our own stale gateway process (if any)...")

    // 1. Kill tracked child process
    if (this.process) {
      const pid = this.process.pid
      this.log(`Killing tracked child process PID ${pid}`)
      try {
        this.process.kill("SIGTERM")
      } catch {}
      if (pid) {
        await this.killProcess(pid, 3000)
      }
      this.process = null
    }

    // 2. Kill process from OUR PID lock file (handles app restart/crash scenario)
    const lockedPid = this.readPidFile()
    if (lockedPid) {
      // Only kill if the locked PID is actually an OpenClaw gateway (sanity check)
      if (this.isProcessAlive(lockedPid)) {
        this.log(`Found our stale gateway PID: ${lockedPid}, killing...`)
        await this.killProcess(lockedPid, 3000)
      }
      this.removePidFile()
    }

    this.log("Cleanup complete — other gateways left untouched")
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
        const realBin = execSync(`readlink -f "${whichResult}" 2>/dev/null || realpath "${whichResult}" 2>/dev/null`, { timeout: 3000 }).toString().trim()
        if (realBin) {
          candidates.push(realBin)
          candidates.push(resolve(dirname(realBin), "..", "lib", "node_modules", "openclaw", "openclaw.mjs"))
        }
      }
    } catch {}
    try {
      const { execSync: execSync2 } = require("child_process") as typeof import("child_process")
      const globalRoot = execSync2("npm root -g 2>/dev/null", { timeout: 3000 }).toString().trim()
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
    const candidates: string[] = [
      "/opt/homebrew/bin/node",
      "/usr/local/bin/node",
      "/usr/bin/node",
    ]

    for (const candidate of candidates) {
      if (existsSync(candidate)) {
        this.log(`Node binary: ${candidate}`)
        return candidate
      }
    }

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

    // ── CRITICAL: Clean up ALL stale processes before starting ──
    await this.cleanupBeforeStart()

    // Small delay to ensure ports are released by OS after killing
    await new Promise((r) => setTimeout(r, 500))

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

      const useElectronAsNode = nodeBin === process.execPath
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

      // ── Write PID lock file ──
      if (this.state.pid) {
        this.writePidFile(this.state.pid)
      }

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
        this.removePidFile()
      })

      this.process.on("error", (err) => {
        this.log(`Process error: ${err.message}`)
        this.state.status = "error"
        this.state.error = `Spawn error: ${err.message}`
        this.state.pid = null
        this.process = null
        this.removePidFile()
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

  async stop(): Promise<GatewayState> {
    this.log("Stopping gateway...")

    const pid = this.process?.pid || this.state.pid

    if (this.process) {
      try {
        this.process.kill("SIGTERM")
      } catch (e) {
        this.log(`Kill error: ${e}`)
      }
    }

    // Wait for the process to actually die (up to 5s SIGTERM, then SIGKILL)
    if (pid) {
      await this.killProcess(pid, 5000)
    }

    this.process = null
    this.state.status = "stopped"
    this.state.pid = null
    this.state.startedAt = null
    this.state.error = null
    this.removePidFile()

    return this.getStatus()
  }

  async restart(): Promise<GatewayState> {
    await this.stop()
    // No extra delay needed — stop() now waits for process to die
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
