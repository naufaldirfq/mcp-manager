# MCP Manager

<p align="center">
  <img src="src-tauri/icons/128x128.png" alt="MCP Manager Logo" width="128" height="128">
</p>

<p align="center">
  <strong>A lightweight desktop app to manage MCP configurations across multiple AI tools</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/platform-macOS-blue" alt="Platform">
  <img src="https://img.shields.io/badge/size-~9MB-green" alt="Size">
  <img src="https://img.shields.io/badge/built%20with-Tauri-orange" alt="Built with Tauri">
</p>

---

## Features

| Feature | Description |
|---------|-------------|
| 🔗 **Unified Dashboard** | View all MCP servers across 5 AI tools in one place |
| 🔄 **Sync** | Copy configurations between tools with one click |
| 💾 **Backup & Restore** | Create snapshots of all your configurations |
| 📦 **Import/Export** | Share configurations as JSON files |
| ⚡ **Templates** | 8 pre-built MCP server templates for quick setup |
| 🎨 **Modern UI** | Dark mode with glassmorphism design |

## Supported AI Tools

- **Claude Code** (`~/.claude.json`)
- **Gemini CLI** (`~/.gemini/settings.json`)
- **Codex CLI** (`~/.codex/config.toml`)
- **Copilot CLI** (`~/.copilot/mcp-config.json`)
- **VS Code** (`~/Library/Application Support/Code/User/mcp.json`)

## Installation

### Option 1: Download Release
Download the latest `.dmg` from [Releases](https://github.com/naufaldirfq/mcp-manager/releases) and drag to Applications.

### Option 2: Build from Source

**Prerequisites:**
- [Node.js](https://nodejs.org/) (v18+)
- [Rust](https://rustup.rs/)

```bash
# Clone the repository
git clone https://github.com/naufaldirfq/mcp-manager.git
cd mcp-manager

# Install dependencies
npm install

# Build the app
npm run build
```

The built app will be at:
- **macOS App**: `src-tauri/target/release/bundle/macos/MCP Manager.app`
- **DMG Installer**: `src-tauri/target/release/bundle/dmg/MCP Manager_*.dmg`

## Development

```bash
# Start development mode (hot reload)
npm run dev
```

## Project Structure

```
mcp-manager/
├── src/                      # Frontend (HTML/CSS/JS)
│   ├── index.html            # Main app shell
│   ├── main.js               # App logic
│   ├── styles/main.css       # Styling
│   └── services/api.js       # Tauri IPC client
├── src-tauri/                # Rust backend
│   ├── src/lib.rs            # Config parsers & commands
│   ├── tauri.conf.json       # App configuration
│   └── icons/                # App icons
└── templates/                # MCP server templates
    └── defaults.json
```

## Built-in Templates

| Template | Description |
|----------|-------------|
| Filesystem | Access local files and directories |
| GitHub | Interact with GitHub repositories |
| SQLite | Query SQLite databases |
| Fetch | Fetch and process web content |
| Memory | Persistent memory for conversations |
| Puppeteer | Browser automation |
| Slack | Interact with Slack workspaces |
| Brave Search | Web search via Brave API |

## Tech Stack

- **Frontend**: Vanilla JS + Vite
- **Backend**: Rust + Tauri v2
- **Styling**: Custom CSS with dark mode

## License

MIT
