import { useState, useEffect, useCallback, useRef } from "react"
import { gatewayClient, type ConnectionState, type EventHandler } from "./gateway-client"

export function useGatewayConnection() {
  const [connectionState, setConnectionState] = useState<ConnectionState>("disconnected")
  const [gatewayStatus, setGatewayStatus] = useState<"stopped" | "starting" | "running" | "error">("stopped")
  const connectedOnce = useRef(false)

  const isElectron = typeof window !== "undefined" && !!window.api

  useEffect(() => {
    return gatewayClient.onStateChange((s) => {
      setConnectionState(s)
      if (s === "connected") connectedOnce.current = true
    })
  }, [])

  useEffect(() => {
    if (!isElectron) return

    const poll = async () => {
      try {
        const s = await window.api.gateway.status()
        setGatewayStatus(s.status)

        if (s.status === "running" && gatewayClient.getState() === "disconnected") {
          const wsUrl = await window.api.gateway.wsUrl()
          const token = await window.api.gateway.token()
          gatewayClient.connect(wsUrl, token)
        }
      } catch {
        setGatewayStatus("stopped")
      }
    }

    poll()
    const interval = setInterval(poll, 5000)
    return () => clearInterval(interval)
  }, [isElectron])

  const startGateway = useCallback(async () => {
    if (!isElectron) return
    setGatewayStatus("starting")
    try {
      const result = await window.api.gateway.start()
      setGatewayStatus(result.status)

      if (result.status === "running") {
        connectedOnce.current = false
        const wsUrl = await window.api.gateway.wsUrl()
        const token = await window.api.gateway.token()
        setTimeout(() => {
          gatewayClient.connect(wsUrl, token)
          connectedOnce.current = true
        }, 1000)
      }
    } catch {
      setGatewayStatus("error")
    }
  }, [isElectron])

  const stopGateway = useCallback(async () => {
    if (!isElectron) return
    gatewayClient.disconnect()
    connectedOnce.current = false
    try {
      const result = await window.api.gateway.stop()
      setGatewayStatus(result.status)
    } catch {
      setGatewayStatus("error")
    }
  }, [isElectron])

  const restartGateway = useCallback(async () => {
    if (!isElectron) return
    gatewayClient.disconnect()
    connectedOnce.current = false
    setGatewayStatus("starting")
    try {
      const result = await window.api.gateway.restart()
      setGatewayStatus(result.status)

      if (result.status === "running") {
        setTimeout(() => {
          window.api.gateway.wsUrl().then((wsUrl) => {
            window.api.gateway.token().then((token) => {
              gatewayClient.connect(wsUrl, token)
              connectedOnce.current = true
            })
          })
        }, 1000)
      }
    } catch {
      setGatewayStatus("error")
    }
  }, [isElectron])

  return {
    connectionState,
    gatewayStatus,
    isConnected: connectionState === "connected",
    startGateway,
    stopGateway,
    restartGateway,
    client: gatewayClient,
  }
}

export function useGatewayEvent(event: string, handler: EventHandler) {
  const ref = useRef(handler)
  ref.current = handler

  useEffect(() => {
    return gatewayClient.on(event, (p) => ref.current(p))
  }, [event])
}

export function useGatewayRequest<T = unknown>(
  method: string,
  params?: Record<string, unknown>,
  opts?: { enabled?: boolean }
) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const enabled = opts?.enabled ?? true

  const execute = useCallback(async (overrideParams?: Record<string, unknown>) => {
    if (gatewayClient.getState() !== "connected") return null
    setIsLoading(true)
    setError(null)
    try {
      const result = await gatewayClient.request<T>(method, overrideParams || params)
      setData(result)
      return result
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed")
      return null
    } finally {
      setIsLoading(false)
    }
  }, [method, params])

  useEffect(() => {
    if (enabled && gatewayClient.getState() === "connected") execute()
  }, [enabled, execute])

  return { data, error, isLoading, execute, refetch: execute }
}
