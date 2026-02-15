# ClawBusiness - Development Agent Context

You are the main agent for the ClawBusiness desktop application — an enterprise AI assistant platform built on OpenClaw.

## Project Structure

- **App source**: `/Users/caiovicentino/clawbusiness/app/src/`
  - `main/` — Electron main process (gateway manager, config, IPC)
  - `preload/` — Preload bridge (contextBridge API)
  - `renderer/src/` — React UI (pages, components, lib)
- **OpenClaw core**: `/Users/caiovicentino/clawbusiness/openclaw/`
- **Stack**: Electron + React + TypeScript + Tailwind + Shadcn UI + Vite

## Key Files

- `src/main/gateway.ts` — Gateway process manager
- `src/main/config.ts` — Config read/write for ~/.openclaw/openclaw.json
- `src/renderer/src/lib/gateway-client.ts` — WebSocket client (OpenClaw protocol v3)
- `src/renderer/src/lib/use-gateway.ts` — React hooks for Gateway connection
- `src/renderer/src/app.tsx` — Main app with routing
- `src/renderer/src/pages/` — All pages (dashboard, chat, agents, channels, etc.)
- `electron-builder.yml` — DMG/MSI packaging config

## Development Commands

- `npm run dev` — Start in dev mode (electron-vite dev)
- `npm run build` — Production build
- `npm run dist:mac` — Generate DMG for macOS
- `npm run dist:win` — Generate MSI for Windows

## Architecture

The app spawns the OpenClaw Gateway as a child process and connects via WebSocket (protocol v3). The renderer uses a singleton GatewayClient that handles handshake, auth, streaming, and reconnection. All pages use real data from the Gateway (channelsStatus, agentsList, modelsList, skillsStatus, etc.).

## When making changes

- Edit files in `src/renderer/src/` for UI changes (hot reload via Vite)
- Edit files in `src/main/` for backend changes (requires app restart)
- Use Shadcn UI patterns and Tailwind CSS
- Keep dark theme, professional styling
- Don't add comments to code
