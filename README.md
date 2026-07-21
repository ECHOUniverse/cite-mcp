<p align="center">
  <h1 align="center">cite-mcp 📄</h1>
  <p align="center"><b>Academic Paper Research MCP Server</b></p>
  <p align="center"><a href="README.zh-CN.md">🇨🇳 中文</a></p>
</p>

<p align="center">
  <a href="#-what-is-mcp">What is MCP?</a> •
  <a href="#-features">Features</a> •
  <a href="#-quick-start">Quick Start</a> •
  <a href="#-configuration">Configuration</a> •
  <a href="#-mcp-client-setup">Client Setup</a> •
  <a href="#-tool-reference">Tool Reference</a> •
  <a href="#-faq">FAQ</a>
</p>

---

## 🤔 What is MCP?

**MCP (Model Context Protocol)** is an open protocol developed by Anthropic that connects AI assistants (like Claude) with external tools and data sources.

Think of it as a **USB-C port for AI** — a standard interface that lets any MCP-compatible AI client plug into your tools:

```
┌──────────────────┐       ┌───────────────────────┐
│  AI Assistant    │ ◄─MCP─►  This MCP Server      │
│  (Claude, etc.)  │       │  (cite-mcp)          │
└──────────────────┘       └───────────────────────┘
                                     │
                    ┌────────────────┼────────────────┐
                    ▼                ▼                ▼
             Semantic Scholar   OpenAlex          Crossref
             (200M+ papers)    (250M+ works)     (150M+ DOIs)
```

This server provides **academic paper research capabilities** — search across multiple databases, get detailed paper info, discover related papers, and format citations — all through natural language conversation.

---

## ✨ Features

| Capability | Sources | Description |
|-----------|---------|-------------|
| 🔍 **Multi-Source Search** | Semantic Scholar + OpenAlex + Crossref | Aggregate search with automatic deduplication |
| 📖 **Paper Detail** | 3 sources merged | Title, authors, abstract, references, citation count — optional full citing/cited paper lists |
| 🎯 **Recommendations** | Semantic Scholar | Related paper discovery |
| 📊 **Paper Analysis** | Semantic Scholar + OpenAlex + Crossref | Cross-paper comparison table + per-paper summaries + field-trend statistics |
| 📝 **Citation Formatting** | — | APA 7th / MLA 9th / GB/T 7714-2015 / BibTeX / Elsevier report — optional Crossref/S2-formatted source for single papers |
| ✍️ **Cite Text** | Semantic Scholar + OpenAlex + Crossref | Insert citations into text, three-section report (body → references → citation notes) |
| 👤 **Author Search** | Semantic Scholar + OpenAlex | Author lookup by name — affiliations, paper/citation counts, h-index |
| 🏷️ **Topic Classify** | OpenAlex | Map keywords to the topic hierarchy (domain / field / subfield) |
| 💰 **Funder Works** | Crossref | Find a funder and its funded research outputs |

---

## 🚀 Quick Start

### Option A: npx (Recommended — no install required)

```bash
npx cite-mcp
```

That's it. On first run, npm will download and cache the package automatically.

To configure your MCP client, point it to:

```json
{
  "mcpServers": {
    "cite-mcp": {
      "command": "npx",
      "args": ["cite-mcp"],
      "env": {
        "S2_API_KEY": "your-key",
        "OPENALEX_MAILTO": "your@email.com",
        "OPENALEX_API_KEY": "your-openalex-key",
        "CROSSREF_MAILTO": "your@email.com"
      }
    }
  }
}
```

> 💡 `env` is optional — the server works without any API keys.

### Option B: Global Install

```bash
npm install -g cite-mcp
cite-mcp
```

Then configure your MCP client:

```json
{
  "mcpServers": {
    "cite-mcp": {
      "command": "cite-mcp",
      "args": [],
      "env": {
        "S2_API_KEY": "your-key",
        "OPENALEX_MAILTO": "your@email.com",
        "CROSSREF_MAILTO": "your@email.com"
      }
    }
  }
}
```

### Option C: Build from Source

<details>
<summary>Click to expand — clone and build locally</summary>

### Prerequisites

