import { useState, useEffect } from "react"
import { Sidebar, type PageId } from "@/components/sidebar"
import { Titlebar } from "@/components/titlebar"
import { useGatewayConnection } from "@/lib/use-gateway"
import { DashboardPage } from "@/pages/dashboard"
import { ChatPage } from "@/pages/chat"
import { LiveCutterPage } from "@/pages/live-cutter"
import { AgentsPage } from "@/pages/agents"
import { ChannelsPage } from "@/pages/channels"
import { MarketsPage } from "@/pages/markets"
import { SecurityPage } from "@/pages/security"
import { PluginsPage } from "@/pages/plugins"
import { ActivityPage } from "@/pages/activity"
import { SettingsPage } from "@/pages/settings"
import { CronPage } from "@/pages/cron"
import { WalletsPage } from "@/pages/wallets"

const pageTitles: Record<PageId, string> = {
  dashboard: "Dashboard",
  chat: "Chat",
  "live-cutter": "Live Cutter",
  agents: "Agents",
  channels: "Channels",
  markets: "Markets",
  wallets: "Wallets",
  cron: "Cron Jobs",
  security: "Security",
  plugins: "Skills",
  activity: "Activity",
  settings: "Settings",
}

export function App() {
  const [activePage, setActivePage] = useState<PageId>("dashboard")
  const {
    gatewayStatus,
    connectionState,
    isConnected,
    startGateway,
    stopGateway,
    client,
  } = useGatewayConnection()

  const isElectron = typeof window !== "undefined" && !!window.api

  useEffect(() => {
    if (!isElectron) return
    window.api.navigation.onNavigate((path: string) => {
      const page = path.replace("/", "") as PageId
      if (pageTitles[page]) {
        setActivePage(page)
      }
    })
  }, [isElectron])

  const renderPage = () => {
    switch (activePage) {
      case "dashboard":
        return (
          <DashboardPage
            gatewayStatus={gatewayStatus}
            connectionState={connectionState}
            isConnected={isConnected}
            onStartGateway={startGateway}
            onStopGateway={stopGateway}
          />
        )
      case "chat":
        return <ChatPage client={client} isConnected={isConnected} />
      case "live-cutter":
        return <LiveCutterPage client={client} isConnected={isConnected} />
      case "agents":
        return <AgentsPage client={client} isConnected={isConnected} />
      case "channels":
        return <ChannelsPage client={client} isConnected={isConnected} />
      case "markets":
        return <MarketsPage />
      case "wallets":
        return <WalletsPage client={client} isConnected={isConnected} />
      case "cron":
        return <CronPage client={client} isConnected={isConnected} />
      case "security":
        return <SecurityPage client={client} isConnected={isConnected} />
      case "plugins":
        return <PluginsPage client={client} isConnected={isConnected} />
      case "activity":
        return <ActivityPage client={client} isConnected={isConnected} />
      case "settings":
        return <SettingsPage client={client} isConnected={isConnected} />
    }
  }

  return (
    <div className="h-screen flex overflow-hidden bg-background">
      <Sidebar
        activePage={activePage}
        onNavigate={setActivePage}
        gatewayStatus={gatewayStatus}
        connectionState={connectionState}
      />
      <div className="flex-1 flex flex-col min-w-0">
        {activePage !== "chat" && <Titlebar title={pageTitles[activePage]} />}
        <main className="flex-1 overflow-auto">{renderPage()}</main>
      </div>
    </div>
  )
}
