# cite-mcp

**MCP Server for academic paper research** — search across Semantic Scholar, OpenAlex, and Crossref, get paper details, discover related works, format citations, and auto-insert references into text.

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
| `paper_search` | Multi-source search (all/s2/openalex/crossref, auto-dedup) |
| `paper_detail` | Full paper details by DOI, S2 Paper ID, or batch IDs |
| `paper_recommendations` | Related paper discovery from a seed paper |
| `citation` | Citation formatting — single paper (APA/MLA/GB7714/BibTeX/Elsevier) or multi-paper report |
| `paper_analysis` | Cross-paper comparison + per-paper summaries for literature review |
| `cite_text` | Auto-find supporting papers for claims in a text paragraph, outputs citation report |

## Prompts

| Prompt | Description |
|--------|-------------|
| `literature_survey` | Guided workflow: search → detail → recommendations for systematic literature review |
| `paper_verify` | Claim verification: extract claims → bidirectional search → grade (A/B/C) → report |
| `cite_text` | Text citation: analyze text → find supporting papers → output citation report |

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
