import { useState, useEffect, useCallback } from "react"
import type { GatewayClient } from "@/lib/gateway-client"
import {
  Wallet,
  Plus,
  Trash2,
  Copy,
  Check,
  ExternalLink,
  Shield,
  RefreshCw,
  AlertTriangle,
  ArrowUpRight,
  Coins,
  Key,
  Globe,
  Lock,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"

interface PrivyWallet {
  id: string
  address: string
  chain_type: string
  policy_ids: string[]
  created_at: string
}

interface PrivyPolicy {
  id: string
  name: string
  chain_type: string
  rules: Array<{
    name: string
    method: string
    action: string
  }>
}

interface WalletsPageProps {
  client: GatewayClient
  isConnected: boolean
}

const CHAIN_INFO: Record<string, { name: string; color: string; explorer: string }> = {
  ethereum: { name: "Ethereum", color: "#627EEA", explorer: "https://etherscan.io/address/" },
  solana: { name: "Solana", color: "#9945FF", explorer: "https://solscan.io/account/" },
  bitcoin: { name: "Bitcoin", color: "#F7931A", explorer: "https://mempool.space/address/" },
  cosmos: { name: "Cosmos", color: "#2E3148", explorer: "https://mintscan.io/cosmos/account/" },
  sui: { name: "Sui", color: "#6FBCF0", explorer: "https://suiscan.xyz/mainnet/account/" },
  aptos: { name: "Aptos", color: "#06D6A0", explorer: "https://explorer.aptoslabs.com/account/" },
  ton: { name: "TON", color: "#0098EA", explorer: "https://tonscan.org/address/" },
  near: { name: "NEAR", color: "#00EC97", explorer: "https://nearblocks.io/address/" },
  tron: { name: "TRON", color: "#FF0013", explorer: "https://tronscan.org/#/address/" },
  starknet: { name: "Starknet", color: "#EC796B", explorer: "https://starkscan.co/contract/" },
  stellar: { name: "Stellar", color: "#7D00FF", explorer: "https://stellarchain.io/accounts/" },
  spark: { name: "Spark", color: "#FF6B00", explorer: "" },
}

export function WalletsPage({ client, isConnected }: WalletsPageProps) {
  const [wallets, setWallets] = useState<PrivyWallet[]>([])
  const [policies, setPolicies] = useState<PrivyPolicy[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null)
  const [showCreateWallet, setShowCreateWallet] = useState(false)
  const [showCreatePolicy, setShowCreatePolicy] = useState(false)
  const [privyConfigured, setPrivyConfigured] = useState(false)
  
  // Create wallet form
  const [newWalletChain, setNewWalletChain] = useState("ethereum")
  const [selectedPolicyId, setSelectedPolicyId] = useState("")
  
  // Create policy form
  const [newPolicyName, setNewPolicyName] = useState("")
  const [newPolicyChain, setNewPolicyChain] = useState("ethereum")
  const [newPolicyMaxAmount, setNewPolicyMaxAmount] = useState("0.05")

  const isElectron = typeof window !== "undefined" && !!window.api

  // Check Privy configuration
  useEffect(() => {
    if (!isElectron) return
    window.api.privy.getConfig().then((config: { appId: string; hasSecret: boolean }) => {
      setPrivyConfigured(!!config.appId && config.hasSecret)
    })
  }, [isElectron])

  // Load wallets from Privy API
  const loadWallets = useCallback(async () => {
    if (!isElectron || !privyConfigured) return
    setIsLoading(true)
    setError(null)
    try {
      // Fetch wallets via authenticated Privy IPC
      const walletsResult = await (window.api.fetch as any).privy("GET", "/v1/wallets") as any

      if (walletsResult?.error) {
        if (walletsResult.error.includes("401") || walletsResult.error.includes("403")) {
          setError("Privy credentials invalid. Check your App ID and App Secret in Settings.")
        } else {
          setWallets([]) // May just have no wallets yet
        }
      } else if (walletsResult?.data) {
        const walletData = Array.isArray(walletsResult.data) ? walletsResult.data : walletsResult.data.data || []
        setWallets(walletData)
      }

      // Also fetch policies
      const policiesResult = await (window.api.fetch as any).privy("GET", "/v1/policies") as any
      if (policiesResult?.data) {
        const policyData = Array.isArray(policiesResult.data) ? policiesResult.data : policiesResult.data.data || []
        setPolicies(policyData)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load wallets")
    }
    setIsLoading(false)
  }, [isElectron, privyConfigured])

  useEffect(() => {
    if (privyConfigured) loadWallets()
  }, [privyConfigured, loadWallets])

  const handleCopyAddress = (address: string) => {
    navigator.clipboard.writeText(address)
    setCopiedAddress(address)
    setTimeout(() => setCopiedAddress(null), 2000)
  }

  const [isCreatingWallet, setIsCreatingWallet] = useState(false)
  const [isCreatingPolicy, setIsCreatingPolicy] = useState(false)

  const handleCreatePolicy = async () => {
    if (!isElectron || !newPolicyName.trim()) return
    setIsCreatingPolicy(true)
    try {
      // Convert ETH amount to wei
      const maxWei = BigInt(Math.floor(parseFloat(newPolicyMaxAmount) * 1e18)).toString()
      
      const result = await (window.api.fetch as any).privy("POST", "/v1/policies", {
        version: "1.0",
        name: newPolicyName,
        chain_type: newPolicyChain,
        rules: [{
          name: `Max ${newPolicyMaxAmount} per transaction`,
          method: newPolicyChain === "solana" ? "signAndSendTransaction" : "eth_sendTransaction",
          conditions: [{
            field_source: newPolicyChain === "solana" ? "solana_transaction" : "ethereum_transaction",
            field: "value",
            operator: "lte",
            value: maxWei,
          }],
          action: "ALLOW",
        }],
      }) as any

      if (result?.error) {
        setError(`Failed to create policy: ${result.error}`)
      } else {
        setShowCreatePolicy(false)
        setNewPolicyName("")
        setNewPolicyMaxAmount("0.05")
        await loadWallets()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create policy")
    }
    setIsCreatingPolicy(false)
  }

  const handleCreateWallet = async () => {
    if (!isElectron) return
    setIsCreatingWallet(true)
    try {
      const body: Record<string, unknown> = {
        chain_type: newWalletChain,
      }
      if (selectedPolicyId) {
        body.policy_ids = [selectedPolicyId]
      }

      const result = await (window.api.fetch as any).privy("POST", "/v1/wallets", body) as any

      if (result?.error) {
        setError(`Failed to create wallet: ${result.error}`)
      } else {
        setShowCreateWallet(false)
        await loadWallets()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create wallet")
    }
    setIsCreatingWallet(false)
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Wallets</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage agent wallets powered by Privy — autonomous crypto wallets with policy guardrails
          </p>
        </div>
        <div className="flex items-center gap-2">
          {privyConfigured && (
            <>
              <Button variant="outline" size="sm" onClick={loadWallets} disabled={isLoading}>
                <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isLoading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <Button size="sm" onClick={() => setShowCreateWallet(!showCreateWallet)}>
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                New Wallet
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Privy not configured */}
      {!privyConfigured && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0">
                <Key className="h-6 w-6 text-amber-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-semibold mb-1">Configure Privy Credentials</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  To create and manage agent wallets, you need to configure your Privy API credentials first.
                </p>
                <div className="space-y-2 text-xs text-muted-foreground mb-4">
                  <p>1. Create a free account at <a href="https://privy.io" className="text-primary hover:underline" onClick={(e) => { e.preventDefault(); window.open("https://privy.io", "_blank") }}>privy.io</a></p>
                  <p>2. Create a new app in the <a href="https://dashboard.privy.io" className="text-primary hover:underline" onClick={(e) => { e.preventDefault(); window.open("https://dashboard.privy.io", "_blank") }}>Privy Dashboard</a></p>
                  <p>3. Copy your App ID and App Secret</p>
                  <p>4. Go to <strong className="text-foreground">Settings → Wallets</strong> in Orquestr Pro and paste them</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => {
                  // Navigate to settings wallets tab
                  if (isElectron) {
                    window.api.navigation?.onNavigate?.("settings")
                  }
                }}>
                  Go to Settings
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create Wallet Form */}
      {showCreateWallet && privyConfigured && (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="text-base">Create Agent Wallet</CardTitle>
            <CardDescription>Create a new wallet with policy guardrails. Ask your agent in the Chat to create wallets with full API control.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-zinc-400 mb-1.5 block">Chain</label>
                <select
                  value={newWalletChain}
                  onChange={(e) => setNewWalletChain(e.target.value)}
                  className="h-9 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  {Object.entries(CHAIN_INFO).map(([key, info]) => (
                    <option key={key} value={key}>{info.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-400 mb-1.5 block">Policy (optional)</label>
                <select
                  value={selectedPolicyId}
                  onChange={(e) => setSelectedPolicyId(e.target.value)}
                  className="h-9 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">No policy (create one first)</option>
                  {policies.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="p-3 rounded-md bg-zinc-900 border border-zinc-800">
              <p className="text-xs text-zinc-400">
                <strong className="text-amber-400">💡 Pro tip:</strong> For full control, ask your agent in the Chat:
              </p>
              <p className="text-xs text-zinc-500 mt-1 font-mono">
                "Create a Solana wallet with a 0.1 SOL spending limit policy"
              </p>
            </div>

            <div className="flex items-center justify-between">
              <Button variant="outline" size="sm" onClick={() => setShowCreatePolicy(!showCreatePolicy)}>
                <Shield className="h-3 w-3 mr-1.5" />
                {showCreatePolicy ? "Hide Policy Form" : "Create Policy First"}
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowCreateWallet(false)}>Cancel</Button>
                <Button size="sm" onClick={handleCreateWallet} disabled={isCreatingWallet}>
                  {isCreatingWallet ? "Creating..." : "Create Wallet"}
                </Button>
              </div>
            </div>

            {showCreatePolicy && (
              <div className="mt-4 p-4 rounded-lg border border-zinc-700 bg-zinc-900/50 space-y-3">
                <h4 className="text-xs font-semibold text-zinc-300">New Policy</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] text-zinc-500 mb-1 block">Name</label>
                    <input
                      type="text"
                      value={newPolicyName}
                      onChange={(e) => setNewPolicyName(e.target.value)}
                      placeholder="Agent limits"
                      className="h-8 w-full rounded-md border border-zinc-700 bg-zinc-800 px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-zinc-500 mb-1 block">Max per TX (native token)</label>
                    <input
                      type="number"
                      value={newPolicyMaxAmount}
                      onChange={(e) => setNewPolicyMaxAmount(e.target.value)}
                      step="0.01"
                      className="h-8 w-full rounded-md border border-zinc-700 bg-zinc-800 px-2 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>
                  <div className="flex items-end">
                    <Button size="sm" className="h-8 text-xs" onClick={handleCreatePolicy} disabled={isCreatingPolicy || !newPolicyName.trim()}>
                      {isCreatingPolicy ? "Creating..." : "Create Policy"}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Wallets List */}
      {privyConfigured && (
        <div className="space-y-3">
          {wallets.length === 0 && !isLoading && (
            <Card>
              <CardContent className="p-8 text-center">
                <Wallet className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <h3 className="text-sm font-medium mb-1">No wallets yet</h3>
                <p className="text-xs text-muted-foreground mb-4">
                  Create your first agent wallet or ask the agent to create one for you
                </p>
                <p className="text-xs text-zinc-600">
                  Try asking in Chat: "Create an Ethereum wallet with spending limits"
                </p>
              </CardContent>
            </Card>
          )}

          {wallets.map((wallet) => {
            const chainInfo = CHAIN_INFO[wallet.chain_type] || { name: wallet.chain_type, color: "#888", explorer: "" }
            return (
              <Card key={wallet.id} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div
                        className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `${chainInfo.color}20` }}
                      >
                        <Coins className="h-5 w-5" style={{ color: chainInfo.color }} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-sm font-medium">{chainInfo.name} Wallet</span>
                          <Badge variant="outline" className="text-[9px] font-mono">{wallet.chain_type}</Badge>
                          {wallet.policy_ids.length > 0 && (
                            <Badge variant="success" className="text-[9px] gap-0.5">
                              <Shield className="h-2.5 w-2.5" />
                              Policy
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <code className="text-[11px] text-muted-foreground font-mono">
                            {wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}
                          </code>
                          <button
                            onClick={() => handleCopyAddress(wallet.address)}
                            className="text-muted-foreground hover:text-foreground transition-colors"
                          >
                            {copiedAddress === wallet.address ? (
                              <Check className="h-3 w-3 text-emerald-400" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </button>
                          {chainInfo.explorer && (
                            <a
                              href={`${chainInfo.explorer}${wallet.address}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-muted-foreground hover:text-primary transition-colors"
                              onClick={(e) => { e.preventDefault(); window.open(`${chainInfo.explorer}${wallet.address}`, "_blank") }}
                            >
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                        <p className="text-[10px] text-zinc-600 mt-0.5">
                          ID: {wallet.id.slice(0, 12)}... • Created: {new Date(wallet.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Supported Chains */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Supported Chains</CardTitle>
          <CardDescription>Privy server wallets support 12+ blockchain networks</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-2">
            {Object.entries(CHAIN_INFO).map(([key, info]) => (
              <div key={key} className="flex items-center gap-2 p-2.5 rounded-lg bg-accent/30 border border-zinc-800/50">
                <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: info.color }} />
                <span className="text-xs font-medium">{info.name}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Security Card */}
      <Card className="border-amber-500/20">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-amber-400" />
            <CardTitle className="text-base">Security Guidelines</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 text-xs text-muted-foreground">
          <p>🔐 <strong className="text-foreground">Always create policies before wallets</strong> — Policies set spending limits and restrict which contracts/chains can be used</p>
          <p>✅ <strong className="text-foreground">Validate every transaction</strong> — The agent checks addresses, amounts, and chains before executing</p>
          <p>🛡️ <strong className="text-foreground">Policy deletion requires confirmation</strong> — You must explicitly confirm before any policy is removed</p>
          <p>🔑 <strong className="text-foreground">Credentials stay local</strong> — Your Privy App Secret never leaves this machine</p>
          <p className="text-[10px] text-zinc-600 mt-2">
            Powered by <a href="https://privy.io" className="text-primary hover:underline" onClick={(e) => { e.preventDefault(); window.open("https://privy.io", "_blank") }}>Privy Server Wallets</a> — enterprise-grade wallet infrastructure
          </p>
        </CardContent>
      </Card>

      {/* How it works */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">How Agent Wallets Work</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-xs text-muted-foreground">
          <div className="flex items-start gap-3">
            <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0 text-[10px] font-bold text-primary">1</div>
            <div>
              <p className="font-medium text-foreground">Create a Policy</p>
              <p>Set spending limits, allowed chains, and contract restrictions</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0 text-[10px] font-bold text-primary">2</div>
            <div>
              <p className="font-medium text-foreground">Create a Wallet</p>
              <p>Attach the policy to a new wallet on any supported chain</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0 text-[10px] font-bold text-primary">3</div>
            <div>
              <p className="font-medium text-foreground">Agent Executes Transactions</p>
              <p>The agent can send transactions within policy limits — no manual approval needed</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0 text-[10px] font-bold text-primary">4</div>
            <div>
              <p className="font-medium text-foreground">Use Cases</p>
              <p>DeFi trading, automated payments, NFT minting, cross-chain bridging, agent-to-agent payments</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
