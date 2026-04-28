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
| 📖 **Paper Detail** | 3 sources merged | Title, authors, abstract, references, citation count |
| 🎯 **Recommendations** | Semantic Scholar | Related paper discovery |
| 📝 **Citation Formatting** | — | APA 7th / MLA 9th / GB/T 7714-2015 / BibTeX |

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
      "args": ["cite-mcp"]
    }
  }
}
```

> 💡 **API keys**: Set `S2_API_KEY`, `OPENALEX_MAILTO`, `CROSSREF_MAILTO` as environment variables if you want higher rate limits. See [Configuration](#-configuration).

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
      "args": []
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
| `CROSSREF_MAILTO` | No | Enables Crossref polite pool (higher rate limit) |

**Without any keys**, the server still works with default rate limits (sufficient for casual use).

### Step 3: Register with an MCP Client

An example configuration file (`.mcp.json.example`) is provided in the project root. The steps for each client are below:

</details>

### MCP Client Setup

<details>
<summary><b>Claude Code (CLI)</b></summary>

Use npx (recommended):

```json
{
  "mcpServers": {
    "cite-mcp": {
      "command": "npx",
      "args": ["cite-mcp"]
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
      "args": []
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
      "args": ["cite-mcp"]
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
        "args": ["cite-mcp"]
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

### API Keys

API keys are **entirely optional**. Without them, the server works with default rate limits.

| Service | Key | How to Get | Benefit |
|---------|-----|-----------|---------|
| **Semantic Scholar** | `S2_API_KEY` | [Request here](https://www.semanticscholar.org/product/api) | 100 req/s (vs. 1 req/s without) |
| **OpenAlex** | `OPENALEX_MAILTO` | Just your email | Polite pool: ~10x faster |
| **Crossref** | `CROSSREF_MAILTO` | Just your email | Polite pool: ~10x faster |

Set them in your environment:

```bash
# Option A: .env file (loaded automatically)
echo "S2_API_KEY=your_key_here" >> .env
echo "OPENALEX_MAILTO=your@email.com" >> .env
echo "CROSSREF_MAILTO=your@email.com" >> .env

# Option B: Export as environment variables
export S2_API_KEY="your_key_here"
export OPENALEX_MAILTO="your@email.com"
export CROSSREF_MAILTO="your@email.com"
```

### How the `.env` File Works

The server automatically loads `.env` from two locations (in order):
1. The `mcp-server/` directory (inside the project)
2. The current working directory

Place your `.env` at either location. The file is already in `.gitignore`, so your keys won't be committed.

---

## 🛠️ Tool Reference

### Search Tools

| Tool | Best For | Sources | Limit |
|------|----------|---------|-------|
| `paper_search` | **Recommended for most users** | S2 → OA → CR (auto fallback) | 10 (default) |
| `search_semantic_scholar` | CS/AI/NLP papers; advanced queries | S2 only | max 100 |
| `search_openalex` | Broad multidisciplinary search | OA only | max 50 |
| `search_crossref` | DOI metadata lookup | CR only | max 50 |

**Semantic Scholar Advanced Query Syntax:**

| Syntax | Example | Effect |
|--------|---------|--------|
| `AND` | `transformer AND attention` | Both terms required |
| `OR` | `climate OR warming` | Either term |
| `NOT` | `GPT NOT chatgpt` | Exclude term |
| `"..."` | `"attention mechanism"` | Exact phrase |
| `neuro*` | `neuro*` | Prefix match (neural, neuroscience...) |
| `title:` | `title:transformer` | Search in title only |

### Detail Tools

| Tool | Input | Output |
|------|-------|--------|
| `paper_detail` | DOI | Merged detail from 3 sources + references |
| `get_by_s2id` | S2 Paper ID | Detail from Semantic Scholar |
| `get_by_s2ids_batch` | Array of S2 Paper IDs | Batch detail (up to 500) |

### Recommendation & Citation Tools

| Tool | Description |
|------|-------------|
| `paper_recommendations` | Find related papers via S2 recommendations |
| `citation` | Format: APA / MLA / GB/T 7714-2015 / BibTeX |

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
