<p align="center">
  <img src="https://orquestr.ai/icon.svg" width="80" height="80" alt="Orquestr Pro" />
</p>

<h1 align="center">Orquestr Pro</h1>

<p align="center">
  <strong>The first AI desktop app with a built-in crypto wallet.</strong><br>
  Trade DeFi, bet on prediction markets, and chat with 40+ AI models — all from one app.<br>
  100% free. 100% open source. 100% private.
</p>

<p align="center">
  <a href="https://github.com/caiovicentino/orquestr-pro/releases/latest"><img src="https://img.shields.io/github/v/release/caiovicentino/orquestr-pro?style=flat-square&color=7c3aed" alt="Release" /></a>
  <a href="https://github.com/caiovicentino/orquestr-pro/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="License" /></a>
  <a href="https://orquestr.ai"><img src="https://img.shields.io/badge/web-orquestr.ai-7c3aed?style=flat-square" alt="Website" /></a>
  <img src="https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey?style=flat-square" alt="Platforms" />
</p>

<p align="center">
  <a href="https://orquestr.ai/download">📥 Download</a> ·
  <a href="#quick-start">🚀 Quick Start</a> ·
  <a href="#features">✨ Features</a> ·
  <a href="#architecture">🏗 Architecture</a> ·
  <a href="#providers">🤖 Providers</a> ·
  <a href="#building-from-source">🔧 Build</a>
</p>

---

## What is Orquestr Pro?

