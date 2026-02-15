import { useState, useEffect, useCallback } from "react"
import {
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Loader2,
  Search,
  ExternalLink,
  BarChart3,
  DollarSign,
  Activity,
  Clock,
  Flame,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

type MarketTab = "predictions" | "perpetuals"

export function MarketsPage() {
  const [tab, setTab] = useState<MarketTab>("perpetuals")

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Markets</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time market data from Polymarket and Hyperliquid
          </p>
        </div>
      </div>

      <div className="flex gap-1 p-1 rounded-lg bg-secondary/50 w-fit">
        <button
          onClick={() => setTab("perpetuals")}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            tab === "perpetuals" ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Perpetuals
        </button>
        <button
          onClick={() => setTab("predictions")}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            tab === "predictions" ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Predictions
        </button>
      </div>

      {tab === "perpetuals" && <PerpetualsTab />}
      {tab === "predictions" && <PredictionsTab />}
    </div>
  )
}

type PerpCategory = "all" | "crypto" | "stocks" | "commodities" | "preipo"

interface HLPerp {
  coin: string
  displayName: string
  dex: string
  category: PerpCategory
  markPx: number
  prevDayPx: number
  change24h: number
  funding: number
  openInterest: number
  volume24h: number
  maxLeverage: number
  oraclePx: number
}

const STOCK_EXACT = new Set(["TSLA", "NVDA", "AAPL", "GOOGL", "AMZN", "MSFT", "META", "HOOD", "INTC", "PLTR", "COIN", "MSTR", "AMD", "ORCL", "MU", "BABA", "SNDK", "USAR", "CRWV", "RIVN", "MAG7", "INFOTECH", "SEMIS", "ROBOT", "NUCLEAR", "DEFENSE", "ENERGY", "BIOTECH", "XYZ100", "US500", "USA500", "USTECH", "SMALL2000", "USENERGY", "EUR", "USBOND", "USDJPY"])
const COMMODITY_EXACT = new Set(["GOLD", "SILVER", "COPPER", "PLATINUM", "PALLADIUM", "OIL", "USOIL", "GAS", "NATGAS", "PAXG", "URNM"])
const PREIPO_EXACT = new Set(["OPENAI", "SPACEX", "ANTHROPIC", "CRCL", "STRIPE"])

function classifyPerp(coin: string, dex: string): PerpCategory {
  const upper = coin.toUpperCase()
  if (PREIPO_EXACT.has(upper)) return "preipo"
  if (COMMODITY_EXACT.has(upper)) return "commodities"
  if (STOCK_EXACT.has(upper)) return "stocks"
  if (dex && !["hyna"].includes(dex)) return "stocks"
  return "crypto"
}

const HIP3_DEXES = ["xyz", "cash", "vntl", "km", "flx"]