- **Node.js** ≥ 18 (recommended: 22+)
  - Check: `node --version`
  - Download: [nodejs.org](https://nodejs.org/)
- **npm** (comes with Node.js)
  - Check: `npm --version`

### Step 1: Clone & Install

```bash
# Clone the repository
git clone https://github.com/ECHOUniverse/cite-mcp.git
cd cite-mcp

# Install dependencies in the MCP server directory
cd mcp-server
npm install

# Build TypeScript source
npm run build
```

> ✅ **Verify**: `ls dist/index.js` should exist after build.

### Step 2: Configure Environment (Optional)

Copy the example environment file to set up optional API keys:

```bash
cp .env.example .env
```

Edit `.env` with your API keys:

| Variable | Required | Purpose |
|----------|----------|---------|
| `S2_API_KEY` | No | Increases Semantic Scholar rate limit (see [API Keys](#-api-keys)) |
| `OPENALEX_MAILTO` | No | Enables OpenAlex polite pool (higher rate limit) |
| `OPENALEX_API_KEY` | No | OpenAlex API key for higher rate limit (free: openalex.org/account) |
| `CROSSREF_MAILTO` | No | Enables Crossref polite pool (higher rate limit) |

**Without any keys**, the server still works with default rate limits (sufficient for casual use).

### Step 3: Register with an MCP Client

An example configuration file (`.mcp.json.example`) is provided in the project root. The steps for each client are below:

</details>

### Option D: HTTP Transport (Streamable HTTP)

For clients that connect over HTTP instead of stdio, the package also ships a stateless HTTP server:

```bash
# after global install (or npm run start:http from a source build)
cite-mcp-http
```

- Endpoint: `POST http://localhost:3000/mcp`
- Port: `PORT` environment variable (default `3000`)
- Stateless and sessionless — every request is independent

Client configuration:

```json
{
  "mcpServers": {
    "cite-mcp-http": {
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

### MCP Client Setup

<details>
<summary><b>Claude Code (CLI)</b></summary>

Use npx (recommended):

```json
{
  "mcpServers": {
    "cite-mcp": {
      "command": "npx",
      "args": ["cite-mcp"],
      "env": {
        "S2_API_KEY": "your-key",
        "OPENALEX_MAILTO": "your@email.com",
        "CROSSREF_MAILTO": "your@email.com"
      }
    }
  }
}
```

Or with global install:
```json
{
  "mcpServers": {
    "cite-mcp": {
      "command": "cite-mcp",
      "args": [],
      "env": {
        "S2_API_KEY": "your-key",
        "OPENALEX_MAILTO": "your@email.com",
        "CROSSREF_MAILTO": "your@email.com"
      }
    }
  }
}
```

Or with local build:
```bash
cp .mcp.json.example .mcp.json
# Edit .mcp.json — replace /absolute/path/to/ with your actual path
```
</details>

<details>
<summary><b>Claude Desktop App</b></summary>

Edit `claude_desktop_config.json` (open via Claude Desktop → Settings → Developer):

```json
{
  "mcpServers": {
    "cite-mcp": {
      "command": "npx",
      "args": ["cite-mcp"],
      "env": {
        "S2_API_KEY": "your-key",
        "OPENALEX_MAILTO": "your@email.com",
        "CROSSREF_MAILTO": "your@email.com"
      }
    }
  }
}
```
</details>

<details>
<summary><b>Cursor / Windsurf / Other MCP Clients</b></summary>

| Field | Value |
|-------|-------|
| Command | `npx` |
| Arguments | `["cite-mcp"]` |
| Environment Variables (env) | `S2_API_KEY`, `OPENALEX_MAILTO`, `CROSSREF_MAILTO` (all optional) |
</details>

<details>
<summary><b>VS Code (GitHub Copilot with MCP)</b></summary>

Requires VS Code Insiders. Configure in VS Code settings (`settings.json`):

```json
{
  "github.copilot.advanced": {
    "mcpServers": {
      "cite-mcp": {
        "command": "npx",
        "args": ["cite-mcp"],
        "env": {
          "S2_API_KEY": "your-key",
          "OPENALEX_MAILTO": "your@email.com",
          "CROSSREF_MAILTO": "your@email.com"
        }
      }
    }
  }
}
```
</details>

### Step 4: Try It Out!

Once connected, ask your AI assistant:

> *"Search for papers about transformer attention mechanisms"*
> *"Get details of paper with DOI 10.1000/xyz123"*
> *"Recommend papers related to this paper"*
> *"Format a citation in APA style"*

---

## 🔧 Configuration

API keys are **entirely optional**. The server works without them, just with lower rate limits.

### Configuration Methods (priority high to low)

**Method 1: MCP client `env` field (recommended)**

```json
{
  "mcpServers": {
    "cite-mcp": {
      "command": "npx",
      "args": ["cite-mcp"],
      "env": {
        "S2_API_KEY": "your-key",
        "OPENALEX_MAILTO": "your@email.com",
        "OPENALEX_API_KEY": "your-openalex-key",
        "CROSSREF_MAILTO": "your@email.com"
      }
    }
  }
}
```

**Method 2: Global `~/.cite-mcp.env` (one config for all projects)**

```bash
cat > ~/.cite-mcp.env << 'EOF'
S2_API_KEY=your-key
OPENALEX_MAILTO=your@email.com
CROSSREF_MAILTO=your@email.com
EOF
```

**Method 3: Project `.env` (current project only)**

```bash
cp .env.example .env
# Edit .env with your keys
```

### Priority

Higher-priority sources override lower-priority ones for the same variable. The **first source to provide a value** wins:

1. MCP client `env` field (highest)
2. `~/.cite-mcp.env` (global)
3. `<project-dir>/.env` (project root)
4. `cwd/.env` (working directory)

### Environment Variables

| Variable | Service | Rate Limit | How to Get |
|----------|---------|-----------|-------------|
| `S2_API_KEY` | Semantic Scholar | 100 req/s (1 req/s without) | [Request here](https://www.semanticscholar.org/product/api) |
| `OPENALEX_MAILTO` | OpenAlex | Polite pool: ~10x faster | Any email |
| `OPENALEX_API_KEY` | OpenAlex | Higher rate limit (required from 2025) | [Get free key](https://openalex.org/account) |
| `CROSSREF_MAILTO` | Crossref | Polite pool: ~10x faster | Any email |

`PORT` sets the port for the HTTP transport (`cite-mcp-http`, default `3000`) and has no effect on the stdio server.

### How the `.env` File Works

The server automatically searches for `.env` files in order (each found file is loaded, only filling variables not yet set):

1. `~/.cite-mcp.env` (global user config)
2. `mcp-server/` directory (inside the project)
3. Current working directory

Place your `.env` at any of these locations. The file is already in `.gitignore`, so your keys won't be committed.

---

## 🛠️ Tool Reference

All tools declare an `outputSchema` and return `structuredContent` alongside the Markdown text, so MCP clients can also parse results programmatically.

### Search Tools

| Tool | Best For | Sources | Limit |
|------|----------|---------|-------|
| `paper_search` | **Recommended for most users** — unified search with auto dedup; `authorId` filters papers by an OpenAlex author ID (e.g. from `author_search`) | all / s2 / openalex / crossref | default 10 (S2 max 100, OA/CR max 50) |
| `author_search` | Find authors by name — affiliations, paper/citation counts, h-index | s2 / openalex / all | default 10, max 100 |
| `paper_funder` | Find a funder and its funded works (`funderId` or `funderName`, exactly one required) | Crossref | default 20, max 100 |

**Semantic Scholar Advanced Query Syntax:**

| Syntax | Example | Effect |
|--------|---------|--------|
| `AND` | `transformer AND attention` | Both terms required |
| `OR` | `climate OR warming` | Either term |
| `NOT` | `GPT NOT chatgpt` | Exclude term |
| `"..."` | `"attention mechanism"` | Exact phrase |
| `neuro*` | `neuro*` | Prefix match (neural, neuroscience...) |
| `title:` | `title:transformer` | Search in title only |

### Analysis Tools

| Tool | Description |
|------|-------------|
| `paper_analysis` | Search specified number of papers, return cross-paper overview table + per-paper summaries and data tables, ending with field-trend statistics (year trend, work-type distribution, research hotspots). Great for quick literature review. |
| `topic_classify` | Classify a keyword into the OpenAlex topic hierarchy — `level` 0 = domain (default), 1 = field, 2 = subfield. Returns name, works count, and OpenAlex URL. |

### Detail Tools

| Tool | Input | Output |
|------|-------|--------|
| `paper_detail` | DOI / S2 Paper ID / batch IDs (up to 500) | Merged detail from 3 sources + references. `includeCitations` / `includeReferences` fetch full citing/cited paper lists from Semantic Scholar (`relatedLimit`, default 10, max 100) |

### Recommendation & Citation Tools

| Tool | Description |
|------|-------------|
| `paper_recommendations` | Find related papers via S2 recommendations |
| `citation` | Format: APA / MLA / GB/T 7714-2015 / BibTeX / Elsevier three-section report. Single-paper mode accepts `source`: `internal` (default) / `crossref` (APA/MLA/BibTeX via content negotiation) / `s2` (BibTeX) — falls back to internal formatting with a note when unsupported |
| `cite_text` | Auto-insert citations into text: extract claims → S2-first search → three-section report |

---

## ❓ FAQ

<details>
<summary><b>Does this work without API keys?</b></summary>
<b>Yes, absolutely.</b> All three APIs (Semantic Scholar, OpenAlex, Crossref) have free tiers. Without keys, rate limits are lower but fully functional for day-to-day use.
</details>

<details>
<summary><b>What if the "node" command is not found?</b></summary>
Make sure Node.js is installed and in your PATH:

```bash
# Find where node is installed
which node
# If empty, install from https://nodejs.org/ or use nvm:
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.4/install.sh | bash
nvm install 22
```
</details>

<details>
<summary><b>Can I contribute?</b></summary>
Yes! PRs are welcome. Please open an issue first to discuss major changes.
</details>

<details>
<summary><b>The tools don't show up in my AI client</b></summary>
Try the following:
1. Restart your AI client completely
2. Verify the server path is **absolute** and correct
3. Run `node /absolute/path/to/mcp-server/dist/index.js` directly to check for errors
4. Make sure `npm run build` completed successfully
</details>

<details>
<summary><b>How to update?</b></summary>

**npm install** (recommended — for npx or global install users):
```bash
npm install -g cite-mcp@latest
```

**Git pull** (for local build users):
```bash
git pull
cd mcp-server
npm install
npm run build
```
Then restart your AI client.
</details>

---

## 📄 License

MIT
