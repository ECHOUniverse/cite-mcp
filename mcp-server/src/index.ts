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
import { analyzePapers } from "./paper-analysis.js"

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
      description: "【首选搜索】多源聚合搜索：同时搜索 Semantic Scholar、OpenAlex 和 Crossref，去重后返回统一结果。适用于通用/跨学科搜索场景。用户说「搜一下 XX 方向的论文」时建议优先使用。三个单源工具（search_semantic_scholar、search_openalex、search_crossref）仅在需要特定数据源的专有能力时使用。",
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
      description: "通过 Semantic Scholar 搜索学术论文。计算机科学（CS/AI/NLP）、神经科学领域首选。支持高级查询语法：AND/OR/短语/否定/前缀/模糊/邻近匹配。当需要精确查询语法或专注于 CS/AI/NLP 领域时使用此工具。通用搜索场景推荐使用 paper_search（多源聚合）。",
      inputSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "搜索关键词。高级语法示例：\"attention mechanism\" AND transformer NOT GPT, climate OR warming, neuro*",
          },
          context: {
            type: "string",
            description: "背景上下文信息。描述研究主题、领域或具体方向（如'deep learning, transformer architecture, NLP'），这些额外关键词会被自动附加到搜索词后，帮助提升结果相关性。",
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
      description: "通过 OpenAlex 搜索学术论文。全学科通用，覆盖 2.5 亿+ 学术作品。适用于跨学科广泛搜索，特别是在 Semantic Scholar 覆盖不足的学科领域。通用搜索场景推荐使用 paper_search（多源聚合）。",
      inputSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "搜索关键词，建议使用英文",
          },
          context: {
            type: "string",
            description: "背景上下文信息。描述研究主题、领域或具体方向（如'deep learning, transformer architecture, NLP'），这些额外关键词会被自动附加到搜索词后，帮助提升结果相关性。",
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
      description: "通过 Crossref 搜索学术论文。DOI 元数据最权威的数据源，适合验证论文元数据准确性或查找 DOI 信息。通用搜索场景推荐使用 paper_search（多源聚合）。",
      inputSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "搜索关键词，建议使用英文",
          },
          context: {
            type: "string",
            description: "背景上下文信息。描述研究主题、领域或具体方向（如'deep learning, transformer architecture, NLP'），这些额外关键词会被自动附加到搜索词后，帮助提升结果相关性。",
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
      description: "通过 DOI 获取论文完整详情（多源合并：Crossref + Semantic Scholar + OpenAlex）。返回标题、作者、年份、摘要、引用数、参考文献等完整信息。用户说「这篇论文具体内容是什么」时使用此工具（如果有 DOI），或使用 get_by_s2id（如果只有 S2 Paper ID）。在搜索获取候选列表后，对感兴趣的论文使用此工具查看详情。",
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
      description: "通过 Semantic Scholar Paper ID 获取单篇论文详情。适用于从搜索结果或推荐结果中直接查看某篇论文的详细信息。如果只有 DOI 则使用 paper_detail。功能同 paper_detail 但通过 S2 ID 而非 DOI 访问。",
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
      description: "通过 Semantic Scholar Paper ID 批量获取多篇论文详情。一次最多处理 500 个 Paper ID。适用于需要同时获取多篇论文详细信息的场景，如批量文献整理。如只需单篇，使用 get_by_s2id。",
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
      description: "基于已知论文的 Semantic Scholar Paper ID 获取相关推荐论文。用于拓展阅读、发现更多相关文献。在文献调研工作流中，通常放在 paper_search 和 paper_detail 之后使用，形成「搜索→查看→推荐拓展」的闭环。",
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
            description: "推荐来源池选项：recent（默认值，仅返回近期发表的相关论文，时效性好）；all-cs（从全部计算机科学论文中推荐，覆盖面更广但可能包含旧论文）",
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
      description: "格式化学术引文生成。支持 APA 7th、MLA 9th、GB/T 7714-2015（中国标准）、BibTeX 四种格式。用户说「帮我生成参考文献」时使用此工具。通常在论文搜索/获取详情后，对最终采用的文献生成格式化学术引用。",
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
    // --- Paper Analysis Tool ---
    {
      name: "paper_analysis",
      description: "【文献综述首选】文献综合分析：搜索指定数量的高匹配文献，自动生成横向对比概览表 + 每篇文献的详细总结和数据性能表。用户说「帮我了解下 XX 领域的研究现状」时使用此工具。与 paper_search 的区别：paper_search 返回论文列表，paper_analysis 返回带对比分析和总结的综合报告，适合快速了解一个研究方向的全貌。",
      inputSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "搜索关键词，建议使用英文",
          },
          count: {
            type: "number",
            description: "需要分析的文献数量，默认5",
            default: 5,
          },
          context: {
            type: "string",
            description: "背景上下文信息。描述研究主题、领域或具体方向（如'deep learning, transformer architecture, NLP'），这些额外关键词会被自动附加到搜索词后，帮助提升结果相关性。",
          },
        },
        required: ["query"],
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

      // Paper Analysis
      case "paper_analysis": {
        const result = await analyzePapers(
          String(args?.query ?? ""),
          Number(args?.count ?? 5),
          String(args?.context ?? ""),
        )
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
