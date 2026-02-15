import { useState, useCallback, useRef } from "react"
import {
  Scissors,
  Upload,
  Play,
  Clock,
  FileVideo,
  Captions,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Trash2,
  Eye,
  Send,
  Plus,
  Film,
  Sparkles,
  Search,
  FolderOpen,
  Share2,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useGatewayEvent } from "@/lib/use-gateway"
import type { GatewayClient } from "@/lib/gateway-client"

type CutStatus = "idle" | "transcribing" | "analyzing" | "cutting" | "done" | "error"

interface DetectedMoment {
  id: string
  start: string
  end: string
  duration: string
  hook: string
  description: string
  score: number
  tags: string[]
  selected: boolean
}

interface Cut {
  id: string
  name: string
  start: string
  end: string
  status: CutStatus
  outputPath?: string
  previewPath?: string
  fileSize?: string
  duration?: string
  error?: string
  publishedTo: string[]
}

interface LiveCutterPageProps {
  client: GatewayClient
  isConnected: boolean
}

const SCAN_DIRS = [
  `${typeof window !== "undefined" && window.api ? "" : ""}~/clawd/out/cortes`.replace("~", "/Users/caiovicentino"),
  "/Users/caiovicentino/clawd/out",
]

export function LiveCutterPage({ client, isConnected }: LiveCutterPageProps) {
  const [videoPath, setVideoPath] = useState("")
  const [videoName, setVideoName] = useState("")
  const [isDragging, setIsDragging] = useState(false)
  const [status, setStatus] = useState<CutStatus>("idle")
  const [moments, setMoments] = useState<DetectedMoment[]>([])
  const [cuts, setCuts] = useState<Cut[]>([])
  const [existingCuts, setExistingCuts] = useState<Array<{
    name: string; path: string; size: string; duration: string; createdAt: string; previewPath: string | null
  }>>([])
  const [activeTab, setActiveTab] = useState<"detect" | "cuts" | "publish">("detect")

  const loadExistingCuts = useCallback(async () => {
    if (typeof window === "undefined" || !window.api) return
    try {
      const results = await window.api.cuts.scan(SCAN_DIRS)
      setExistingCuts(results)
    } catch {}
  }, [])

  useState(() => {
    loadExistingCuts()
  })

  const handleAnalyze = useCallback(async () => {
    if (!videoPath.trim() || !isConnected) return

    setStatus("transcribing")
    setMoments([])
    setCuts([])

    try {
      await client.chatSend("default",
        `Usar a skill live-cutter para analisar o vídeo: ${videoPath}

Fluxo:
1. Extrair áudio com ffmpeg
2. Transcrever com whisper-cli
3. Analisar a transcrição e identificar os melhores momentos para cortes verticais (Shorts/Reels)
4. Para cada momento, retornar: timestamp início, timestamp fim, hook (primeiras palavras), descrição do conteúdo, e score de 1-10

Critérios:
- Hook forte nos primeiros 3s
- Ideia completa (início, meio, fim)
- Duração ideal: 45-90 segundos
- Evitar primeiros 3 minutos da live
- Evitar ajustes técnicos

Retornar os momentos em formato JSON.`,
        { thinking: "high" }
      )

      setStatus("analyzing")
    } catch (err) {
      setStatus("error")
    }
  }, [videoPath, isConnected, client])

  const runIdToCutId = useRef<Map<string, string>>(new Map())

  useGatewayEvent("agent", (payload) => {
    const { runId, stream, data } = payload as {
      runId?: string
      stream?: string
      data?: { phase?: string }
    }
    if (!runId) return

    const cutId = runIdToCutId.current.get(runId)
    if (!cutId) return

    if (stream === "lifecycle" && data?.phase === "end") {
      setCuts((prev) =>
        prev.map((c) =>
          c.id === cutId ? { ...c, status: "done" } : c
        )
      )
      runIdToCutId.current.delete(runId)
    }
  })

  const handleCreateCut = useCallback(async (moment: DetectedMoment) => {
    if (!isConnected) return

    const cutId = `cut-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const safeName = moment.hook.slice(0, 30).replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase()

    const newCut: Cut = {
      id: cutId,
      name: moment.hook.slice(0, 40),
      start: moment.start,
      end: moment.end,
      status: "cutting",
      publishedTo: [],
    }

    setCuts((prev) => [...prev, newCut])
    setActiveTab("cuts")

    try {
      const result = await client.chatSend("default",
        `Criar corte vertical PADRÃO V24 Cinema Edition do vídeo ${videoPath}:
- Início: ${moment.start}
- Fim: ${moment.end}
- Nome do output: ${safeName}

Executar:
bash ~/clawd/skills/live-cutter/scripts/create_cut.sh "${videoPath}" ${moment.start} ${moment.end} ${safeName}

Verificar resultado e informar tamanho e duração do arquivo.`,
        { thinking: "high" }
      ) as { runId?: string }

      if (result?.runId) {
        runIdToCutId.current.set(result.runId, cutId)
      }
    } catch (err) {
      setCuts((prev) =>
        prev.map((c) =>
          c.id === cutId
            ? { ...c, status: "error", error: err instanceof Error ? err.message : "Failed" }
            : c
        )
      )
    }
  }, [videoPath, isConnected, client])

  const handleCreateAll = useCallback(async () => {
    const selected = moments.filter((m) => m.selected)
    setActiveTab("cuts")
    for (const moment of selected) {
      await handleCreateCut(moment)
    }
  }, [moments, handleCreateCut])

  const toggleMoment = (id: string) => {
    setMoments((prev) =>
      prev.map((m) => (m.id === id ? { ...m, selected: !m.selected } : m))
    )
  }

  const mockMoments: DetectedMoment[] = [
    {
      id: "m1",
      start: "00:05:32",
      end: "00:06:45",
      duration: "1:13",
      hook: "Fear & Greed chegou a 5, gente. CINCO.",
      description: "Análise do índice Fear & Greed em nível histórico de medo, comparando com crises anteriores",
      score: 9,
      tags: ["crypto", "mercado", "hot-take"],
      selected: true,
    },
    {
      id: "m2",
      start: "00:12:18",
      end: "00:13:40",
      duration: "1:22",
      hook: "O maior erro que vocês cometem é...",
      description: "Explicação sobre DCA e por que a maioria erra no timing de compra",
      score: 8,
      tags: ["educação", "DCA", "insight"],
      selected: true,
    },
    {
      id: "m3",
      start: "00:28:45",
      end: "00:30:10",
      duration: "1:25",
      hook: "Olha esse gráfico do Bitcoin aqui",
      description: "Análise técnica do BTC mostrando suporte em 58k e resistência em 72k",
      score: 7,
      tags: ["BTC", "análise-técnica", "gráfico"],
      selected: false,
    },
    {
      id: "m4",
      start: "00:45:22",
      end: "00:46:30",
      duration: "1:08",
      hook: "Solana vai flippar Ethereum? Eu acho que...",
      description: "Opinião controversa sobre SOL vs ETH com dados de TVL e volume",
      score: 9,
      tags: ["SOL", "ETH", "hot-take", "polêmico"],
      selected: true,
    },
    {
      id: "m5",
      start: "01:02:10",
      end: "01:03:25",
      duration: "1:15",
      hook: "Se você tá começando com R$100...",
      description: "Estratégia prática para iniciantes com pouco capital em crypto",
      score: 8,
      tags: ["iniciante", "estratégia", "prático"],
      selected: false,
    },
  ]

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Live Cutter</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create AI-powered vertical cuts from live streams — V24 Cinema Edition
          </p>
        </div>
        {!isConnected && (
          <Badge variant="destructive">Gateway Disconnected</Badge>
        )}
      </div>

      {!videoPath ? (
        <Card
          className={`transition-colors ${isDragging ? "ring-2 ring-primary border-primary bg-primary/5" : "border-dashed"}`}
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true) }}
          onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true) }}
          onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false) }}
          onDrop={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setIsDragging(false)
            const file = e.dataTransfer.files?.[0]
            if (file) {
              setVideoPath((file as unknown as { path: string }).path || file.name)
              setVideoName(file.name)
            }
          }}
        >
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className={`h-16 w-16 rounded-2xl flex items-center justify-center mb-4 transition-colors ${isDragging ? "bg-primary/20" : "bg-secondary"}`}>
              <Upload className={`h-8 w-8 ${isDragging ? "text-primary" : "text-muted-foreground"}`} />
            </div>
            <p className="text-sm font-medium mb-1">
              {isDragging ? "Drop your video here" : "Drag & drop your live recording"}
            </p>
            <p className="text-xs text-muted-foreground mb-4">MP4, MOV, MKV, or WebM</p>
            <div className="flex items-center gap-3">
              <Separator className="w-12" />
              <span className="text-xs text-muted-foreground">or</span>
              <Separator className="w-12" />
            </div>
            <div className="flex items-center gap-2 mt-4">
              <input
                type="text"
                placeholder="Paste file path here..."
                className="h-9 w-[320px] rounded-md border bg-background px-3 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-ring"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const val = (e.target as HTMLInputElement).value.trim()
                    if (val) {
                      setVideoPath(val)
                      setVideoName(val.split("/").pop() || val)
                    }
                  }
                }}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setMoments(mockMoments)
                  setVideoPath("/demo/live-recording.mp4")
                  setVideoName("live-recording.mp4")
                  setStatus("done")
                }}
              >
                <Eye className="h-4 w-4" />
                Demo
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                <FileVideo className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{videoName || videoPath.split("/").pop()}</p>
                <p className="text-[11px] text-muted-foreground font-mono truncate">{videoPath}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => { setVideoPath(""); setVideoName(""); setMoments([]); setCuts([]); setStatus("idle") }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              <Button
                onClick={handleAnalyze}
                disabled={!isConnected || status === "transcribing" || status === "analyzing"}
              >
                {status === "transcribing" || status === "analyzing" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {status === "transcribing" ? "Transcribing..." : "Analyzing..."}
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Analyze with AI
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-2">
        {(["detect", "cuts", "publish"] as const).map((tab) => (
          <Button
            key={tab}
            variant={activeTab === tab ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setActiveTab(tab)}
            className="capitalize"
          >
            {tab === "detect" && <Sparkles className="h-3.5 w-3.5 mr-1.5" />}
            {tab === "cuts" && <Scissors className="h-3.5 w-3.5 mr-1.5" />}
            {tab === "publish" && <Send className="h-3.5 w-3.5 mr-1.5" />}
            {tab === "detect" ? "Detected Moments" : tab === "cuts" ? "Cuts" : "Publish"}
            {tab === "detect" && moments.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 text-[10px]">{moments.length}</Badge>
            )}
            {tab === "cuts" && (cuts.length + existingCuts.length) > 0 && (
              <Badge variant="secondary" className="ml-1.5 text-[10px]">{cuts.length + existingCuts.length}</Badge>
            )}
          </Button>
        ))}
      </div>

      {activeTab === "detect" && (
        <div className="space-y-4">
          {moments.length > 0 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {moments.filter((m) => m.selected).length} of {moments.length} moments selected
              </p>
              <Button
                size="sm"
                onClick={handleCreateAll}
                disabled={moments.filter((m) => m.selected).length === 0}
              >
                <Scissors className="h-4 w-4" />
                Create Selected Cuts ({moments.filter((m) => m.selected).length})
              </Button>
            </div>
          )}

          {moments.length === 0 && status === "idle" && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <Film className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-sm font-medium text-muted-foreground">No moments detected yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Enter a video path and click "Analyze with AI" to detect the best moments
                </p>
              </CardContent>
            </Card>
          )}

          <div className="space-y-3">
            {moments.map((moment) => (
              <MomentCard
                key={moment.id}
                moment={moment}
                onToggle={() => toggleMoment(moment.id)}
                onCreateCut={() => handleCreateCut(moment)}
              />
            ))}
          </div>
        </div>
      )}

      {activeTab === "cuts" && (
        <div className="space-y-4">
          {cuts.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">In Progress</p>
              {cuts.map((cut) => <CutCard key={cut.id} cut={cut} />)}
            </div>
          )}

          <CutsLibrary existingCuts={existingCuts} onRefresh={loadExistingCuts} />
        </div>
      )}

      {activeTab === "publish" && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Publish Cuts</CardTitle>
              <CardDescription>Publish finished cuts to all platforms</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {["X / Twitter", "YouTube Shorts", "TikTok", "Instagram Reels", "WhatsApp"].map((platform) => (
                  <div key={platform} className="flex items-center justify-between p-3 rounded-lg border">
                    <span className="text-sm font-medium">{platform}</span>
                    <Button variant="outline" size="sm" className="h-7 text-xs" disabled={cuts.filter((c) => c.status === "done").length === 0}>
                      <Send className="h-3 w-3" />
                      Publish
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">V24 Cinema Edition Standard</CardTitle>
              <CardDescription>All cuts follow the approved visual pattern</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <SpecRow label="Resolution" value="1080x1920" />
                <SpecRow label="Codec" value="libx264, CRF 23" />
                <SpecRow label="Audio" value="AAC 128k stereo" />
                <SpecRow label="FPS" value="30" />
                <SpecRow label="Header" value="@caiovicentino + 3 logos" />
                <SpecRow label="Webcam" value="Zoom crop 370x580" />
                <SpecRow label="Screen" value="Crop 900x500" />
                <SpecRow label="Subtitles" value="FontSize=16, Bold" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

function MomentCard({
  moment,
  onToggle,
  onCreateCut,
}: {
  moment: DetectedMoment
  onToggle: () => void
  onCreateCut: () => void
}) {
  const scoreColor = moment.score >= 8 ? "text-emerald-400" : moment.score >= 6 ? "text-amber-400" : "text-zinc-400"

  return (
    <Card className={moment.selected ? "ring-1 ring-primary" : ""}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <button
            onClick={onToggle}
            className={`h-5 w-5 rounded border shrink-0 mt-0.5 flex items-center justify-center transition-colors ${
              moment.selected ? "bg-primary border-primary" : "border-input hover:border-primary"
            }`}
          >
            {moment.selected && <CheckCircle2 className="h-3.5 w-3.5 text-primary-foreground" />}
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-medium">"{moment.hook}"</span>
              <span className={`text-sm font-bold ${scoreColor}`}>{moment.score}/10</span>
            </div>
            <p className="text-xs text-muted-foreground mb-2">{moment.description}</p>

            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {moment.start} → {moment.end}
              </span>
              <span className="flex items-center gap-1">
                <FileVideo className="h-3 w-3" />
                {moment.duration}
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5 mt-2">
              {moment.tags.map((tag) => (
                <Badge key={tag} variant="outline" className="text-[10px]">{tag}</Badge>
              ))}
            </div>
          </div>

          <Button variant="outline" size="sm" className="shrink-0" onClick={onCreateCut}>
            <Scissors className="h-3.5 w-3.5" />
            Cut
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function CutCard({ cut }: { cut: Cut }) {
  const statusConfig = {
    idle: { icon: FileVideo, color: "text-zinc-400", label: "Pending" },
    transcribing: { icon: Loader2, color: "text-blue-400 animate-spin", label: "Transcribing" },
    analyzing: { icon: Loader2, color: "text-blue-400 animate-spin", label: "Analyzing" },
    cutting: { icon: Loader2, color: "text-amber-400 animate-spin", label: "Cutting..." },
    done: { icon: CheckCircle2, color: "text-emerald-400", label: "Done" },
    error: { icon: AlertCircle, color: "text-red-400", label: "Error" },
  }

  const config = statusConfig[cut.status]
  const StatusIcon = config.icon

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <StatusIcon className={`h-5 w-5 ${config.color}`} />
            <div>
              <p className="text-sm font-medium">{cut.name}</p>
              <p className="text-[11px] text-muted-foreground">
                {cut.start} → {cut.end}
                {cut.fileSize && ` · ${cut.fileSize}`}
                {cut.duration && ` · ${cut.duration}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={cut.status === "done" ? "success" : cut.status === "error" ? "destructive" : "secondary"}>
              {config.label}
            </Badge>
            {cut.status === "done" && (
              <Button variant="outline" size="sm" className="h-7 text-xs">
                <Eye className="h-3 w-3" />
                Preview
              </Button>
            )}
          </div>
        </div>
        {cut.error && (
          <p className="text-xs text-red-400 mt-2">{cut.error}</p>
        )}
      </CardContent>
    </Card>
  )
}

type TimeFilter = "all" | "today" | "7d" | "30d"

type ExistingCut = {
  name: string; path: string; size: string; duration: string; createdAt: string; previewPath: string | null
}

function CutsLibrary({ existingCuts, onRefresh }: { existingCuts: ExistingCut[]; onRefresh: () => void }) {
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all")
  const [search, setSearch] = useState("")

  const now = Date.now()
  const filtered = existingCuts.filter((ec) => {
    if (search && !ec.name.toLowerCase().includes(search.toLowerCase()) && !ec.path.toLowerCase().includes(search.toLowerCase())) {
      return false
    }
    if (timeFilter === "all") return true
    const created = new Date(ec.createdAt).getTime()
    const dayMs = 86400000
    if (timeFilter === "today") return now - created < dayMs
    if (timeFilter === "7d") return now - created < 7 * dayMs
    if (timeFilter === "30d") return now - created < 30 * dayMs
    return true
  })

  const timeFilters: { id: TimeFilter; label: string }[] = [
    { id: "all", label: `All (${existingCuts.length})` },
    { id: "today", label: "Today" },
    { id: "7d", label: "7 days" },
    { id: "30d", label: "30 days" },
  ]

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          {timeFilters.map((f) => (
            <Button
              key={f.id}
              variant={timeFilter === f.id ? "secondary" : "ghost"}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setTimeFilter(f.id)}
            >
              {f.label}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search cuts..."
              className="h-7 w-[160px] rounded-md border bg-background pl-8 pr-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onRefresh}>
            <Loader2 className="h-3 w-3" />
            Refresh
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Scissors className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm font-medium text-muted-foreground">No cuts found</p>
            <p className="text-xs text-muted-foreground mt-1">
              {search ? "Try a different search term" : "No cuts match the selected filter"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">{filtered.length} cuts</p>
          <div className="space-y-2">
            {filtered.map((ec) => (
              <ExistingCutCard key={ec.path} cut={ec} />
            ))}
          </div>
        </>
      )}
    </>
  )
}

function ExistingCutCard({ cut }: { cut: ExistingCut }) {
  const api = typeof window !== "undefined" ? window.api : null

  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => api?.cuts.open(cut.path)}
            className="h-9 w-9 rounded-lg bg-secondary flex items-center justify-center shrink-0 hover:bg-primary/20 transition-colors"
            title="Play"
          >
            <Play className="h-4 w-4 text-muted-foreground ml-0.5" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate capitalize">{cut.name}</p>
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              <span>{cut.size}</span>
              {cut.duration && <span>{cut.duration}</span>}
              <span>{new Date(cut.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              title="Show in Finder"
              onClick={() => api?.cuts.showInFolder(cut.path)}
            >
              <FolderOpen className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              title="Publish"
              onClick={() => {}}
            >
              <Share2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function SpecRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between p-2 rounded bg-accent/30">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono font-medium">{value}</span>
    </div>
  )
}