Orquestr Pro is a native desktop application that wraps the [OpenClaw](https://github.com/openclaw/openclaw) AI agent framework into a polished Electron experience. It gives you a local-first, privacy-respecting AI assistant with capabilities no web-based chatbot can match:

- **Crypto wallet** — Create wallets via Privy, trade on Hyperliquid, bet on Polymarket
- **40+ AI models** — Claude, GPT, Gemini, Grok, Llama, Mistral, DeepSeek, and more
- **Persistent memory** — Your agent remembers context across sessions
- **File analysis** — Upload images, PDFs, CSVs, code — the agent understands them
- **Total privacy** — Everything runs locally. Your keys never leave your machine.
- **Zero cost** — No subscription. Bring your own API keys.

## Download

| Platform | Download | Size |
|----------|----------|------|
| **macOS (Apple Silicon)** — M1/M2/M3/M4 | [Orquestr Pro-1.0.0-arm64.dmg](https://github.com/caiovicentino/orquestr-pro/releases/download/v1.0.0/Orquestr.Pro-1.0.0-arm64.dmg) | 223 MB |
| **macOS (Intel)** | [Orquestr Pro-1.0.0-x64.dmg](https://github.com/caiovicentino/orquestr-pro/releases/download/v1.0.0/Orquestr.Pro-1.0.0-x64.dmg) | 246 MB |
| **Windows x64** (Portable) | [Orquestr Pro-1.0.0-win-x64-portable.zip](https://github.com/caiovicentino/orquestr-pro/releases/download/v1.0.0/Orquestr.Pro-1.0.0-win-x64-portable.zip) | 248 MB |

> **macOS:** Signed with Apple Developer ID + Notarized. Zero security warnings.  
> **Windows:** Portable — just extract and run, no installation needed.

---

## Quick Start

1. **Download** the DMG (Mac) or ZIP (Windows) from the table above
2. **Install** — drag to Applications (Mac) or extract anywhere (Windows)
3. **Launch** Orquestr Pro
4. **Add an API key** — go to Settings → select a provider → paste your key
5. **Chat** — start a conversation with your AI agent

That's it. The app automatically starts a local OpenClaw gateway, manages sessions, and handles all the plumbing.

---

## Features

### 🤖 Multi-Model Chat
Switch between 40+ AI models from 21 providers in the same conversation. Each provider card shows available models with one-click activation.

### 💼 Crypto Wallet (Privy)
Create self-custody wallets directly in the app. Trade spot and perpetuals on Hyperliquid. Bet on Polymarket events. All from natural language.

### 🧠 Persistent Memory
Conversations are stored locally. The agent maintains context across sessions through workspace files (AGENTS.md, SOUL.md, MEMORY.md) — shared across all sessions automatically.

### 📎 File Uploads
Drag and drop images, PDFs, spreadsheets, and code files. The agent analyzes content with full context.

### 🔐 Privacy First
- All data stored locally in `~/Library/Application Support/orquestr-pro/`
- API keys encrypted in the local credential store
- No telemetry, no analytics, no cloud dependencies
- Hardened runtime with minimal entitlements

### 📡 Session Management
Create multiple chat sessions, switch between them, and delete old ones. Each session maintains independent conversation history while sharing workspace context.

### ⚡ Auto-Updates
Built-in update mechanism via `electron-updater`. Seamless background updates with rollback support.

### 🎨 Native Experience
Custom titlebar, dark theme, responsive sidebar, keyboard shortcuts. Built with React 19, Tailwind CSS 4, and Radix UI primitives.

---

## Providers

Orquestr Pro supports **21 AI providers** out of the box:

### API Key Providers
| Provider | Models | Env Variable |
|----------|--------|-------------|
| **Anthropic** | Claude Opus, Sonnet, Haiku | `ANTHROPIC_API_KEY` |
| **OpenAI** | GPT-4o, o3, o4-mini | `OPENAI_API_KEY` |
| **Google AI** | Gemini Pro, Ultra, Flash | `GEMINI_API_KEY` |
| **OpenRouter** | 200+ models from all providers | `OPENROUTER_API_KEY` |
| **xAI** | Grok with X/Twitter integration | `XAI_API_KEY` |
| **Groq** | Ultra-fast Llama, Mixtral | `GROQ_API_KEY` |
| **Mistral AI** | Mistral, Mixtral, Codestral | `MISTRAL_API_KEY` |
| **DeepSeek** | DeepSeek reasoning & coding | `DEEPSEEK_API_KEY` |
| **Together AI** | Open-source models (Llama, Qwen) | `TOGETHER_API_KEY` |
| **Cerebras** | Ultra-fast custom hardware inference | `CEREBRAS_API_KEY` |
| **Perplexity** | Search-augmented AI | `PERPLEXITY_API_KEY` |
| **Venice AI** | Privacy-focused uncensored models | `VENICE_API_KEY` |

### OAuth Providers
| Provider | Description | Auth Command |
|----------|-------------|-------------|
| **Anthropic (OAuth)** | Claude Max/Pro unlimited | `openclaw auth login anthropic` |
| **Google Antigravity** | Free Gemini via Google account | `openclaw auth login google-antigravity` |
| **Google Gemini CLI** | Gemini CLI auth | `openclaw auth login google-gemini-cli` |
| **GitHub Copilot** | Use Copilot subscription | `openclaw auth login copilot` |
| **MiniMax** | MiniMax portal models | `openclaw auth login minimax-portal` |
| **Qwen** | Alibaba Qwen models | `openclaw auth login qwen-portal` |
| **Chutes** | Chutes AI models | `openclaw auth login chutes` |

### Local
| Provider | Description |
|----------|-------------|
| **Ollama** | Run models locally (Llama, Mistral, Phi, etc.) |

---

## Architecture

```
orquestr-pro/
├── src/
│   ├── main/                    # Electron main process
│   │   ├── index.ts             # IPC handlers, providers, model mapping (665 lines)
│   │   ├── gateway.ts           # OpenClaw gateway lifecycle management (362 lines)
│   │   └── config.ts            # State dir, config generation, workspace bootstrap (827 lines)
│   ├── preload/
│   │   └── index.ts             # Context bridge (secure IPC exposure)
│   └── renderer/src/            # React frontend
│       ├── app.tsx              # Router + layout
│       ├── pages/
│       │   ├── chat.tsx         # Main chat interface with streaming (798 lines)
│       │   ├── settings.tsx     # Provider management + model selector (1015 lines)
│       │   ├── live-cutter.tsx  # Video clip creation tool (758 lines)
│       │   ├── agents.tsx       # Agent management (630 lines)
│       │   ├── markets.tsx      # Prediction markets (482 lines)
│       │   ├── channels.tsx     # Messaging channels (413 lines)
│       │   ├── plugins.tsx      # Plugin management (335 lines)
│       │   ├── security.tsx     # Security settings (303 lines)
│       │   ├── team.tsx         # Team management (271 lines)
│       │   ├── dashboard.tsx    # Overview dashboard (256 lines)
│       │   └── activity.tsx     # Activity log (249 lines)
│       ├── components/
│       │   ├── sidebar.tsx      # Navigation sidebar
│       │   ├── titlebar.tsx     # Custom window titlebar
│       │   └── ui/              # Radix + shadcn/ui components
│       └── lib/
│           ├── gateway-client.ts # WebSocket client for OpenClaw (301 lines)
│           ├── use-gateway.ts    # React hook for gateway connection (149 lines)
│           └── utils.ts          # Tailwind merge utility
├── resources/
│   ├── openclaw/                # Bundled OpenClaw runtime
│   │   ├── openclaw.mjs         # Core agent framework
│   │   ├── extensions/          # Default plugins (memory-core)
│   │   ├── docs/                # Full OpenClaw documentation
│   │   └── node_modules/        # Runtime dependencies
│   ├── entitlements.mac.plist   # macOS sandbox entitlements
│   └── icon.icns                # App icon
├── electron-builder.yml         # Build + signing + notarization config
├── electron.vite.config.ts      # Vite config for main + preload + renderer
└── package.json
```

### How It Works

1. **App Launch** → Electron main process starts
2. **Config Bootstrap** → `ensureGatewayConfig()` generates OpenClaw config from stored credentials
3. **Gateway Spawn** → Spawns an OpenClaw gateway process on an available port (auto-detects from 18789+)
4. **WebSocket Connect** → Renderer connects via `GatewayClient` with challenge-response auth
5. **Chat Streaming** → Messages sent via `chat.send`, responses streamed via `chat` delta events
6. **Session Isolation** → Each session has independent history; workspace files provide shared context

### State Directory

All app data lives in an isolated directory, separate from any system OpenClaw installation:

```
~/Library/Application Support/orquestr-pro/openclaw-state/
├── config.yaml          # Auto-generated gateway config
├── credentials.json     # Encrypted API keys
├── auth-profiles.json   # OAuth tokens
├── auth.json            # Auth fallback
├── workspace/           # Shared context files (AGENTS.md, SOUL.md, MEMORY.md)
└── data/                # Conversation history (SQLite)
```

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Isolated state dir** | Doesn't conflict with existing OpenClaw installations |
| **Auto-port detection** | Scans from 18789 upward to avoid port conflicts |
| **Bundled OpenClaw runtime** | Works on any machine, no prior installation needed |
| **Dual auth files** | Writes both `auth-profiles.json` and `auth.json` for compatibility |
| **`deliver: false` on chat.send** | Prevents gateway from trying to deliver to messaging channels |
| **"chat" events (not "agent")** | Official API — accumulated text replacement, not append |
| **No App Store** | Sandboxing breaks process spawning, WebSocket ports, filesystem access |

---

## Building from Source

### Prerequisites

- **Node.js** ≥ 22
- **npm** ≥ 10
- **macOS:** Xcode Command Line Tools (for native modules)
- **Windows:** Visual Studio Build Tools

### Development

```bash
# Clone
git clone https://github.com/caiovicentino/orquestr-pro.git
cd orquestr-pro

# Install dependencies
npm install

# Start in development mode (hot reload)
npm run dev
```

### Production Build

```bash
# macOS (both architectures)
npm run build:mac

# Windows
npm run build:win

# Linux
npm run build:linux
```

Build output goes to `release/`.

### Code Signing (macOS)

The app is configured for Apple Developer ID signing and notarization:

```yaml
# electron-builder.yml
mac:
  identity: "Your Name (TEAMID)"
  hardenedRuntime: true
  notarize:
    teamId: "TEAMID"
```

Requirements:
- Apple Developer Program membership ($99/year)
- Developer ID Application certificate (created via Xcode → Settings → Accounts)
- App-specific password stored in Keychain

```bash
# Store notarization credentials
xcrun notarytool store-credentials "OrquestrPro" \
  --apple-id "your@email.com" \
  --team-id "TEAMID" \
  --password "app-specific-password"

# Manual notarization (if auto-notarize fails)
xcrun notarytool submit release/Orquestr\ Pro-1.0.0-arm64.dmg \
  --keychain-profile "OrquestrPro" --wait

# Staple the ticket
xcrun stapler staple release/Orquestr\ Pro-1.0.0-arm64.dmg
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Electron 34 |
| **Frontend** | React 19, TypeScript 5.7 |
| **Styling** | Tailwind CSS 4, Radix UI, shadcn/ui |
| **Build** | electron-vite 3, Vite 6 |
| **Backend** | OpenClaw (bundled Node.js agent framework) |
| **Packaging** | electron-builder 25 |
| **Auto-Update** | electron-updater 6 |
| **Communication** | WebSocket (challenge-response auth) |

---

## Comparison

| Feature | Orquestr Pro | ChatGPT Desktop | Claude Desktop |
|---------|:---:|:---:|:---:|
| Crypto Wallet | ✅ | ❌ | ❌ |
| DeFi Trading | ✅ | ❌ | ❌ |
| Prediction Markets | ✅ | ❌ | ❌ |
| 40+ AI Models | ✅ | ❌ | ❌ |
| Full Privacy (Local) | ✅ | ❌ | ❌ |
| Free / Open Source | ✅ | ❌ | ❌ |
| Persistent Memory | ✅ | ✅ | ✅ |
| File Upload | ✅ | ✅ | ✅ |
| Native Desktop | ✅ | ✅ | ❌ |
| Auto-Update | ✅ | ✅ | ❌ |
| Multi-Session | ✅ | ❌ | ❌ |

---

## Roadmap

- [ ] **Linux builds** — AppImage for x64 + arm64
- [ ] **Auto-update server** — OTA updates from releases.orquestr.ai
- [ ] **Plugin marketplace** — Install OpenClaw skills from the app
- [ ] **Voice mode** — Talk to your agent with TTS/STT
- [ ] **On-chain dashboard** — Portfolio tracking, whale alerts, DeFi yields
- [ ] **MCP integration** — Connect external tool servers
- [ ] **Team workspaces** — Shared memory across multiple agents
- [ ] **Mobile companion** — React Native app paired to desktop agent

---

## Security

- **Hardened Runtime** — Enabled on macOS with minimal entitlements
- **Code Signed** — Apple Developer ID certificate
- **Notarized** — Verified by Apple's notary service
- **No Network Telemetry** — Zero tracking, zero analytics
- **Local Credential Storage** — API keys stored in app's local data directory
- **Process Isolation** — Gateway runs as child process with scoped permissions

### Entitlements (macOS)

```xml
com.apple.security.cs.allow-jit
com.apple.security.cs.allow-unsigned-executable-memory
com.apple.security.cs.allow-dyld-environment-variables
com.apple.security.cs.disable-library-validation
com.apple.security.network.client
com.apple.security.network.server
com.apple.security.files.user-selected.read-write
```

---

## Contributing

1. Fork the repo
2. Create a feature branch (`git checkout -b feat/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feat/amazing-feature`)
5. Open a Pull Request

---

## License

MIT © [Caio Vicentino](https://github.com/caiovicentino)

---

<p align="center">
  Built with ❤️ by <a href="https://x.com/0xCVYH">@0xCVYH</a> · Powered by <a href="https://github.com/openclaw/openclaw">OpenClaw</a>
</p>
