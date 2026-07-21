# cite-mcp

**MCP Server for academic paper research** — search across Semantic Scholar, OpenAlex, and Crossref, get paper details, discover related works, format citations, auto-insert references into text, and look up authors, topics, and funders.

## Quick Start

```bash
npx cite-mcp
```

Configure your MCP client:

```json
{
  "mcpServers": {
    "cite-mcp": {
      "command": "npx",
      "args": ["cite-mcp"],
      "env": {
        "S2_API_KEY": "your-key-here",
        "OPENALEX_MAILTO": "your-email@example.com",
        "OPENALEX_API_KEY": "your-openalex-key",
        "CROSSREF_MAILTO": "your-email@example.com"
      }
    }
  }
}
```

> `env` is optional — the server works without any API keys.

## HTTP Transport

A stateless Streamable HTTP server ships alongside the default stdio server:

```bash
cite-mcp-http          # after global install (from source: npm run start:http)
```

It listens on `POST http://localhost:3000/mcp` (set `PORT` to change the port, default `3000`). Client config:

```json
{
  "mcpServers": {
    "cite-mcp-http": {
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

## Tools

| Tool | Description |
|------|-------------|
| `paper_search` | Multi-source search (all/s2/openalex/crossref, auto-dedup); `authorId` filters by OpenAlex author ID |
| `paper_detail` | Full paper details by DOI, S2 Paper ID, or batch IDs — optional full citation/reference lists (`includeCitations` / `includeReferences`) |
| `paper_recommendations` | Related paper discovery from a seed paper |
| `citation` | Citation formatting — single paper (APA/MLA/GB7714/BibTeX/Elsevier, optional `source`: internal/crossref/s2) or multi-paper report |
| `paper_analysis` | Cross-paper comparison + per-paper summaries + field-trend statistics for literature review |
| `cite_text` | Auto-find supporting papers for claims in a text paragraph, outputs citation report |
| `author_search` | Author lookup by name — affiliations, paper/citation counts, h-index (S2 + OpenAlex) |
| `topic_classify` | Classify a keyword into the OpenAlex topic hierarchy (domain / field / subfield) |
| `paper_funder` | Find a funder and its funded works via Crossref (`funderId` or `funderName`) |

## Prompts

| Prompt | Description |
|--------|-------------|
| `literature_survey` | Guided workflow: search → detail → recommendations for systematic literature review |
| `paper_verify` | Claim verification: extract claims → bidirectional search → grade (A/B/C) → report |
| `cite_text` | Text citation: analyze text → find supporting papers → output citation report |

## Configuration

API keys are optional — the server works out of the box with default rate limits. For higher limits, configure keys via any of the following methods.

### Setup Methods (priority: high → low)

**Method 1: MCP client `env` field (recommended)**

```json
{
  "mcpServers": {
    "cite-mcp": {
      "command": "npx",
      "args": ["cite-mcp"],
      "env": {
        "S2_API_KEY": "your-key",
        "OPENALEX_MAILTO": "your-email@example.com",
        "OPENALEX_API_KEY": "your-openalex-key",
        "CROSSREF_MAILTO": "your-email@example.com"
      }
    }
  }
}
```

**Method 2: Global `.cite-mcp.env` (all projects)**

```bash
cat > ~/.cite-mcp.env << 'EOF'
S2_API_KEY=your-key
OPENALEX_MAILTO=your-email@example.com
CROSSREF_MAILTO=your-email@example.com
EOF
```

**Method 3: Project `.env` (current project only)**

```bash
cp .env.example .env
# edit .env with your keys
```

### Priority

Higher-priority sources override lower ones. Within the same variable, the **first** source that provides a value wins:

1. MCP client `env` field (highest)
2. `~/.cite-mcp.env` (global)
3. `<project>/.env` (project root)
4. `cwd/.env` (working directory)

### Environment Variables

| Variable | API | Rate Limit | How to Get |
|----------|-----|------------|-------------|
| `S2_API_KEY` | Semantic Scholar | 100 req/s → 1 req/s | https://api.semanticscholar.org/ |
| `OPENALEX_MAILTO` | OpenAlex | Higher (polite pool) | — any email |
| `OPENALEX_API_KEY` | OpenAlex | Required since 2025 | https://openalex.org/account (free) |
| `CROSSREF_MAILTO` | Crossref | Higher (polite pool) | — any email |

## Links

- GitHub: https://github.com/ECHOUniverse/cite-mcp
- Issues: https://github.com/ECHOUniverse/cite-mcp/issues
- License: MIT
