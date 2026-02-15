import { useState, useRef, useEffect, useCallback } from "react"
import {
  Send,
  Bot,
  User,
  Paperclip,
  Mic,
  MoreHorizontal,
  Plus,
  Search,
  Sparkles,
  Brain,
  Copy,
  Check,
  RotateCw,
  Square,
  Trash2,
  WifiOff,
  X,
  FileText,
  Image as ImageIcon,
} from "lucide-react"
import { cn, randomUUID } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useGatewayEvent } from "@/lib/use-gateway"
import type { GatewayClient } from "@/lib/gateway-client"

interface Message {
  id: string
  role: "user" | "assistant" | "system"
  content: string
  timestamp: string
  model?: string
  tokens?: number
  isStreaming?: boolean
  attachments?: Array<{ name: string; type: string; size: number }>
}

interface ChatSession {
  id: string
  sessionKey: string
  title: string
  agent: string
  lastMessage: string
  timestamp: string
  isActive: boolean
}

interface ChatPageProps {
  client: GatewayClient
  isConnected: boolean
}

export function ChatPage({ client, isConnected }: ChatPageProps) {
  const [sessions, setSessions] = useState<ChatSession[]>([
    {
      id: "main",
      sessionKey: "main",
      title: "Main Session",
      agent: "main",
      lastMessage: "",
      timestamp: "Now",
      isActive: true,
    },
  ])
  const [activeSessionKey, setActiveSessionKey] = useState("main")
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState("")
  const [isStreaming, setIsStreaming] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [currentRunId, setCurrentRunId] = useState<string | null>(null)
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [thinkingLevel, setThinkingLevel] = useState<"none" | "low" | "medium" | "high">("high")
  const [showModelSelector, setShowModelSelector] = useState(false)
  const [availableModels, setAvailableModels] = useState<Array<{ id: string; name: string; provider: string }>>([])
  const [selectedModel, setSelectedModel] = useState<string>("")
  const activeSession = sessions.find((s) => s.sessionKey === activeSessionKey)

  // Load available models from gateway
  useEffect(() => {
    if (!isConnected) return
    client.modelsList().then((result: unknown) => {
      const r = result as { models?: Array<{ id: string; name: string; provider: string }> }
      if (r?.models) {
        setAvailableModels(r.models)
      }
    }).catch(() => {})
  }, [isConnected, client])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isStreaming])

  useEffect(() => {
    if (!isConnected) return
    loadSessions()
  }, [isConnected])

  useEffect(() => {
    if (!isConnected || !activeSessionKey) return
    loadHistory(activeSessionKey)
  }, [isConnected, activeSessionKey])

  const loadSessions = useCallback(async () => {
    if (!isConnected) return
    try {
      const result = await client.sessionsList({ messageLimit: 1 }) as { sessions?: Array<Record<string, unknown>> }
      if (result?.sessions?.length) {
        const mapped: ChatSession[] = result.sessions.map((s) => {
          const key = String(s.sessionKey || "main")
          const label = String(s.label || "")
          const lastMsgs = (s.lastMessages || []) as Array<Record<string, unknown>>
          const lastMsg = lastMsgs.length > 0 ? String(lastMsgs[0].text || lastMsgs[0].content || "").slice(0, 80) : ""
          // Generate a nice title
          let title = label || (key === "main" ? "Main Session" : key)
          if (title.startsWith("session-")) title = `Session ${title.split("-")[1]?.slice(-4) || ""}`
          return {
            id: String(s.sessionId || key),
            sessionKey: key,
            title,
            agent: String(s.agentId || "default"),
            lastMessage: lastMsg,
            timestamp: s.updatedAt ? new Date(s.updatedAt as string).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "",
            isActive: key === activeSessionKey,
          }
        })
        // Sort: main first, then by most recent
        mapped.sort((a, b) => {
          if (a.sessionKey === "main") return -1
          if (b.sessionKey === "main") return 1
          return 0
        })
        if (!mapped.find((s) => s.sessionKey === "main")) {
          mapped.unshift({
            id: "main",
            sessionKey: "main",
            title: "Main Session",
            agent: "main",
            lastMessage: "",
            timestamp: "Now",
            isActive: true,
          })
        }
        setSessions(mapped)
      }
    } catch {
      // keep default session
    }
  }, [isConnected, client, activeSessionKey])

  const loadHistory = useCallback(async (sessionKey: string) => {
    if (!isConnected) return
    try {
      const result = await client.chatHistory(sessionKey, 50) as { messages?: Array<Record<string, unknown>> }
      if (result?.messages?.length) {
        const mapped: Message[] = result.messages.map((m) => ({
          id: String(m.id || randomUUID()),
          role: (m.role as "user" | "assistant") || "assistant",
          content: extractTextContent(m.content),
          timestamp: m.timestamp ? new Date(m.timestamp as number).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "",
          model: m.model as string | undefined,
        }))
        setMessages(mapped)
      }
    } catch {
      setMessages([])
    }
  }, [isConnected, client])

  // Helper to update or create a streaming message
  const upsertStreamMessage = useCallback((runId: string, text: string, done: boolean) => {
    setMessages((prev) => {
      const msgId = `stream-${runId}`
      const existing = prev.find((m) => m.id === msgId)
      if (existing) {
        // Replace with accumulated text (gateway sends full text so far)
        const newContent = text.length >= existing.content.length ? text : existing.content
        return prev.map((m) =>
          m.id === msgId ? { ...m, content: newContent, isStreaming: !done } : m
        )
      }
      if (!text) return prev
      return [
        ...prev,
        {
          id: msgId,
          role: "assistant" as const,
          content: text,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          isStreaming: !done,
        },
      ]
    })
    if (done) {
      setIsStreaming(false)
      setCurrentRunId(null)
    }
  }, [])

  // Listen for "chat" events — the official streaming API (accumulated text + state machine)
  useGatewayEvent("chat", (payload) => {
    const p = payload as Record<string, unknown>
    const runId = p.runId as string | undefined
    const state = p.state as string | undefined
    const evtSessionKey = p.sessionKey as string | undefined
    const message = p.message as { role?: string; content?: unknown } | undefined
    const errorMessage = p.errorMessage as string | undefined

    console.log("[Chat] chat event:", state, "runId:", runId, "session:", evtSessionKey, "hasMessage:", !!message)

    if (!runId) return

    if (state === "delta" && message) {
      const text = extractTextContent(message.content)
      console.log("[Chat] delta text:", text?.slice(0, 100))
      if (text) upsertStreamMessage(runId, text, false)
    }

    if (state === "final") {
      const text = message ? extractTextContent(message.content) : ""
      console.log("[Chat] final text:", text?.slice(0, 100))
      if (text) {
        upsertStreamMessage(runId, text, true)
      } else {
        // Mark done even without text
        setMessages((prev) =>
          prev.map((m) =>
            m.id === `stream-${runId}` ? { ...m, isStreaming: false } : m
          )
        )
        setIsStreaming(false)
        setCurrentRunId(null)
        // Reload history to get the final response
        loadHistory(activeSessionKey)
      }
    }

    if (state === "error") {
      console.log("[Chat] error:", errorMessage)
      setIsStreaming(false)
      setCurrentRunId(null)
      if (errorMessage) {
        setMessages((prev) => [
          ...prev,
          {
            id: randomUUID(),
            role: "system" as const,
            content: `Error: ${errorMessage}`,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
        ])
      }
      // Reload history in case there was a partial response
      loadHistory(activeSessionKey)
    }

    if (state === "aborted") {
      setIsStreaming(false)
      setCurrentRunId(null)
    }
  })

  // ALSO listen for "agent" events as fallback — raw stream with delta/text
  useGatewayEvent("agent", (payload) => {
    const p = payload as Record<string, unknown>
    const runId = p.runId as string | undefined
    const stream = p.stream as string | undefined
    const data = p.data as { text?: string; delta?: string; phase?: string } | undefined

    if (!runId) return

    if (stream === "assistant" && data) {
      const text = data.text || data.delta || ""
      if (text) {
        console.log("[Chat] agent assistant:", text.slice(0, 100))
        upsertStreamMessage(runId, data.text || text, false)
      }
    }

    if (stream === "lifecycle" && data?.phase === "end") {
      console.log("[Chat] agent lifecycle end")
      setMessages((prev) =>
        prev.map((m) =>
          m.id === `stream-${runId}` ? { ...m, isStreaming: false } : m
        )
      )
      setIsStreaming(false)
      setCurrentRunId(null)
    }
  })

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    setPendingFiles((prev) => [...prev, ...files])
    // Reset input so same file can be selected again
    e.target.value = ""
  }, [])

  const handleRemoveFile = useCallback((index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const handleSend = useCallback(async () => {
    if ((!inputValue.trim() && pendingFiles.length === 0) || isStreaming) return

    // Build attachments from pending files
    const attachments: Array<{ type: string; mimeType: string; content: string }> = []
    for (const file of pendingFiles) {
      try {
        const buffer = await file.arrayBuffer()
        const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)))
        const isImage = file.type.startsWith("image/")
        attachments.push({
          type: isImage ? "image" : "document",
          mimeType: file.type || "application/octet-stream",
          content: base64,
        })
      } catch {
        // skip failed files
      }
    }

    const messageText = inputValue.trim() || (pendingFiles.length > 0 ? `[Attached ${pendingFiles.length} file(s)]` : "")

    const userMessage: Message = {
      id: randomUUID(),
      role: "user",
      content: messageText,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      attachments: pendingFiles.map((f) => ({ name: f.name, type: f.type, size: f.size })),
    }

    setMessages((prev) => [...prev, userMessage])
    setInputValue("")
    setPendingFiles([])
    setIsStreaming(true)

    if (isConnected) {
      try {
        const opts: Record<string, unknown> = { thinking: thinkingLevel !== "none" ? thinkingLevel : undefined }
        if (attachments.length > 0) {
          opts.attachments = attachments
        }
        const result = await client.chatSend(activeSessionKey, messageText, opts) as { runId?: string }

        if (result?.runId) {
          setCurrentRunId(result.runId)
        }
      } catch (err) {
        setIsStreaming(false)
        setMessages((prev) => [
          ...prev,
          {
            id: randomUUID(),
            role: "system",
            content: `Error: ${err instanceof Error ? err.message : "Failed to send message"}`,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
        ])
      }
    } else {
      setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          {
            id: randomUUID(),
            role: "system",
            content: "Gateway is not connected. Start the gateway and wait for the WebSocket connection.",
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
        ])
        setIsStreaming(false)
      }, 500)
    }
  }, [inputValue, isStreaming, isConnected, client, activeSessionKey])

  const handleAbort = useCallback(async () => {
    if (!isConnected) return
    try {
      await client.chatAbort(activeSessionKey)
    } catch {
      // best effort
    }
    setIsStreaming(false)
    setCurrentRunId(null)
  }, [isConnected, client, activeSessionKey])

  const handleReset = useCallback(async () => {
    if (!isConnected) return
    try {
      await client.sessionsReset(activeSessionKey)
      setMessages([])
    } catch {
      // error
    }
  }, [isConnected, client, activeSessionKey])

  const handleNewSession = useCallback(async () => {
    const key = `session-${Date.now()}`
    // Just switch to a new key — the gateway creates sessions on first message
    const newSession: ChatSession = {
      id: key,
      sessionKey: key,
      title: `New Session`,
      agent: "default",
      lastMessage: "",
      timestamp: "Now",
      isActive: true,
    }
    setSessions((prev) => prev.map((s) => ({ ...s, isActive: false })).concat(newSession))
    setActiveSessionKey(key)
    setMessages([])
  }, [])

  const handleDeleteSession = useCallback(async (sessionKey: string) => {
    if (!isConnected || sessionKey === "main") return // Don't delete main
    try {
      await client.sessionsDelete(sessionKey)
      setSessions((prev) => prev.filter((s) => s.sessionKey !== sessionKey))
      if (activeSessionKey === sessionKey) {
        setActiveSessionKey("main")
      }
    } catch {
      // If delete fails on gateway, still remove from UI
      setSessions((prev) => prev.filter((s) => s.sessionKey !== sessionKey))
      if (activeSessionKey === sessionKey) {
        setActiveSessionKey("main")
      }
    }
  }, [isConnected, client, activeSessionKey])

  const handleSwitchSession = useCallback((sessionKey: string) => {
    if (sessionKey === activeSessionKey) return // already active
    setActiveSessionKey(sessionKey)
    // loadHistory will fire via the useEffect that watches activeSessionKey
  }, [activeSessionKey])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleCopy = (id: string, content: string) => {
    navigator.clipboard.writeText(content)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <div className="h-full flex">
      <div className="w-[260px] shrink-0 border-r border-border flex flex-col bg-sidebar">
        <div className="p-3 flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Sessions</span>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleNewSession}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <div className="px-3 pb-2">
          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search sessions..."
              className="h-8 w-full rounded-md border bg-background pl-8 pr-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>

        <ScrollArea className="flex-1 px-2">
          <div className="space-y-0.5 pb-2">
            {sessions.map((session) => (
              <div
                key={session.id}
                className={cn(
                  "group relative w-full text-left p-2.5 rounded-lg transition-colors cursor-pointer",
                  activeSessionKey === session.sessionKey
                    ? "bg-sidebar-accent"
                    : "hover:bg-sidebar-accent/50"
                )}
                onClick={() => handleSwitchSession(session.sessionKey)}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-sm font-medium truncate pr-8">{session.title}</span>
                  {session.sessionKey !== "main" && (
                    <button
                      className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-destructive/20"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteSession(session.sessionKey)
                      }}
                      title="Delete session"
                    >
                      <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-[9px] px-1 py-0">{session.agent}</Badge>
                  <span className="text-[10px] text-muted-foreground">{session.timestamp}</span>
                </div>
                {session.lastMessage && (
                  <p className="text-[10px] text-muted-foreground mt-1 truncate">{session.lastMessage}</p>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <div className="h-12 flex items-center justify-between px-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-7 w-7 rounded-full bg-secondary flex items-center justify-center shrink-0">
              <Bot className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{activeSession?.title || "Chat"}</p>
              <p className="text-[11px] text-muted-foreground font-mono">{activeSessionKey}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {!isConnected && (
              <Badge variant="destructive" className="text-[10px] gap-1 mr-2">
                <WifiOff className="h-3 w-3" />
                Disconnected
              </Badge>
            )}
            {/* Thinking level toggle */}
            <div className="relative mr-1">
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-7 text-[10px] gap-1 font-mono",
                  thinkingLevel === "high" ? "text-amber-400" :
                  thinkingLevel === "medium" ? "text-blue-400" :
                  thinkingLevel === "low" ? "text-zinc-400" : "text-zinc-600"
                )}
                onClick={() => {
                  const levels: typeof thinkingLevel[] = ["none", "low", "medium", "high"]
                  const idx = levels.indexOf(thinkingLevel)
                  setThinkingLevel(levels[(idx + 1) % levels.length])
                }}
                title={`Thinking: ${thinkingLevel}`}
              >
                <Brain className="h-3.5 w-3.5" />
                {thinkingLevel}
              </Button>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleReset} title="Reset session">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => loadSessions()} title="Refresh sessions">
              <RotateCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="max-w-3xl mx-auto px-6 py-6 space-y-6">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="h-16 w-16 rounded-2xl bg-secondary flex items-center justify-center mb-4">
                  <Sparkles className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium mb-1">Orquestr Pro Assistant</h3>
                <p className="text-sm text-muted-foreground max-w-md">
                  {isConnected
                    ? "Send a message to start. The assistant can execute commands, browse the web, manage files, run cron jobs, and more."
                    : "Start the Gateway to begin chatting. The assistant connects to your configured AI model provider."}
                </p>
              </div>
            )}

            {messages.map((message) => (
              <div key={message.id} className="group">
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      "h-7 w-7 rounded-full flex items-center justify-center shrink-0 mt-0.5",
                      message.role === "user" ? "bg-primary" : message.role === "system" ? "bg-destructive/20" : "bg-secondary"
                    )}
                  >
                    {message.role === "user" ? (
                      <User className="h-3.5 w-3.5 text-primary-foreground" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium">
                        {message.role === "user" ? "You" : message.role === "system" ? "System" : "Assistant"}
                      </span>
                      <span className="text-[11px] text-muted-foreground">{message.timestamp}</span>
                      {message.model && (
                        <span className="text-[10px] text-muted-foreground font-mono">{message.model}</span>
                      )}
                      {message.isStreaming && (
                        <span className="text-[10px] text-primary animate-pulse">streaming...</span>
                      )}
                    </div>
                    {/* Attachments */}
                    {message.attachments && message.attachments.length > 0 && (
                      <div className="mb-2 flex flex-wrap gap-1.5">
                        {message.attachments.map((att, i) => (
                          <div key={i} className="flex items-center gap-1 px-2 py-0.5 rounded bg-secondary text-[10px]">
                            {att.type.startsWith("image/") ? <ImageIcon className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
                            <span>{att.name}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90 selectable-text">
                      <MessageContent content={message.content} />
                    </div>
                    {!message.isStreaming && message.role !== "system" && (
                      <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => handleCopy(message.id, message.content)}
                        >
                          {copiedId === message.id ? (
                            <Check className="h-3 w-3 text-emerald-400" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {isStreaming && !messages.some((m) => m.isStreaming) && (
              <div className="flex items-start gap-3">
                <div className="h-7 w-7 rounded-full bg-secondary flex items-center justify-center shrink-0 mt-0.5">
                  <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <div className="flex items-center gap-1 pt-2">
                  <div className="flex gap-1">
                    <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:0ms]" />
                    <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:150ms]" />
                    <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:300ms]" />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        <div className="border-t border-border p-4 shrink-0">
          <div className="max-w-3xl mx-auto">
            {/* Pending files */}
            {pendingFiles.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {pendingFiles.map((file, i) => (
                  <div key={i} className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-secondary border text-xs">
                    {file.type.startsWith("image/") ? <ImageIcon className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
                    <span className="truncate max-w-[120px]">{file.name}</span>
                    <span className="text-muted-foreground">({(file.size / 1024).toFixed(0)}KB)</span>
                    <button onClick={() => handleRemoveFile(i)} className="ml-1 hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-end gap-2 rounded-xl border bg-card p-2">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,.pdf,.txt,.md,.json,.csv,.py,.js,.ts,.html,.css"
                className="hidden"
                onChange={handleFileSelect}
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => fileInputRef.current?.click()}
                title="Attach file"
              >
                <Paperclip className="h-4 w-4" />
              </Button>
              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isConnected ? "Send a message..." : "Start the Gateway to chat..."}
                disabled={!isConnected && messages.length === 0}
                rows={1}
                className="flex-1 resize-none bg-transparent text-sm py-1.5 px-1 focus:outline-none min-h-[36px] max-h-[120px] placeholder:text-muted-foreground disabled:opacity-50"
                style={{ height: "36px" }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement
                  target.style.height = "36px"
                  target.style.height = `${Math.min(target.scrollHeight, 120)}px`
                }}
              />
              {isStreaming ? (
                <Button
                  variant="destructive"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={handleAbort}
                >
                  <Square className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  disabled={!inputValue.trim()}
                  onClick={handleSend}
                >
                  <Send className="h-4 w-4" />
                </Button>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground text-center mt-2">
              {isConnected
                ? `Connected to Gateway · Session: ${activeSessionKey}`
                : "Gateway disconnected · Start the gateway from Dashboard"}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function MessageContent({ content }: { content: string }) {
  const parts = content.split(/(```[\s\S]*?```)/g)

  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("```")) {
          const lines = part.slice(3, -3).split("\n")
          const lang = lines[0] || ""
          const code = lines.slice(1).join("\n")
          return (
            <div key={i} className="my-3 rounded-lg border bg-zinc-900 overflow-hidden group/code relative">
              <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-800/50 border-b">
                <span className="text-[11px] text-muted-foreground font-mono">{lang || "code"}</span>
                <button
                  className="text-[10px] text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover/code:opacity-100"
                  onClick={() => navigator.clipboard.writeText(code)}
                >
                  Copy
                </button>
              </div>
              <pre className="p-3 text-[13px] overflow-x-auto selectable-text">
                <code>{code}</code>
              </pre>
            </div>
          )
        }

        return part.split("\n").map((line, j) => {
          if (line.startsWith("# ")) {
            return <h2 key={`${i}-${j}`} className="text-lg font-bold mt-5 mb-2">{renderInline(line.slice(2))}</h2>
          }
          if (line.startsWith("## ")) {
            return <h3 key={`${i}-${j}`} className="text-base font-semibold mt-4 mb-2">{renderInline(line.slice(3))}</h3>
          }
          if (line.startsWith("### ")) {
            return <h4 key={`${i}-${j}`} className="text-sm font-semibold mt-3 mb-1.5">{renderInline(line.slice(4))}</h4>
          }
          if (line.startsWith("#### ")) {
            return <h5 key={`${i}-${j}`} className="text-sm font-medium mt-2 mb-1">{renderInline(line.slice(5))}</h5>
          }
          // Numbered lists
          if (/^\d+\.\s/.test(line)) {
            const text = line.replace(/^\d+\.\s/, "")
            return (
              <div key={`${i}-${j}`} className="flex items-start gap-2 my-0.5 ml-1">
                <span className="text-muted-foreground mt-0 shrink-0 min-w-[1.2em] text-right">{line.match(/^\d+/)?.[0]}.</span>
                <span>{renderInline(text)}</span>
              </div>
            )
          }
          // Bullet lists (- or *)
          if (/^[\-\*]\s/.test(line)) {
            return (
              <div key={`${i}-${j}`} className="flex items-start gap-2 my-0.5 ml-1">
                <span className="text-muted-foreground mt-1.5 shrink-0">•</span>
                <span>{renderInline(line.slice(2))}</span>
              </div>
            )
          }
          // Blockquote
          if (line.startsWith("> ")) {
            return (
              <div key={`${i}-${j}`} className="border-l-2 border-primary/40 pl-3 my-1 text-muted-foreground italic">
                {renderInline(line.slice(2))}
              </div>
            )
          }
          // Horizontal rule
          if (/^[-*_]{3,}$/.test(line.trim())) {
            return <hr key={`${i}-${j}`} className="my-4 border-border" />
          }
          if (line.trim() === "") {
            return <div key={`${i}-${j}`} className="h-2" />
          }
          return <span key={`${i}-${j}`}>{renderInline(line)}{"\n"}</span>
        })
      })}
    </>
  )
}

function renderInline(text: string): React.ReactNode {
  // Split on: `code`, **bold**, *italic*, [links](url), and bare URLs
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[([^\]]+)\]\(([^)]+)\)|https?:\/\/[^\s<>)"]+)/g)
  const result: React.ReactNode[] = []
  let idx = 0
  
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]
    if (!part) continue
    
    if (part.startsWith("`") && part.endsWith("`")) {
      result.push(<code key={idx++} className="text-[12px] bg-zinc-800 px-1.5 py-0.5 rounded font-mono text-emerald-300">{part.slice(1, -1)}</code>)
    } else if (part.startsWith("**") && part.endsWith("**")) {
      result.push(<strong key={idx++} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>)
    } else if (part.startsWith("*") && part.endsWith("*") && !part.startsWith("**")) {
      result.push(<em key={idx++} className="italic">{part.slice(1, -1)}</em>)
    } else if (part.startsWith("[") && part.includes("](")) {
      // Markdown link [text](url)
      const match = part.match(/\[([^\]]+)\]\(([^)]+)\)/)
      if (match) {
        result.push(
          <a key={idx++} href={match[2]} target="_blank" rel="noopener noreferrer"
            className="text-primary hover:underline cursor-pointer"
            onClick={(e) => { e.preventDefault(); window.open(match[2], "_blank") }}>
            {match[1]}
          </a>
        )
      } else {
        result.push(part)
      }
    } else if (/^https?:\/\//.test(part)) {
      // Bare URL
      result.push(
        <a key={idx++} href={part} target="_blank" rel="noopener noreferrer"
          className="text-primary hover:underline cursor-pointer break-all"
          onClick={(e) => { e.preventDefault(); window.open(part, "_blank") }}>
          {part.length > 60 ? part.slice(0, 57) + "..." : part}
        </a>
      )
    } else {
      result.push(part)
    }
  }
  
  return result.length === 1 ? result[0] : <>{result}</>
}

function extractTextContent(content: unknown): string {
  let text = ""
  if (typeof content === "string") {
    text = content
  } else if (Array.isArray(content)) {
    text = content
      .filter((c: Record<string, unknown>) => c.type === "text")
      .map((c: Record<string, unknown>) => c.text || "")
      .join("")
  } else {
    text = String(content || "")
  }
  return stripMetadata(text)
}

/** Strip OpenClaw's inbound context metadata from displayed messages */
function stripMetadata(text: string): string {
  // Remove "Conversation info (untrusted metadata):\n```json\n{...}\n```\n" prefix
  const metaPattern = /^Conversation info \(untrusted metadata\):\s*```json\s*\{[^}]*\}\s*```\s*/s
  let cleaned = text.replace(metaPattern, "")
  // Remove timestamp prefix like "[Sat 2026-02-14 18:49 GMT-3] "
  cleaned = cleaned.replace(/^\[[\w\s,:-]+(?:GMT[+-]\d+)?\]\s*/i, "")
  return cleaned.trim()
}
