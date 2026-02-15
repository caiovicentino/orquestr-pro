import {
  LayoutDashboard,
  MessageSquare,
  MessagesSquare,
  Bot,
  Settings,
  Shield,
  Activity,
  TrendingUp,
  Puzzle,
  Scissors,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"

export type PageId =
  | "dashboard"
  | "chat"
  | "live-cutter"
  | "agents"
  | "channels"
  | "markets"
  | "security"
  | "plugins"
  | "activity"
  | "settings"

interface NavItem {
  id: PageId
  label: string
  icon: LucideIcon
  badge?: string
}

const mainNav: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "chat", label: "Chat", icon: MessagesSquare },
  { id: "live-cutter", label: "Live Cutter", icon: Scissors },
  { id: "agents", label: "Agents", icon: Bot },
  { id: "channels", label: "Channels", icon: MessageSquare },
  { id: "markets", label: "Markets", icon: TrendingUp },
]

const systemNav: NavItem[] = [
  { id: "security", label: "Security", icon: Shield },
  { id: "plugins", label: "Skills", icon: Puzzle },
  { id: "activity", label: "Activity", icon: Activity },
  { id: "settings", label: "Settings", icon: Settings },
]

interface SidebarProps {
  activePage: PageId
  onNavigate: (page: PageId) => void
  gatewayStatus: "stopped" | "starting" | "running" | "error"
  connectionState?: "disconnected" | "connecting" | "handshaking" | "connected" | "error"
}

export function Sidebar({ activePage, onNavigate, gatewayStatus, connectionState }: SidebarProps) {
  const statusColor = {
    stopped: "bg-zinc-500",
    starting: "bg-amber-500 animate-pulse",
    running: "bg-emerald-500",
    error: "bg-red-500",
  }

  const statusLabel = {
    stopped: "Offline",
    starting: "Starting...",
    running: "Online",
    error: "Error",
  }

  const wsLabel = connectionState === "connected" ? "WS Connected" : connectionState === "connecting" || connectionState === "handshaking" ? "WS Connecting..." : ""

  return (
    <div className="w-[220px] h-full flex flex-col border-r border-sidebar-border bg-sidebar shrink-0">
      <div className="h-12 flex items-center pl-[78px] pr-4 [-webkit-app-region:drag] shrink-0">
        <div className="flex items-center gap-2 [-webkit-app-region:no-drag]">
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 32 32" className="shrink-0">
            <rect width="32" height="32" rx="8" fill="#7c3aed"/>
            <path d="M16 7C11 7 7 11 7 16s4 9 9 9 9-4 9-9-4-9-9-9zm0 14.5c-3 0-5.5-2.5-5.5-5.5S13 10.5 16 10.5s5.5 2.5 5.5 5.5-2.5 5.5-5.5 5.5z" fill="white"/>
            <circle cx="16" cy="16" r="2.5" fill="white"/>
            <path d="M16 13.5v-3M16 21.5v-3M19.5 16h-3M12.5 16h3" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <span className="text-sm font-semibold text-sidebar-accent-foreground">Orquestr Pro</span>
        </div>
      </div>

      <ScrollArea className="flex-1 px-3">
        <div className="py-2">
          <p className="px-2 mb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Workspace
          </p>
          <nav className="flex flex-col gap-0.5">
            {mainNav.map((item) => (
              <SidebarItem
                key={item.id}
                item={item}
                isActive={activePage === item.id}
                onClick={() => onNavigate(item.id)}
              />
            ))}
          </nav>
        </div>

        <Separator className="my-2" />

        <div className="py-2">
          <p className="px-2 mb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            System
          </p>
          <nav className="flex flex-col gap-0.5">
            {systemNav.map((item) => (
              <SidebarItem
                key={item.id}
                item={item}
                isActive={activePage === item.id}
                onClick={() => onNavigate(item.id)}
              />
            ))}
          </nav>
        </div>
      </ScrollArea>

      <div className="p-3 border-t border-sidebar-border space-y-1">
        <div className="flex items-center gap-2 px-2 py-0.5">
          <div className={cn("h-2 w-2 rounded-full", statusColor[gatewayStatus])} />
          <span className="text-xs text-muted-foreground">Gateway: {statusLabel[gatewayStatus]}</span>
        </div>
        {wsLabel && (
          <div className="flex items-center gap-2 px-2 py-0.5">
            <div className={cn("h-2 w-2 rounded-full", connectionState === "connected" ? "bg-emerald-500" : "bg-amber-500 animate-pulse")} />
            <span className="text-xs text-muted-foreground">{wsLabel}</span>
          </div>
        )}
        <div className="px-2 pt-1">
          <a
            href="https://orquestr.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
            onClick={(e) => { e.preventDefault(); window.open("https://orquestr.ai", "_blank") }}
          >
            Powered by Orquestr.ai
          </a>
        </div>
      </div>
    </div>
  )
}

function SidebarItem({
  item,
  isActive,
  onClick,
}: {
  item: NavItem
  isActive: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors w-full text-left",
        isActive
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
      )}
    >
      <item.icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{item.label}</span>
      {item.badge && (
        <Badge variant="secondary" className="ml-auto text-[10px] px-1.5 py-0">
          {item.badge}
        </Badge>
      )}
    </button>
  )
}
