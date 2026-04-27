import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js"

import "./config.js"
import { searchPapers, searchSemantic, searchOpenAlexApi, searchCrossrefApi } from "./paper-search.js"
import { getPaperDetail, getPaperDetailByS2Id, getPaperDetailBatch } from "./paper-detail.js"
import { getPaperRecommendations } from "./paper-recommendations.js"
import { formatCitation } from "./citation.js"

const server = new Server(
  {
    name: "cite-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  },
)

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    // --- Paper Search Tools ---
    {
      name: "paper_search",
      description: "多源学术论文搜索。优先搜索 Semantic Scholar，结果不足时补充 OpenAlex 和 Crossref，去重后返回统一结果。推荐优先使用此工具。",
      inputSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "搜索关键词，建议使用英文。支持 Semantic Scholar 高级语法：AND/OR/短语/否定/前缀/模糊/邻近匹配",
          },
          context: {
            type: "string",
            description: "背景上下文信息。描述研究主题、领域或具体方向（如'deep learning, transformer architecture, NLP'），这些额外关键词会被自动附加到搜索词后，帮助提升结果相关性。",
          },
          limit: {
            type: "number",
            description: "每个数据源返回的结果数，默认10",
            default: 10,
          },
        },
        required: ["query"],
      },
    },
    {
      name: "search_semantic_scholar",
      description: "通过 Semantic Scholar 搜索学术论文（计算机科学和神经科学特别强）。支持 AND/OR/短语/否定/前缀/模糊/邻近匹配等高级查询语法。",
      inputSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "搜索关键词。高级语法示例：\"attention mechanism\" AND transformer NOT GPT, climate OR warming, neuro*",
          },
          context: {
            type: "string",
            description: "背景上下文信息。描述研究主题、领域或具体方向，这些额外关键词会被自动附加到搜索词后，帮助提升结果相关性。",
          },
          limit: {
            type: "number",
            description: "返回结果数量，默认10，最大100",
            default: 10,
          },
        },
        required: ["query"],
      },
    },
    {
      name: "search_openalex",
      description: "通过 OpenAlex 搜索学术论文（全学科通用，2.5亿+工作）。",
      inputSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "搜索关键词，建议使用英文",
          },
          context: {
            type: "string",
            description: "背景上下文信息。描述研究主题、领域或具体方向，这些额外关键词会被自动附加到搜索词后，帮助提升结果相关性。",
          },
          limit: {
            type: "number",
            description: "返回结果数量，默认10，最大50",
            default: 10,
          },
        },
        required: ["query"],
      },
    },
    {
      name: "search_crossref",
      description: "通过 Crossref 搜索学术论文（DOI 元数据最权威）。",
      inputSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "搜索关键词，建议使用英文",
          },
          context: {
            type: "string",
            description: "背景上下文信息。描述研究主题、领域或具体方向，这些额外关键词会被自动附加到搜索词后，帮助提升结果相关性。",
          },
          limit: {
            type: "number",
            description: "返回结果数量，默认10，最大50",
            default: 10,
          },
        },
        required: ["query"],
      },
    },
    // --- Paper Detail Tools ---
    {
      name: "paper_detail",
      description: "通过 DOI 获取论文完整详情（多源合并），包括标题、作者、年份、摘要、引用数、参考文献等。同时从 Crossref、Semantic Scholar、OpenAlex 三个数据源获取并合并信息。",
      inputSchema: {
        type: "object",
        properties: {
          doi: {
            type: "string",
            description: "论文 DOI（不含 https://doi.org/ 前缀）",
          },
        },
        required: ["doi"],
      },
    },
    {
      name: "get_by_s2id",
      description: "通过 Semantic Scholar Paper ID 获取论文详情。适用于搜索结果返回的 S2 paperId。",
      inputSchema: {
        type: "object",
        properties: {
          paperId: {
            type: "string",
            description: "Semantic Scholar Paper ID（如 CorpusId:12345 或 SHA哈希）",
          },
        },
        required: ["paperId"],
      },
    },
    {
      name: "get_by_s2ids_batch",
      description: "通过 Semantic Scholar Paper ID 批量获取论文详情（最多500个）。",
      inputSchema: {
        type: "object",
        properties: {
          paperIds: {
            type: "array",
            items: { type: "string" },
            description: "Semantic Scholar Paper ID 列表",
          },
        },
        required: ["paperIds"],
      },
    },
    // --- Paper Recommendation Tool ---
    {
      name: "paper_recommendations",
      description: "基于一篇已知论文的 Semantic Scholar Paper ID，获取相关推荐论文。",
      inputSchema: {
        type: "object",
        properties: {
          paperId: {
            type: "string",
            description: "源论文的 Semantic Scholar Paper ID（如 CorpusId:12345 或 SHA哈希）",
          },
          limit: {
            type: "number",
            description: "返回推荐数量，默认10，最大500",
            default: 10,
          },
          from: {
            type: "string",
            description: "推荐来源池：recent（近期论文）或 all-cs（全部计算机科学论文）",
            enum: ["recent", "all-cs"],
            default: "recent",
          },
        },
        required: ["paperId"],
      },
    },
    // --- Citation Tool ---
    {
      name: "citation",
      description: "格式化学术引文。支持 APA 7th、MLA 9th、GB/T 7714-2015、BibTeX 四种格式。",
      inputSchema: {
        type: "object",
        properties: {
          authors: {
            type: "string",
            description: "作者列表，格式：Smith, J.; Doe, A.",
          },
          title: {
            type: "string",
            description: "论文标题",
          },
          year: {
            type: "number",
            description: "发表年份",
          },
          venue: {
            type: "string",
            description: "期刊/会议名称",
          },
          doi: {
            type: "string",
            description: "DOI标识符（不含 https://doi.org/ 前缀）",
          },
          volume: {
            type: "string",
            description: "卷号",
          },
          issue: {
            type: "string",
            description: "期号",
          },
          pages: {
            type: "string",
            description: "页码范围，如 1-15",
          },
          style: {
            type: "string",
            description: "引文格式：apa | mla | gb7714 | bibtex",
            enum: ["apa", "mla", "gb7714", "bibtex"],
            default: "apa",
          },
        },
        required: ["authors", "title", "year", "venue"],
      },
    },
  ],
}))

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params

  try {
    switch (name) {
      // Paper Search
      case "paper_search": {
        const result = await searchPapers(
          String(args?.query ?? ""),
          String(args?.context ?? ""),
          Number(args?.limit ?? 10),
        )
        return { content: [{ type: "text", text: result }] }
      }
      case "search_semantic_scholar": {
        const result = await searchSemantic(
          String(args?.query ?? ""),
          String(args?.context ?? ""),
          Number(args?.limit ?? 10),
        )
        return { content: [{ type: "text", text: result }] }
      }
      case "search_openalex": {
        const result = await searchOpenAlexApi(
          String(args?.query ?? ""),
          String(args?.context ?? ""),
          Number(args?.limit ?? 10),
        )
        return { content: [{ type: "text", text: result }] }
      }
      case "search_crossref": {
        const result = await searchCrossrefApi(
          String(args?.query ?? ""),
          String(args?.context ?? ""),
          Number(args?.limit ?? 10),
        )
        return { content: [{ type: "text", text: result }] }
      }

      // Paper Detail
      case "paper_detail": {
        const result = await getPaperDetail(String(args?.doi ?? ""))
        return { content: [{ type: "text", text: result }] }
      }
      case "get_by_s2id": {
        const result = await getPaperDetailByS2Id(String(args?.paperId ?? ""))
        return { content: [{ type: "text", text: result }] }
      }
      case "get_by_s2ids_batch": {
        const ids = Array.isArray(args?.paperIds) ? args.paperIds.map(String) : []
        const result = await getPaperDetailBatch(ids)
        return { content: [{ type: "text", text: result }] }
      }

      // Paper Recommendations
      case "paper_recommendations": {
        const result = await getPaperRecommendations(
          String(args?.paperId ?? ""),
          Number(args?.limit ?? 10),
          String(args?.from ?? "recent"),
        )
        return { content: [{ type: "text", text: result }] }
      }

      // Citation
      case "citation": {
        const result = await formatCitation({
          authors: String(args?.authors ?? ""),
          title: String(args?.title ?? ""),
          year: Number(args?.year ?? 0),
          venue: String(args?.venue ?? ""),
          doi: args?.doi ? String(args.doi) : undefined,
          volume: args?.volume ? String(args.volume) : undefined,
          issue: args?.issue ? String(args.issue) : undefined,
          pages: args?.pages ? String(args.pages) : undefined,
          style: args?.style ? String(args.style) : undefined,
        })
        return { content: [{ type: "text", text: result }] }
      }

      default:
        throw new Error(`未知工具: ${name}`)
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      content: [{ type: "text", text: `执行出错: ${message}` }],
      isError: true,
    }
  }
})

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

main().catch((error) => {
  console.error("Server error:", error)
  process.exit(1)
})
