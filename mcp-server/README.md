# cite-mcp

**MCP Server for academic paper research** — search across Semantic Scholar, OpenAlex, and Crossref, get paper details, discover related works, and format citations.

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
      "args": ["cite-mcp"]
    }
  }
}
```

## Tools

| Tool | Description |
|------|-------------|
| `paper_search` | Multi-source search (S2 + OA + Crossref, auto-dedup) |
| `search_semantic_scholar` | Single-source search, advanced query syntax |
| `search_openalex` | Broad multidisciplinary search |
| `search_crossref` | DOI metadata search |
| `paper_detail` | Full paper details by DOI (3 sources merged) |
| `get_by_s2id` / `get_by_s2ids_batch` | Paper details by S2 Paper ID (single/batch) |
| `paper_recommendations` | Related paper discovery |
| `paper_analysis` | Cross-paper comparison + per-paper summaries |
| `citation` | Citation formatting (APA / MLA / GB/T 7714 / BibTeX) |

## Configuration

API keys are optional — the server works out of the box with default rate limits.

| Variable | Purpose |
|----------|---------|
| `S2_API_KEY` | Semantic Scholar: 100 req/s vs 1 req/s |
| `OPENALEX_MAILTO` | Your email for polite pool (higher rate limit) |
| `CROSSREF_MAILTO` | Your email for polite pool (higher rate limit) |

## Links

- GitHub: https://github.com/ECHOUniverse/cite-mcp
- Issues: https://github.com/ECHOUniverse/cite-mcp/issues
- License: MIT
