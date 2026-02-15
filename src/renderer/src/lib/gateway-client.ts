import { randomUUID } from "@/lib/utils"

export type ConnectionState = "disconnected" | "connecting" | "connected" | "error"

export type EventHandler = (payload: Record<string, unknown>) => void

interface PendingRequest {
  resolve: (value: unknown) => void
  reject: (reason: Error) => void
  timer: ReturnType<typeof setTimeout>
}

export class GatewayClient {
  private ws: WebSocket | null = null
  private state: ConnectionState = "disconnected"
  private pendingRequests = new Map<string, PendingRequest>()
  private eventHandlers = new Map<string, Set<EventHandler>>()
  private stateListeners = new Set<(state: ConnectionState) => void>()
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectAttempt = 0
  private url = ""
  private token = ""
  private shouldReconnect = false
  private isConnecting = false

  connect(url: string, token: string): void {
    if (this.isConnecting || this.state === "connected") return
    this.url = url
    this.token = token
    this.shouldReconnect = true
    this.reconnectAttempt = 0
    this.clearReconnectTimer()
    this.doConnect()
  }

  disconnect(): void {
    this.shouldReconnect = false
    this.clearReconnectTimer()
    this.isConnecting = false
    if (this.ws) {
      try { this.ws.close(1000) } catch {}
      this.ws = null
    }
    this.setState("disconnected")
    this.rejectAll("Disconnected")
  }

  getState(): ConnectionState {
    return this.state
  }

  onStateChange(fn: (s: ConnectionState) => void): () => void {
    this.stateListeners.add(fn)
    return () => this.stateListeners.delete(fn)
  }

  on(event: string, fn: EventHandler): () => void {
    if (!this.eventHandlers.has(event)) this.eventHandlers.set(event, new Set())
    this.eventHandlers.get(event)!.add(fn)
    return () => this.eventHandlers.get(event)?.delete(fn)
  }

