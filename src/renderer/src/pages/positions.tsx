import { useState, useEffect, useCallback } from "react"
import type { GatewayClient } from "@/lib/gateway-client"
import {
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  DollarSign,
  Percent,
  Clock,
  ExternalLink,
  AlertTriangle,
  Coins,
  Target,
  Activity,
  ChevronRight,
  Search,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

// ─── Types ───

interface HyperliquidPosition {
  coin: string
  szi: string // size (negative = short)
  entryPx: string
  positionValue: string
  unrealizedPnl: string
  returnOnEquity: string
  leverage: { type: string; value: number }
  liquidationPx: string | null
  marginUsed: string
  maxLeverage: number
}

interface HyperliquidSpotBalance {
  coin: string
  hold: string
  total: string
  entryNtl: string
  token: number
}

interface HyperliquidAccountState {
  marginSummary: {
    accountValue: string
    totalNtlPos: string
    totalRawUsd: string
    totalMarginUsed: string
  }
  crossMarginSummary: {
    accountValue: string
    totalNtlPos: string
    totalRawUsd: string
    totalMarginUsed: string
  }
  assetPositions: Array<{
    position: HyperliquidPosition
    type: string
  }>
  crossMaintenanceMarginUsed: string
}

interface PolymarketPosition {
  market: string
  outcome: string
  size: number
  avgPrice: number
  curPrice: number
  pnl: number
  pnlPercent: number
  conditionId: string
  questionTitle: string
}

interface PositionsPageProps {
  client: GatewayClient
  isConnected: boolean
}

// ─── Helpers ───

function fmt(n: number, decimals = 2): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(2)}K`
  return `$${n.toFixed(decimals)}`
}

function fmtNum(n: number, decimals = 2): string {
  return n.toFixed(decimals)
}

function pnlColor(n: number): string {
  if (n > 0) return "text-emerald-400"
  if (n < 0) return "text-red-400"
  return "text-muted-foreground"
}

function pnlBg(n: number): string {
  if (n > 0) return "bg-emerald-500/10 border-emerald-500/20"
  if (n < 0) return "bg-red-500/10 border-red-500/20"
  return "bg-secondary border-border"
}

// ─── Component ───

export function PositionsPage({ client, isConnected }: PositionsPageProps) {
  const [activeTab, setActiveTab] = useState<"hyperliquid" | "polymarket">("hyperliquid")
  const [walletAddress, setWalletAddress] = useState("")
  const [polyWalletAddress, setPolyWalletAddress] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Hyperliquid state
  const [hlAccountState, setHlAccountState] = useState<HyperliquidAccountState | null>(null)
  const [hlSpotBalances, setHlSpotBalances] = useState<HyperliquidSpotBalance[]>([])
  const [hlSpotMeta, setHlSpotMeta] = useState<Array<{ name: string; tokens: Array<{ name: string; index: number }> }>>([])

  // Polymarket state
  const [polyPositions, setPolyPositions] = useState<PolymarketPosition[]>([])

  // Auto-load wallet from Privy — prefer wallet WITH policies (active server wallet)
  useEffect(() => {
    window.api.fetch.privy("GET", "/v1/wallets").then((result) => {
      const data = result.data as { data?: Array<{ address: string; chain_type: string; policy_ids?: string[]; created_at?: string }> }
      if (data?.data?.length) {
        const evmWallets = data.data.filter((w) => w.chain_type === "ethereum")
        if (evmWallets.length === 0) return

        // Priority: wallet with policies > most recently created
        const withPolicy = evmWallets.find((w) => w.policy_ids && w.policy_ids.length > 0)
        const chosen = withPolicy || evmWallets.sort((a, b) => {
          const da = new Date(a.created_at || 0).getTime()
          const db = new Date(b.created_at || 0).getTime()
          return db - da // newest first
        })[0]

        if (chosen) {
          console.log("[Positions] Using wallet:", chosen.address, "policies:", chosen.policy_ids?.length || 0)
          setWalletAddress(chosen.address)
          setPolyWalletAddress(chosen.address)
        }
      }
    }).catch(() => {})
  }, [])

  // ─── Hyperliquid Fetchers ───

  const fetchHyperliquid = useCallback(async (address: string) => {
    if (!address) return

    try {
      // Fetch perp state
      const stateRes = await fetch("https://api.hyperliquid.xyz/info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "clearinghouseState", user: address }),
      })
      const stateData = await stateRes.json()
      setHlAccountState(stateData)

      // Fetch spot balances
      const spotRes = await fetch("https://api.hyperliquid.xyz/info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "spotClearinghouseState", user: address }),
      })
      const spotData = await spotRes.json()
      setHlSpotBalances(spotData?.balances || [])

      // Fetch spot meta for token names
      const metaRes = await fetch("https://api.hyperliquid.xyz/info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "spotMeta" }),
      })
      const metaData = await metaRes.json()
      setHlSpotMeta(metaData?.universe || [])
    } catch (e) {
      console.error("[Positions] Hyperliquid fetch error:", e)
      throw e
    }
  }, [])

  // ─── Polymarket Fetcher ───

  const fetchPolymarket = useCallback(async (address: string) => {
    if (!address) return

    try {
      // Fetch positions from Gamma API
      const res = await fetch(`https://gamma-api.polymarket.com/positions?user=${address.toLowerCase()}&sizeThreshold=0.1`)
      const data = await res.json()

      if (Array.isArray(data)) {
        const positions: PolymarketPosition[] = data.map((p: Record<string, unknown>) => {
          const size = Number(p.size || 0)
          const avgPrice = Number(p.avgPrice || 0)
          const curPrice = Number(p.curPrice || p.price || 0)
          const pnl = size * (curPrice - avgPrice)
          const pnlPercent = avgPrice > 0 ? ((curPrice - avgPrice) / avgPrice) * 100 : 0

          return {
            market: String(p.market || ""),
            outcome: String(p.outcome || p.title || ""),
            size,
            avgPrice,
            curPrice,
            pnl,
            pnlPercent,
            conditionId: String(p.conditionId || p.condition_id || ""),
            questionTitle: String(p.title || p.question || p.market || ""),
          }
        }).filter((p: PolymarketPosition) => p.size > 0)

        setPolyPositions(positions)
      }
    } catch (e) {
      console.error("[Positions] Polymarket fetch error:", e)
      throw e
    }
  }, [])

  // ─── Load All ───

  const loadPositions = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const promises: Promise<void>[] = []
      if (walletAddress) promises.push(fetchHyperliquid(walletAddress))
      if (polyWalletAddress) promises.push(fetchPolymarket(polyWalletAddress))
      if (promises.length === 0) {
        setError("No wallet address configured. Create one in the Wallets page or enter manually.")
        setIsLoading(false)
        return
      }
      await Promise.allSettled(promises)
      setLastUpdated(new Date().toLocaleTimeString())
    } catch {
      setError("Failed to fetch some positions")
    } finally {
      setIsLoading(false)
    }
  }, [walletAddress, polyWalletAddress, fetchHyperliquid, fetchPolymarket])

  // Auto-load when wallet address is set
  useEffect(() => {
    if (walletAddress || polyWalletAddress) {
      loadPositions()
    }
  }, [walletAddress, polyWalletAddress]) // eslint-disable-line

  // Auto-refresh every 30s
  useEffect(() => {
    if (!walletAddress && !polyWalletAddress) return
    const interval = setInterval(loadPositions, 30000)
    return () => clearInterval(interval)
  }, [walletAddress, polyWalletAddress, loadPositions])

  // ─── Computed Values ───

  const hlPositions = hlAccountState?.assetPositions
    ?.map((ap) => ap.position)
    .filter((p) => Math.abs(parseFloat(p.szi)) > 0) || []

  const hlAccountValue = parseFloat(hlAccountState?.marginSummary?.accountValue || "0")
  const hlTotalMarginUsed = parseFloat(hlAccountState?.marginSummary?.totalMarginUsed || "0")
  const hlTotalPnl = hlPositions.reduce((sum, p) => sum + parseFloat(p.unrealizedPnl), 0)
  const hlTotalNotional = parseFloat(hlAccountState?.marginSummary?.totalNtlPos || "0")

  const spotWithValue = hlSpotBalances
    .filter((b) => parseFloat(b.total) > 0)
    .map((b) => {
      const total = parseFloat(b.total)
      const entryNtl = parseFloat(b.entryNtl || "0")
      return { ...b, totalNum: total, entryNtlNum: entryNtl }
    })

  const polyTotalPnl = polyPositions.reduce((sum, p) => sum + p.pnl, 0)
  const polyTotalValue = polyPositions.reduce((sum, p) => sum + (p.size * p.curPrice), 0)

  const totalPortfolioValue = hlAccountValue + polyTotalValue
  const totalPnl = hlTotalPnl + polyTotalPnl

  // ─── Render ───

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Positions</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Open positions across Hyperliquid & Polymarket
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-muted-foreground">Updated {lastUpdated}</span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={loadPositions}
            disabled={isLoading}
            className="gap-1.5"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Wallet Input */}
      {!walletAddress && (
        <Card className="border-dashed">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Wallet className="h-5 w-5 text-muted-foreground" />
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Enter wallet address (0x...)"
                  className="w-full bg-transparent border-none text-sm placeholder:text-muted-foreground focus:outline-none"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const val = (e.target as HTMLInputElement).value.trim()
                      if (val.startsWith("0x")) {
                        setWalletAddress(val)
                        setPolyWalletAddress(val)
                      }
                    }
                  }}
                />
              </div>
              <span className="text-xs text-muted-foreground">Press Enter</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Portfolio Summary Cards */}
      {(walletAddress || polyWalletAddress) && (
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <DollarSign className="h-3.5 w-3.5" />
                <span className="text-xs font-medium uppercase tracking-wider">Portfolio Value</span>
              </div>
              <p className="text-2xl font-bold">{fmt(totalPortfolioValue)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                {totalPnl >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                <span className="text-xs font-medium uppercase tracking-wider">Unrealized PnL</span>
              </div>
              <p className={cn("text-2xl font-bold", pnlColor(totalPnl))}>
                {totalPnl >= 0 ? "+" : ""}{fmt(totalPnl)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <BarChart3 className="h-3.5 w-3.5" />
                <span className="text-xs font-medium uppercase tracking-wider">Open Positions</span>
              </div>
              <p className="text-2xl font-bold">{hlPositions.length + polyPositions.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Target className="h-3.5 w-3.5" />
                <span className="text-xs font-medium uppercase tracking-wider">Margin Used</span>
              </div>
              <p className="text-2xl font-bold">{fmt(hlTotalMarginUsed)}</p>
              {hlAccountValue > 0 && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {fmtNum((hlTotalMarginUsed / hlAccountValue) * 100, 1)}% of account
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Error */}
      {error && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            <span className="text-sm text-amber-200">{error}</span>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      {(walletAddress || polyWalletAddress) && (
        <>
          <div className="flex gap-1 p-1 bg-secondary/50 rounded-lg w-fit">
            <button
              onClick={() => setActiveTab("hyperliquid")}
              className={cn(
                "px-4 py-1.5 rounded-md text-sm font-medium transition-colors",
                activeTab === "hyperliquid"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Hyperliquid
              {hlPositions.length > 0 && (
                <Badge variant="secondary" className="ml-2 text-[10px] px-1.5 py-0">{hlPositions.length}</Badge>
              )}
            </button>
            <button
              onClick={() => setActiveTab("polymarket")}
              className={cn(
                "px-4 py-1.5 rounded-md text-sm font-medium transition-colors",
                activeTab === "polymarket"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Polymarket
              {polyPositions.length > 0 && (
                <Badge variant="secondary" className="ml-2 text-[10px] px-1.5 py-0">{polyPositions.length}</Badge>
              )}
            </button>
          </div>

          {/* Hyperliquid Tab */}
          {activeTab === "hyperliquid" && (
            <div className="space-y-6">
              {/* Account Summary */}
              {hlAccountState && (
                <div className="grid grid-cols-4 gap-3">
                  <div className="p-3 rounded-lg bg-secondary/30 border border-border">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Account Value</p>
                    <p className="text-lg font-semibold">{fmt(hlAccountValue)}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-secondary/30 border border-border">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Total Notional</p>
                    <p className="text-lg font-semibold">{fmt(hlTotalNotional)}</p>
                  </div>
                  <div className={cn("p-3 rounded-lg border", pnlBg(hlTotalPnl))}>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Unrealized PnL</p>
                    <p className={cn("text-lg font-semibold", pnlColor(hlTotalPnl))}>
                      {hlTotalPnl >= 0 ? "+" : ""}{fmt(hlTotalPnl)}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-secondary/30 border border-border">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Free Margin</p>
                    <p className="text-lg font-semibold">{fmt(hlAccountValue - hlTotalMarginUsed)}</p>
                  </div>
                </div>
              )}

              {/* Perp Positions Table */}
              <div>
                <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Perpetual Positions
                  {hlPositions.length > 0 && (
                    <Badge variant="outline" className="text-[10px]">{hlPositions.length}</Badge>
                  )}
                </h3>

                {hlPositions.length === 0 ? (
                  <Card>
                    <CardContent className="p-8 text-center text-muted-foreground">
                      <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">No open perpetual positions</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="rounded-lg border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-secondary/30">
                          <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Asset</th>
                          <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Side</th>
                          <th className="px-4 py-2.5 text-right text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Size</th>
                          <th className="px-4 py-2.5 text-right text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Entry Price</th>
                          <th className="px-4 py-2.5 text-right text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Value</th>
                          <th className="px-4 py-2.5 text-right text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Unrealized PnL</th>
                          <th className="px-4 py-2.5 text-right text-[11px] font-medium uppercase tracking-wider text-muted-foreground">ROE</th>
                          <th className="px-4 py-2.5 text-right text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Leverage</th>
                          <th className="px-4 py-2.5 text-right text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Liq. Price</th>
                        </tr>
                      </thead>
                      <tbody>
                        {hlPositions.map((pos) => {
                          const size = parseFloat(pos.szi)
                          const isLong = size > 0
                          const pnl = parseFloat(pos.unrealizedPnl)
                          const roe = parseFloat(pos.returnOnEquity) * 100
                          const entryPx = parseFloat(pos.entryPx)
                          const value = parseFloat(pos.positionValue)
                          const lev = pos.leverage?.value || 0
                          const liqPx = pos.liquidationPx ? parseFloat(pos.liquidationPx) : null

                          return (
                            <tr key={pos.coin} className="border-b last:border-0 hover:bg-secondary/20 transition-colors">
                              <td className="px-4 py-3">
                                <span className="font-medium">{pos.coin}</span>
                              </td>
                              <td className="px-4 py-3">
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "text-[10px] font-semibold",
                                    isLong ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10" : "border-red-500/30 text-red-400 bg-red-500/10"
                                  )}
                                >
                                  {isLong ? "LONG" : "SHORT"}
                                </Badge>
                              </td>
                              <td className="px-4 py-3 text-right font-mono text-xs">
                                {fmtNum(Math.abs(size), 4)}
                              </td>
                              <td className="px-4 py-3 text-right font-mono text-xs">
                                ${fmtNum(entryPx, entryPx > 100 ? 2 : 4)}
                              </td>
                              <td className="px-4 py-3 text-right font-mono text-xs">
                                {fmt(value)}
                              </td>
                              <td className={cn("px-4 py-3 text-right font-mono text-xs font-semibold", pnlColor(pnl))}>
                                {pnl >= 0 ? "+" : ""}{fmt(pnl)}
                              </td>
                              <td className={cn("px-4 py-3 text-right font-mono text-xs font-semibold", pnlColor(roe))}>
                                {roe >= 0 ? "+" : ""}{fmtNum(roe, 2)}%
                              </td>
                              <td className="px-4 py-3 text-right font-mono text-xs">
                                <Badge variant="outline" className="text-[10px]">{lev}x</Badge>
                              </td>
                              <td className="px-4 py-3 text-right font-mono text-xs text-muted-foreground">
                                {liqPx ? `$${fmtNum(liqPx, liqPx > 100 ? 2 : 4)}` : "—"}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Spot Balances */}
              <div>
                <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <Coins className="h-4 w-4" />
                  Spot Balances
                  {spotWithValue.length > 0 && (
                    <Badge variant="outline" className="text-[10px]">{spotWithValue.length}</Badge>
                  )}
                </h3>

                {spotWithValue.length === 0 ? (
                  <Card>
                    <CardContent className="p-8 text-center text-muted-foreground">
                      <Coins className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">No spot balances</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="rounded-lg border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-secondary/30">
                          <th className="px-4 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Token</th>
                          <th className="px-4 py-2.5 text-right text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Balance</th>
                          <th className="px-4 py-2.5 text-right text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Entry Value</th>
                          <th className="px-4 py-2.5 text-right text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Hold</th>
                        </tr>
                      </thead>
                      <tbody>
                        {spotWithValue.map((bal) => {
                          // Resolve token name from spot meta
                          const tokenIndex = bal.token
                          let tokenName = `Token #${tokenIndex}`
                          for (const universe of hlSpotMeta) {
                            const found = universe.tokens?.find((t) => t.index === tokenIndex)
                            if (found) { tokenName = found.name; break }
                          }
                          if (bal.coin) tokenName = bal.coin

                          return (
                            <tr key={bal.coin || bal.token} className="border-b last:border-0 hover:bg-secondary/20 transition-colors">
                              <td className="px-4 py-3 font-medium">{tokenName}</td>
                              <td className="px-4 py-3 text-right font-mono text-xs">{fmtNum(bal.totalNum, 6)}</td>
                              <td className="px-4 py-3 text-right font-mono text-xs">{fmt(bal.entryNtlNum)}</td>
                              <td className="px-4 py-3 text-right font-mono text-xs text-muted-foreground">{fmtNum(parseFloat(bal.hold), 6)}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Wallet address footer */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Wallet className="h-3 w-3" />
                <span className="font-mono">{walletAddress}</span>
                <a
                  href={`https://app.hyperliquid.xyz/trade?address=${walletAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground transition-colors"
                  onClick={(e) => { e.preventDefault(); window.open(`https://app.hyperliquid.xyz/trade?address=${walletAddress}`, "_blank") }}
                >
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          )}

          {/* Polymarket Tab */}
          {activeTab === "polymarket" && (
            <div className="space-y-6">
              {/* Summary */}
              {polyPositions.length > 0 && (
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 rounded-lg bg-secondary/30 border border-border">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Positions Value</p>
                    <p className="text-lg font-semibold">{fmt(polyTotalValue)}</p>
                  </div>
                  <div className={cn("p-3 rounded-lg border", pnlBg(polyTotalPnl))}>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Unrealized PnL</p>
                    <p className={cn("text-lg font-semibold", pnlColor(polyTotalPnl))}>
                      {polyTotalPnl >= 0 ? "+" : ""}{fmt(polyTotalPnl)}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-secondary/30 border border-border">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Active Markets</p>
                    <p className="text-lg font-semibold">{polyPositions.length}</p>
                  </div>
                </div>
              )}

              {/* Positions */}
              <div>
                <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Active Positions
                  {polyPositions.length > 0 && (
                    <Badge variant="outline" className="text-[10px]">{polyPositions.length}</Badge>
                  )}
                </h3>

                {polyPositions.length === 0 ? (
                  <Card>
                    <CardContent className="p-8 text-center text-muted-foreground">
                      <Target className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">No active Polymarket positions</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Positions will appear when the agent places bets
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {polyPositions.map((pos, i) => (
                      <Card key={i} className="hover:bg-secondary/10 transition-colors">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium leading-snug">{pos.questionTitle}</p>
                              <div className="flex items-center gap-2 mt-2">
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "text-[10px]",
                                    pos.outcome.toLowerCase() === "yes"
                                      ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10"
                                      : "border-red-500/30 text-red-400 bg-red-500/10"
                                  )}
                                >
                                  {pos.outcome}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {fmtNum(pos.size, 2)} shares @ {fmtNum(pos.avgPrice * 100, 1)}¢
                                </span>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <p className={cn("text-sm font-semibold", pnlColor(pos.pnl))}>
                                {pos.pnl >= 0 ? "+" : ""}{fmt(pos.pnl)}
                              </p>
                              <p className={cn("text-xs", pnlColor(pos.pnlPercent))}>
                                {pos.pnlPercent >= 0 ? "+" : ""}{fmtNum(pos.pnlPercent, 1)}%
                              </p>
                              <div className="mt-1.5">
                                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                  <span>Now: {fmtNum(pos.curPrice * 100, 1)}¢</span>
                                </div>
                              </div>
                            </div>
                          </div>
                          {/* Probability bar */}
                          <div className="mt-3 h-1.5 bg-secondary rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full transition-all"
                              style={{ width: `${pos.curPrice * 100}%` }}
                            />
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>

              {/* Wallet address footer */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Wallet className="h-3 w-3" />
                <span className="font-mono">{polyWalletAddress}</span>
                <a
                  href={`https://polymarket.com/portfolio?address=${polyWalletAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground transition-colors"
                  onClick={(e) => { e.preventDefault(); window.open(`https://polymarket.com/portfolio?address=${polyWalletAddress}`, "_blank") }}
                >
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
