import { useState, useEffect, useCallback } from "react"
import type { GatewayClient } from "@/lib/gateway-client"
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Info,
  Lock,
  FileWarning,
  RefreshCw,
  ChevronRight,
  Loader2,
  Shield,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"

interface SecurityPageProps {
  client: GatewayClient
  isConnected: boolean
}

interface AuditFinding {
  id: string
  severity: "critical" | "warning" | "info"
  category: string
  title: string
  description: string
}

function auditConfig(config: Record<string, unknown>): AuditFinding[] {
  const findings: AuditFinding[] = []
  const gw = (config.gateway || {}) as Record<string, unknown>
  const auth = (gw.auth || {}) as Record<string, unknown>
  const cui = (gw.controlUi || {}) as Record<string, unknown>
  const logging = (config.logging || {}) as Record<string, unknown>
  const channels = (config.channels || {}) as Record<string, unknown>
  let id = 0

  if (String(gw.bind || "loopback") !== "loopback") {
    findings.push({
      id: String(++id),
      severity: "critical",
      category: "Gateway",
      title: "Gateway not bound to loopback",
      description: `Bind mode is "${gw.bind}". This exposes the gateway to the network. Use loopback unless remote access is needed.`,
    })
  }

  if (String(auth.mode) === "token") {
    const token = String(auth.token || "")
    if (token.length < 24) {
      findings.push({
        id: String(++id),
        severity: "warning",
        category: "Auth",
        title: "Gateway token is short",
        description: `Token has ${token.length} characters. Use at least 24 characters for better security.`,
      })
    }
    findings.push({
      id: String(++id),
      severity: "info",
      category: "Auth",
      title: `Auth mode: ${auth.mode}`,
      description: "Token-based authentication is enabled for the gateway.",
    })
  } else if (!auth.mode) {
    findings.push({
      id: String(++id),
      severity: "critical",
      category: "Auth",
      title: "No authentication configured",
      description: "The gateway has no auth mode set. Set gateway.auth.mode to 'token' or 'password'.",
    })
  }

  if (cui.dangerouslyDisableDeviceAuth) {
    findings.push({
      id: String(++id),
      severity: "warning",
      category: "Auth",
      title: "Device authentication disabled",
      description: "dangerouslyDisableDeviceAuth is enabled. Clients can connect without Ed25519 device identity.",
    })
  }

  if (cui.allowInsecureAuth) {
    findings.push({
      id: String(++id),
      severity: "warning",
      category: "Control UI",
      title: "Insecure auth allowed for Control UI",
      description: "allowInsecureAuth is enabled. The Control UI can connect without device pairing.",
    })
  }

  if (String(logging.redactSensitive || "") === "off") {
    findings.push({
      id: String(++id),
      severity: "warning",
      category: "Logging",
      title: "Sensitive data redaction disabled",
      description: "Tool output is not redacted in logs. Enable logging.redactSensitive for production.",
    })
  }

  const whatsapp = (channels.whatsapp || {}) as Record<string, unknown>
  if (whatsapp.dmPolicy === "open" || whatsapp.groupPolicy === "open") {
    findings.push({
      id: String(++id),
      severity: "warning",
      category: "Channels",
      title: "WhatsApp policy set to open",
      description: "All incoming messages are processed without pairing. Consider switching to 'pairing' or 'allowlist'.",
    })
  }

  const telegram = (channels.telegram || {}) as Record<string, unknown>
  if (telegram.botToken && !telegram.allowFrom) {
    findings.push({
      id: String(++id),
      severity: "info",
      category: "Channels",
      title: "Telegram has no allowFrom list",
      description: "Any user can message the Telegram bot. Consider adding an allowFrom list.",
    })
  }

  if (gw.bind === "loopback" && auth.mode === "token") {
    findings.push({
      id: String(++id),
      severity: "info",
      category: "Gateway",
      title: "Gateway bound to loopback with token auth",
      description: "Good configuration — the gateway is only accessible locally and requires authentication.",
    })
  }

  findings.push({
    id: String(++id),
    severity: "info",
    category: "TLS",
    title: "TLS 1.3 supported",
    description: "The gateway supports TLS 1.3 for encrypted connections when enabled.",
  })

  return findings
}

export function SecurityPage({ client, isConnected }: SecurityPageProps) {
  const [findings, setFindings] = useState<AuditFinding[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [lastAudit, setLastAudit] = useState<string | null>(null)

  const runAudit = useCallback(async () => {
    if (!isConnected) return
    setIsLoading(true)
    try {
      const result = await client.configGet() as {
        config?: Record<string, unknown>
        resolved?: Record<string, unknown>
      }
      const config = (result?.resolved || result?.config || {}) as Record<string, unknown>
      const auditResults = auditConfig(config)
      setFindings(auditResults)
      setLastAudit(new Date().toLocaleTimeString())
    } catch {
    } finally {
      setIsLoading(false)
    }
  }, [isConnected, client])

  useEffect(() => {
    runAudit()
  }, [runAudit])

  const criticalCount = findings.filter((f) => f.severity === "critical").length
  const warningCount = findings.filter((f) => f.severity === "warning").length
  const infoCount = findings.filter((f) => f.severity === "info").length
  const score = findings.length > 0
    ? Math.max(0, 100 - criticalCount * 30 - warningCount * 10)
    : 0

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Security</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Security audit based on live gateway configuration
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={runAudit} disabled={isLoading || !isConnected}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Run Audit
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">Security Score</span>
              <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-semibold">{isConnected ? `${score}%` : "--"}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {lastAudit ? `Last audit: ${lastAudit}` : "Run audit to check"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">Critical</span>
              <ShieldAlert className="h-4 w-4 text-red-400" />
            </div>
            <p className="text-2xl font-semibold text-red-400">{criticalCount}</p>
            <p className="text-xs text-muted-foreground mt-1">Requires attention</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">Warnings</span>
              <AlertTriangle className="h-4 w-4 text-amber-400" />
            </div>
            <p className="text-2xl font-semibold text-amber-400">{warningCount}</p>
            <p className="text-xs text-muted-foreground mt-1">Should be reviewed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">Info</span>
              <Info className="h-4 w-4 text-blue-400" />
            </div>
            <p className="text-2xl font-semibold text-blue-400">{infoCount}</p>
            <p className="text-xs text-muted-foreground mt-1">Informational</p>
          </CardContent>
        </Card>
      </div>

      {!isConnected ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Shield className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm font-medium text-muted-foreground">Start the Gateway to run security audit</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Audit Findings</CardTitle>
            <CardDescription>{findings.length} findings from configuration analysis</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px] pr-3">
              <div className="space-y-2">
                {findings.map((finding) => (
                  <FindingRow key={finding.id} finding={finding} />
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function FindingRow({ finding }: { finding: AuditFinding }) {
  const severityConfig = {
    critical: { icon: XCircle, color: "text-red-400", bg: "bg-red-500/10" },
    warning: { icon: AlertTriangle, color: "text-amber-400", bg: "bg-amber-500/10" },
    info: { icon: Info, color: "text-blue-400", bg: "bg-blue-500/10" },
  }

  const config = severityConfig[finding.severity]
  const Icon = config.icon

  return (
    <div className={`p-3 rounded-lg ${config.bg}`}>
      <div className="flex items-start gap-2.5">
        <Icon className={`h-4 w-4 ${config.color} shrink-0 mt-0.5`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{finding.title}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{finding.description}</p>
          <Badge variant="outline" className="text-[10px] mt-1.5">{finding.category}</Badge>
        </div>
      </div>
    </div>
  )
}