  async request<T = unknown>(method: string, params?: Record<string, unknown>, timeoutMs = 30000): Promise<T> {
    if (this.state !== "connected") throw new Error(`Not connected (${this.state})`)
    const id = randomUUID()
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(id)
        reject(new Error(`Timeout: ${method}`))
      }, timeoutMs)
      this.pendingRequests.set(id, { resolve: resolve as (v: unknown) => void, reject, timer })
      this.wsSend({ type: "req", id, method, params })
    })
  }

  async chatSend(sessionKey: string, message: string, opts?: Record<string, unknown>): Promise<unknown> {
    return this.request("chat.send", { sessionKey, message, deliver: false, idempotencyKey: randomUUID(), ...opts })
  }
  async chatHistory(sessionKey: string, limit?: number): Promise<unknown> {
    return this.request("chat.history", { sessionKey, limit })
  }
  async chatAbort(sessionKey: string): Promise<unknown> {
    return this.request("chat.abort", { sessionKey })
  }
  async sessionsList(params?: Record<string, unknown>): Promise<unknown> {
    return this.request("sessions.list", params)
  }
  async sessionsReset(sessionKey: string): Promise<unknown> {
    return this.request("sessions.reset", { sessionKey })
  }
  async sessionsDelete(sessionKey: string): Promise<unknown> {
    return this.request("sessions.delete", { sessionKey })
  }
  async sessionsCompact(sessionKey: string): Promise<unknown> {
    return this.request("sessions.compact", { sessionKey })
  }
  async agentRun(message: string, opts?: Record<string, unknown>): Promise<unknown> {
    return this.request("agent", { message, idempotencyKey: randomUUID(), ...opts })
  }
  async agentsList(): Promise<unknown> { return this.request("agents.list") }
  async agentsCreate(p: Record<string, unknown>): Promise<unknown> { return this.request("agents.create", p) }
  async agentsUpdate(p: Record<string, unknown>): Promise<unknown> { return this.request("agents.update", p) }
  async agentsDelete(id: string): Promise<unknown> { return this.request("agents.delete", { agentId: id }) }
  async channelsStatus(): Promise<unknown> { return this.request("channels.status") }
  async modelsList(): Promise<unknown> { return this.request("models.list") }
  async skillsStatus(): Promise<unknown> { return this.request("skills.status") }
  async skillsInstall(id: string): Promise<unknown> { return this.request("skills.install", { skillId: id }) }
  async cronList(): Promise<unknown> { return this.request("cron.list") }
  async cronAdd(p: Record<string, unknown>): Promise<unknown> { return this.request("cron.add", p) }
  async cronRemove(id: string): Promise<unknown> { return this.request("cron.remove", { jobId: id }) }
  async cronRun(id: string): Promise<unknown> { return this.request("cron.run", { jobId: id }) }
  async health(): Promise<unknown> { return this.request("health") }
  async status(): Promise<unknown> { return this.request("status") }
  async configGet(): Promise<unknown> { return this.request("config.get") }
  async configPatch(patch: Record<string, unknown>): Promise<unknown> { return this.request("config.patch", { patch }) }
  async nodeList(): Promise<unknown> { return this.request("node.list") }
  async usageStatus(): Promise<unknown> { return this.request("usage.status") }
  async usageCost(): Promise<unknown> { return this.request("usage.cost") }
  async logsTail(): Promise<unknown> { return this.request("logs.tail") }

  private doConnect(): void {
    if (this.isConnecting) return
    this.isConnecting = true
    this.setState("connecting")

    if (this.ws) {
      try { this.ws.close() } catch {}
      this.ws = null
    }

    try {
      this.ws = new WebSocket(this.url)
    } catch {
      this.isConnecting = false
      this.setState("error")
      this.scheduleReconnect()
      return
    }

    this.ws.onopen = () => {
      console.log("[GatewayClient] WebSocket opened, waiting for challenge...")
    }

    this.ws.onmessage = (ev) => {
      this.onMessage(ev.data as string)
    }

    this.ws.onclose = () => {
      console.log("[GatewayClient] WebSocket closed")
      this.isConnecting = false
      const wasConnected = this.state === "connected"
      this.setState("disconnected")
      this.rejectAll("Connection closed")
      if (this.shouldReconnect) {
        this.scheduleReconnect()
      }
    }

    this.ws.onerror = (err) => {
      console.log("[GatewayClient] WebSocket error")
      this.isConnecting = false
    }
  }

  private onMessage(raw: string): void {
    let frame: Record<string, unknown>
    try {
      frame = JSON.parse(raw)
    } catch {
      return
    }
    console.log("[GatewayClient] <<", frame.type, (frame as Record<string, unknown>).event || (frame as Record<string, unknown>).method || "", frame.ok !== undefined ? `ok=${frame.ok}` : "", raw.length > 500 ? raw.slice(0, 500) + "..." : raw)

    if (frame.type === "event") {
      const event = frame.event as string
      const payload = (frame.payload || {}) as Record<string, unknown>

      if (event === "connect.challenge") {
        console.log("[GatewayClient] Received challenge, sending connect...")
        this.sendConnect()
        return
      }

      this.emitEvent(event, payload)
      return
    }

    if (frame.type === "res") {
      const id = frame.id as string
      const pending = this.pendingRequests.get(id)
      if (pending) {
        clearTimeout(pending.timer)
        this.pendingRequests.delete(id)
        if (frame.ok) {
          pending.resolve(frame.payload)
        } else {
          const err = frame.error as Record<string, unknown> | undefined
          pending.reject(new Error(err?.message as string || "Request failed"))
        }
        return
      }

      if (frame.ok && this.state === "connecting") {
        const payload = frame.payload as Record<string, unknown> | undefined
        if (payload?.type === "hello-ok" || payload?.protocol || payload?.server) {
          console.log("[GatewayClient] Connected successfully!")
          this.isConnecting = false
          this.reconnectAttempt = 0
          this.setState("connected")
        }
      }
    }
  }

  private sendConnect(): void {
    const params: Record<string, unknown> = {
      minProtocol: 3,
      maxProtocol: 3,
      client: {
        id: "openclaw-control-ui",
        version: "dev",
        platform: "desktop",
        mode: "webchat",
      },
      role: "operator",
      scopes: ["operator.read", "operator.write", "operator.admin", "operator.approvals", "operator.pairing"],
      caps: [],
    }
    if (this.token) {
      params.auth = { token: this.token }
    }
    const req = {
      type: "req",
      id: randomUUID(),
      method: "connect",
      params,
    }

    this.wsSend(req)
  }

  private wsSend(data: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data))
    }
  }

  private emitEvent(event: string, payload: Record<string, unknown>): void {
    if (event === "chat" || event === "agent") {
      console.log(`[GatewayClient] EVENT: ${event}`, JSON.stringify(payload).slice(0, 500))
    }
    const handlers = this.eventHandlers.get(event)
    if (handlers) {
      for (const fn of handlers) {
        try { fn(payload) } catch {}
      }
    }
    const wildcard = this.eventHandlers.get("*")
    if (wildcard) {
      for (const fn of wildcard) {
        try { fn({ event, ...payload }) } catch {}
      }
    }
  }

  private setState(s: ConnectionState): void {
    if (this.state === s) return
    this.state = s
    for (const fn of this.stateListeners) fn(s)
  }

  private scheduleReconnect(): void {
    if (!this.shouldReconnect || this.reconnectTimer || this.reconnectAttempt >= 10) return
    const delay = Math.min(2000 * Math.pow(2, this.reconnectAttempt), 30000)
    this.reconnectAttempt++
    console.log(`[GatewayClient] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempt})`)
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      if (this.state !== "connected" && this.shouldReconnect) {
        this.doConnect()
      }
    }, delay)
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  private rejectAll(reason: string): void {
    for (const [, p] of this.pendingRequests) {
      clearTimeout(p.timer)
      p.reject(new Error(reason))
    }
    this.pendingRequests.clear()
  }
}

export const gatewayClient = new GatewayClient()
