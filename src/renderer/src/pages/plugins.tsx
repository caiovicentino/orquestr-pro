import { useState, useEffect, useCallback } from "react"
import type { GatewayClient } from "@/lib/gateway-client"
import {
  Puzzle,
  Search,
  Download,
  CheckCircle2,
  ExternalLink,
  Star,
  Package,
  ToggleLeft,
  ToggleRight,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"

interface PluginsPageProps {
  client: GatewayClient
  isConnected: boolean
}

interface Plugin {
  id: string
  name: string
  description: string
  version: string
  author: string
  category: "channel" | "tool" | "skill" | "integration"
  installed: boolean
  enabled: boolean
  downloads: number
  rating: number
}

const mockPlugins: Plugin[] = [
  {
    id: "memory-core",
    name: "Memory Core",
    description: "Semantic search over workspace memory files with vector + BM25 hybrid search",
    version: "1.2.0",
    author: "Orquestr",
    category: "tool",
    installed: true,
    enabled: true,
    downloads: 12400,
    rating: 4.8,
  },
  {
    id: "github-integration",
    name: "GitHub",
    description: "Create issues, PRs, review code, and manage repositories directly from the agent",
    version: "2.1.0",
    author: "Orquestr",
    category: "integration",
    installed: true,
    enabled: true,
    downloads: 9800,
    rating: 4.7,
  },
  {
    id: "slack-actions",
    name: "Slack Actions",
    description: "Advanced Slack interactions: reactions, threads, file uploads, and slash commands",
    version: "1.5.2",
    author: "Orquestr",
    category: "channel",
    installed: true,
    enabled: true,
    downloads: 8200,
    rating: 4.6,
  },
  {
    id: "notion-sync",
    name: "Notion Sync",
    description: "Sync knowledge base with Notion pages, databases, and wikis",
    version: "1.0.3",
    author: "Community",
    category: "integration",
    installed: true,
    enabled: false,
    downloads: 5600,
    rating: 4.3,
  },
  {
    id: "coding-agent",
    name: "Coding Agent",
    description: "Full coding capabilities with PTY, exec, file system access, and process management",
    version: "3.0.0",
    author: "Orquestr",
    category: "skill",
    installed: true,
    enabled: true,
    downloads: 15000,
    rating: 4.9,
  },
  {
    id: "web-scraper",
    name: "Web Scraper",
    description: "Advanced web scraping with Firecrawl integration, readability, and structured extraction",
    version: "1.1.0",
    author: "Community",
    category: "tool",
    installed: false,
    enabled: false,
    downloads: 4200,
    rating: 4.2,
  },
  {
    id: "trello-boards",
    name: "Trello Boards",
    description: "Manage Trello boards, cards, lists, and members from your agent",
    version: "1.0.0",
    author: "Community",
    category: "integration",
    installed: false,
    enabled: false,
    downloads: 2100,
    rating: 4.0,
  },
  {
    id: "image-generation",
    name: "Image Generation",
    description: "Generate images using OpenAI DALL-E, Midjourney, or Stable Diffusion APIs",
    version: "2.0.1",
    author: "Orquestr",
    category: "tool",
    installed: false,
    enabled: false,
    downloads: 7800,
    rating: 4.5,
  },
]

const categoryConfig = {
  channel: { label: "Channel", color: "bg-blue-500/15 text-blue-400" },
  tool: { label: "Tool", color: "bg-emerald-500/15 text-emerald-400" },
  skill: { label: "Skill", color: "bg-purple-500/15 text-purple-400" },
  integration: { label: "Integration", color: "bg-amber-500/15 text-amber-400" },
}

export function PluginsPage({ client, isConnected }: PluginsPageProps) {
  const [filter, setFilter] = useState<"all" | "installed" | "available">("all")
  const [plugins, setPlugins] = useState<Plugin[]>(mockPlugins)

  const loadSkills = useCallback(async () => {
    if (!isConnected) return
    try {
      const result = await client.skillsStatus() as {
        skills?: Array<{
          name?: string; description?: string; source?: string
          eligible?: boolean; disabled?: boolean; bundled?: boolean
          emoji?: string; homepage?: string; skillKey?: string
          missing?: { bins?: string[]; env?: string[] }
        }>
      }
      if (!result?.skills?.length) return

      const mapped: Plugin[] = result.skills.map((s) => {
        const isInstalled = !s.disabled && s.eligible
        const source = s.source || "unknown"
        let category: Plugin["category"] = "skill"
        if (source === "bundled") category = "skill"
        else if (source === "managed") category = "integration"
        else if (source === "workspace") category = "tool"

        return {
          id: s.skillKey || s.name || "",
          name: s.name || "",
          description: s.description || "",
          version: "",
          author: source === "bundled" ? "OpenClaw" : source === "managed" ? "Community" : "Workspace",
          category,
          installed: true,
          enabled: isInstalled,
          downloads: 0,
          rating: 0,
        }
      })

      setPlugins(mapped)
    } catch {}
  }, [isConnected, client])

  useEffect(() => {
    loadSkills()
  }, [loadSkills])

  const filtered = plugins.filter((p) => {
    if (filter === "installed") return p.installed
    if (filter === "available") return !p.installed
    return true
  })

  const installedCount = plugins.filter((p) => p.installed).length
  const enabledCount = plugins.filter((p) => p.enabled).length

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Skills</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage skills, tools, and integrations
          </p>
        </div>
        <div className="relative">
          <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search skills..."
            className="h-9 w-[240px] rounded-md border bg-background pl-8 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Installed</p>
            <p className="text-xl font-semibold mt-1">{installedCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Enabled</p>
            <p className="text-xl font-semibold mt-1">{enabledCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Available</p>
            <p className="text-xl font-semibold mt-1">{plugins.length - installedCount}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-2">
        {(["all", "installed", "available"] as const).map((f) => (
          <Button
            key={f}
            variant={filter === f ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setFilter(f)}
            className="capitalize"
          >
            {f}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        {filtered.map((plugin) => (
          <PluginCard key={plugin.id} plugin={plugin} />
        ))}
      </div>
    </div>
  )
}

function PluginCard({ plugin }: { plugin: Plugin }) {
  const cat = categoryConfig[plugin.category]

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center shrink-0">
              <Package className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{plugin.name}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${cat.color}`}>
                  {cat.label}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{plugin.description}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 text-[11px] text-muted-foreground mb-3">
          <span>v{plugin.version}</span>
          <span>·</span>
          <span>{plugin.author}</span>
          <span>·</span>
          <span className="flex items-center gap-0.5">
            <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
            {plugin.rating}
          </span>
          <span>·</span>
          <span>{plugin.downloads.toLocaleString()} installs</span>
        </div>

        <Separator className="mb-3" />

        <div className="flex items-center justify-between">
          {plugin.installed ? (
            <>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-xs text-emerald-400">Installed</span>
              </div>
              <Button variant={plugin.enabled ? "secondary" : "outline"} size="sm" className="h-7 text-xs gap-1.5">
                {plugin.enabled ? (
                  <>
                    <ToggleRight className="h-3.5 w-3.5" />
                    Enabled
                  </>
                ) : (
                  <>
                    <ToggleLeft className="h-3.5 w-3.5" />
                    Disabled
                  </>
                )}
              </Button>
            </>
          ) : (
            <>
              <span className="text-xs text-muted-foreground">Not installed</span>
              <Button size="sm" className="h-7 text-xs gap-1.5">
                <Download className="h-3.5 w-3.5" />
                Install
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