function PerpetualsTab() {
  const [perps, setPerps] = useState<HLPerp[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [sortBy, setSortBy] = useState<"volume" | "oi" | "change" | "funding">("volume")
  const [category, setCategory] = useState<PerpCategory>("all")

  const fetchHL = useCallback(async (body: Record<string, unknown>): Promise<{ data?: unknown; error?: string }> => {
    if (typeof window !== "undefined" && window.api?.fetch) {
      return window.api.fetch.post("https://api.hyperliquid.xyz/info", body)
    }
    const res = await fetch("https://api.hyperliquid.xyz/info", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    return { data: await res.json() }
  }, [])

  const parsePerps = (raw: unknown): HLPerp[] => {
    const data = raw as [{ universe: Array<{ name: string; maxLeverage: number; isDelisted?: boolean }> }, Array<Record<string, string>>]
    if (!Array.isArray(data) || data.length < 2) return []
    const meta = data[0].universe
    const ctxs = data[1]
    const result: HLPerp[] = []
    for (let i = 0; i < meta.length; i++) {
      const asset = meta[i]
      if ((asset as Record<string, unknown>).isDelisted) continue
      const ctx = ctxs[i] || {}
      const markPx = parseFloat(ctx.markPx || "0")
      const prevDayPx = parseFloat(ctx.prevDayPx || "0")
      const volume24h = parseFloat(ctx.dayNtlVlm || "0")
      const openInterest = parseFloat(ctx.openInterest || "0")
      if (markPx === 0 && volume24h === 0) continue
      const change24h = prevDayPx > 0 ? ((markPx - prevDayPx) / prevDayPx) * 100 : 0
      const coinName = asset.name || ""
      const parts = coinName.split(":")
      const dex = parts.length > 1 ? parts[0] : ""
      const displayName = parts.length > 1 ? parts[1] : coinName
      result.push({
        coin: coinName, displayName, dex,
        category: classifyPerp(displayName, dex),
        markPx, prevDayPx,
        change24h: isNaN(change24h) ? 0 : change24h,
        funding: parseFloat(ctx.funding || "0") * 100,
        openInterest, volume24h,
        maxLeverage: asset.maxLeverage,
        oraclePx: parseFloat(ctx.oraclePx || "0"),
      })
    }
    return result
  }

  const loadData = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const requests = [
        fetchHL({ type: "metaAndAssetCtxs" }),
        ...HIP3_DEXES.map((dex) => fetchHL({ type: "metaAndAssetCtxs", dex })),
      ]
      const results = await Promise.all(requests)

      const mapped: HLPerp[] = []
      for (const r of results) {
        if (r.error || !r.data) continue
        mapped.push(...parsePerps(r.data))
      }

      setPerps(mapped)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 30000)
    return () => clearInterval(interval)
  }, [loadData])

  const filtered = perps
    .filter((p) => category === "all" || p.category === category)
    .filter((p) => !search || p.coin.toLowerCase().includes(search.toLowerCase()) || p.displayName.toLowerCase().includes(search.toLowerCase()))

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === "volume") return b.volume24h - a.volume24h
    if (sortBy === "oi") return b.openInterest - a.openInterest
    if (sortBy === "change") return Math.abs(b.change24h) - Math.abs(a.change24h)
    if (sortBy === "funding") return Math.abs(b.funding) - Math.abs(a.funding)
    return 0
  })

  const totalVol = perps.reduce((s, p) => s + p.volume24h, 0)
  const totalOI = perps.reduce((s, p) => s + p.openInterest, 0)

  return (
    <>
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">Perp Markets</span>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-xl font-semibold">{perps.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">24h Volume</span>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-xl font-semibold">{fmtUsd(totalVol)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">Open Interest</span>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-xl font-semibold">{fmtUsd(totalOI)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-1 p-1 rounded-lg bg-secondary/50 w-fit">
        {([
          { id: "all", label: "All" },
          { id: "crypto", label: "Crypto" },
          { id: "stocks", label: "Stocks" },
          { id: "commodities", label: "Commodities" },
          { id: "preipo", label: "Pre-IPO" },
        ] as const).map((c) => (
          <button
            key={c.id}
            onClick={() => setCategory(c.id)}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              category === c.id ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {c.label}
            {c.id !== "all" && (
              <span className="ml-1 text-[10px] text-muted-foreground">
                {perps.filter((p) => p.category === c.id).length}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex gap-1.5">
          {(["volume", "oi", "change", "funding"] as const).map((s) => (
            <Button key={s} variant={sortBy === s ? "secondary" : "ghost"} size="sm" onClick={() => setSortBy(s)} className="capitalize text-xs">
              {s === "oi" ? "Open Interest" : s === "change" ? "24h Change" : s === "funding" ? "Funding" : "Volume"}
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
              placeholder="Search coins..."
              className="h-8 w-[160px] rounded-md border bg-background pl-8 pr-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <Button variant="outline" size="sm" onClick={loadData} disabled={isLoading}>
            {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>

      {error ? (
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-sm text-red-400">{error}</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={loadData}>Retry</Button>
          </CardContent>
        </Card>
      ) : isLoading && perps.length === 0 ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="rounded-xl border bg-card">
          <div className="grid grid-cols-[1fr_100px_100px_90px_100px_90px_60px] gap-2 px-4 py-2.5 border-b text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            <span>Coin</span>
            <span className="text-right">Price</span>
            <span className="text-right">24h Change</span>
            <span className="text-right">Funding/h</span>
            <span className="text-right">Open Interest</span>
            <span className="text-right">24h Volume</span>
            <span className="text-right">Lev</span>
          </div>
          {sorted.map((p) => (
            <div
              key={p.coin}
              className="grid grid-cols-[1fr_100px_100px_90px_100px_90px_60px] gap-2 px-4 py-2 border-b border-border/50 hover:bg-accent/20 transition-colors items-center"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{p.displayName}</span>
                {p.dex && (
                  <Badge variant="outline" className="text-[9px] px-1 py-0">{p.dex}</Badge>
                )}
                {p.category === "commodities" && (
                  <Badge variant="secondary" className="text-[9px] px-1 py-0 bg-amber-500/15 text-amber-400">Gold</Badge>
                )}
              </div>
              <span className="text-sm font-mono text-right">{fmtPrice(p.markPx)}</span>
              <span className={`text-sm font-mono text-right ${p.change24h >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {p.change24h >= 0 ? "+" : ""}{p.change24h.toFixed(2)}%
              </span>
              <span className={`text-xs font-mono text-right ${p.funding >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {p.funding >= 0 ? "+" : ""}{p.funding.toFixed(4)}%
              </span>
              <span className="text-xs font-mono text-right text-muted-foreground">{fmtUsd(p.openInterest)}</span>
              <span className="text-xs font-mono text-right text-muted-foreground">{fmtUsd(p.volume24h)}</span>
              <span className="text-xs font-mono text-right text-muted-foreground">{p.maxLeverage}x</span>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

interface PolyEvent {
  id: string
  title: string
  slug: string
  endDate: string
  markets: Array<{ outcomePrices: string; volume: string; liquidity: string; outcomes: string }>
  volume: number
  liquidity: number
}

function PredictionsTab() {
  const [events, setEvents] = useState<PolyEvent[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")

  const loadEvents = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const url = "https://gamma-api.polymarket.com/events?active=true&closed=false&order=volume24hr&ascending=false&limit=30"
      let data: unknown
      if (typeof window !== "undefined" && window.api?.fetch) {
        const result = await window.api.fetch.json(url)
        if (result.error) throw new Error(result.error)
        data = result.data
      } else {
        const res = await fetch(url)
        data = await res.json()
      }

      const mapped = (Array.isArray(data) ? data : []).map((e: Record<string, unknown>) => ({
        id: String(e.id || ""),
        title: String(e.title || ""),
        slug: String(e.slug || ""),
        endDate: String(e.endDate || ""),
        markets: Array.isArray(e.markets) ? e.markets.map((m: Record<string, unknown>) => ({
          outcomePrices: String(m.outcomePrices || "[]"),
          volume: String(m.volume || "0"),
          liquidity: String(m.liquidity || "0"),
          outcomes: String(m.outcomes || '["Yes","No"]'),
        })) : [],
        volume: Number(e.volume || 0),
        liquidity: Number(e.liquidity || 0),
      }))
      setEvents(mapped)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadEvents()
  }, [loadEvents])

  const filtered = search ? events.filter((e) => e.title.toLowerCase().includes(search.toLowerCase())) : events
  const totalVol = events.reduce((s, e) => s + e.volume, 0)

  return (
    <>
      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Active Events</p><p className="text-xl font-semibold mt-1">{events.length}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Volume</p><p className="text-xl font-semibold mt-1">{fmtUsd(totalVol)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Liquidity</p><p className="text-xl font-semibold mt-1">{fmtUsd(events.reduce((s, e) => s + e.liquidity, 0))}</p></CardContent></Card>
      </div>

      <div className="flex items-center justify-between">
        <Badge variant="outline" className="text-xs">Polymarket</Badge>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search events..." className="h-8 w-[160px] rounded-md border bg-background pl-8 pr-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring" />
          </div>
          <Button variant="outline" size="sm" onClick={loadEvents} disabled={isLoading}>
            {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>

      {error ? (
        <Card><CardContent className="p-4 text-center"><p className="text-sm text-red-400">{error}</p><Button variant="outline" size="sm" className="mt-2" onClick={loadEvents}>Retry</Button></CardContent></Card>
      ) : isLoading && events.length === 0 ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="space-y-2">
          {filtered.map((event) => {
            const m = event.markets[0]
            if (!m) return null
            const prices = safeJsonParse(m.outcomePrices) as number[]
            const outcomes = safeJsonParse(m.outcomes) as string[]
            const yesPct = Math.round((prices[0] || 0) * 100)
            const noPct = Math.round((prices[1] || 1 - (prices[0] || 0)) * 100)
            const endTime = timeUntil(event.endDate)

            return (
              <Card key={event.id} className="hover:bg-accent/20 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <p className="text-sm font-medium leading-snug">{event.title}</p>
                    <a href={`https://polymarket.com/event/${event.slug}`} target="_blank" rel="noopener noreferrer" className="shrink-0" onClick={(e) => { e.preventDefault(); window.open(`https://polymarket.com/event/${event.slug}`, "_blank") }}>
                      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                    </a>
                  </div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
                      <div className="h-full rounded-full bg-emerald-500" style={{ width: `${yesPct}%` }} />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-emerald-400">{outcomes[0] || "Yes"} {yesPct}%</span>
                    <span className="text-xs font-medium text-red-400">{outcomes[1] || "No"} {noPct}%</span>
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-[11px] text-muted-foreground">
                    <span>Vol: {fmtUsd(event.volume)}</span>
                    <span>Liq: {fmtUsd(event.liquidity)}</span>
                    {endTime && <span>{endTime}</span>}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </>
  )
}

function fmtUsd(v: number): string {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`
  if (v >= 1e3) return `$${(v / 1e3).toFixed(1)}K`
  return `$${v.toFixed(0)}`
}

function fmtPrice(v: number): string {
  if (v >= 10000) return `$${v.toFixed(0)}`
  if (v >= 1) return `$${v.toFixed(2)}`
  if (v >= 0.01) return `$${v.toFixed(4)}`
  return `$${v.toFixed(6)}`
}

function timeUntil(d: string): string {
  if (!d) return ""
  const diff = new Date(d).getTime() - Date.now()
  if (diff < 0) return "Ended"
  const days = Math.floor(diff / 86400000)
  if (days > 30) return `${Math.floor(days / 30)}mo left`
  if (days > 0) return `${days}d left`
  return `${Math.floor(diff / 3600000)}h left`
}

function safeJsonParse(s: string): unknown {
  try { return JSON.parse(s) } catch { return [] }
}
