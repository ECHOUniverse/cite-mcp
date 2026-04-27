<p align="center">
  <h1 align="center">paper-tools-mcp 📄</h1>
  <p align="center"><b>Academic Paper Research MCP Server</b></p>
  <p align="center">学术论文研究工具 — 搜索 / 详情 / 推荐 / 引文格式化</p>
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
┌──────────────────┐       ┌───────────────────┐
│  AI Assistant    │ ◄─MCP─►  This MCP Server  │
│  (Claude, etc.)  │       │  (paper-tools)    │
└──────────────────┘       └───────────────────┘
                                     │
                    ┌────────────────┼────────────────┐
                    ▼                ▼                ▼
             Semantic Scholar   OpenAlex        Crossref
             (2亿+论文)         (2.5亿+工作)     (1.5亿+DOI记录)
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

### Prerequisites

- **Node.js** ≥ 18 (recommended: 22+)
  - Check: `node --version`
  - Download: [nodejs.org](https://nodejs.org/)
- **npm** (comes with Node.js)
  - Check: `npm --version`

### Step 1: Clone & Install

```bash
# Clone the repository
git clone https://github.com/your-username/text-import-paper.git
cd text-import-paper

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

Choose your MCP client below:

<details>
<summary><b>Claude Code (CLI)</b></summary>

Create or edit `.mcp.json` in your project root:

```json
{
  "mcpServers": {
    "paper-tools": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-server/dist/index.js"]
    }
  }
}
```

> ⚠️ Replace `/absolute/path/to/` with the actual path on your machine.
>
> You can get the absolute path by running `pwd` in the project root, then append `/mcp-server/dist/index.js`.

Then in Claude Code, type `/paper_search` or just ask Claude to search for papers.
</details>

<details>
<summary><b>Claude Desktop App</b></summary>

Edit `claude_desktop_config.json` (open via Claude Desktop → Settings → Developer):

```json
{
  "mcpServers": {
    "paper-tools": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-server/dist/index.js"]
    }
  }
}
```
</details>

<details>
<summary><b>Cursor / Windsurf / Other MCP Clients</b></summary>

Most MCP-compatible IDEs support a similar configuration. Set the command to:

| Field | Value |
|-------|-------|
| Command | `node` |
| Arguments | `["/absolute/path/to/mcp-server/dist/index.js"]` |
</details>

<details>
<summary><b>VS Code (GitHub Copilot with MCP)</b></summary>

Configure in VS Code settings (`settings.json`):

```json
{
  "github.copilot.advanced": {
    "mcpServers": {
      "paper-tools": {
        "command": "node",
        "args": ["/absolute/path/to/mcp-server/dist/index.js"]
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
