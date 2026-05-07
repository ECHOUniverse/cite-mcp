import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js"

import "./config.js"
import { searchPapers } from "./paper-search.js"
import { getPaperDetailUnified } from "./paper-detail.js"
import { getPaperRecommendations } from "./paper-recommendations.js"
import { formatCitation, formatCitationReport } from "./citation.js"
import { analyzePapers } from "./paper-analysis.js"
import { citeText, formatCiteTextReport } from "./cite-text.js"

const server = new Server(
  {
    name: "cite-mcp",
    version: "2.0.0",
  },
  {
    capabilities: {
      tools: {},
      prompts: {},
    },
  },
)

// --- Tool list ---

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "paper_search",
      description: "统一文献搜索。source 参数选择数据源：all（默认，多源聚合去重）、s2（Semantic Scholar，CS/AI领域首选）、openalex（全学科2.5亿+作品）、crossref（DOI元数据最权威）。用户说「搜 XX 论文」时使用此工具。输出结果强制包含每篇论文的 DOI 和 URL。",
      inputSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "搜索关键词，建议英文。支持 Semantic Scholar 高级语法：AND/OR/NOT/短语/前缀匹配",
          },
          source: {
            type: "string",
            description: "数据源：all | s2 | openalex | crossref",
            enum: ["all", "s2", "openalex", "crossref"],
            default: "all",
          },
          context: {
            type: "string",
            description: "背景上下文，额外关键词自动附加到搜索词后提升相关性",
          },
          limit: {
            type: "number",
            description: "返回结果数，默认10。S2最大100，OA/CR最大50",
            default: 10,
          },
        },
        required: ["query"],
      },
    },
    {
      name: "paper_detail",
      description: "统一论文详情查询。支持三种模式：通过 DOI（如 10.1038/nature14539）、通过 Semantic Scholar Paper ID（如 CorpusId:12345）、批量 Paper ID 查询。用户说「这篇论文具体内容是什么」时使用。输出结果强制包含论文 DOI、URL 和 DOI 链接。",
      inputSchema: {
        type: "object",
        properties: {
          doi: {
            type: "string",
            description: "论文 DOI（不含 https://doi.org/ 前缀）",
          },
          paperId: {
            type: "string",
            description: "Semantic Scholar Paper ID（如 CorpusId:12345 或 SHA哈希）",
          },
          paperIds: {
            type: "array",
            items: { type: "string" },
            description: "批量查询的 Semantic Scholar Paper ID 列表（最多500个）",
          },
        },
      },
    },
    {
      name: "paper_recommendations",
      description: "基于已知论文获取推荐文献。用户说「帮我找和这篇类似的论文」时使用。配合 paper_search 和 paper_detail 形成「搜索→查看→拓展」闭环。输出结果强制包含每篇推荐论文的 DOI 和 URL。",
      inputSchema: {
        type: "object",
        properties: {
          paperId: {
            type: "string",
            description: "源论文的 Semantic Scholar Paper ID",
          },
          limit: {
            type: "number",
            description: "推荐数量，默认10，最大500",
            default: 10,
          },
          from: {
            type: "string",
            description: "推荐池：recent（近期论文，时效性好）| all-cs（全CS领域，覆盖面广）",
            enum: ["recent", "all-cs"],
            default: "recent",
          },
        },
        required: ["paperId"],
      },
    },
    {
      name: "citation",
      description: "引文格式化。单篇模式支持 apa/mla/gb7714/bibtex/elsevier 五种格式。多篇报告模式（papers 数组 + elsevier 风格）输出三段式 Markdown 报告：正文引用编号 + 参考文献表 + 引文说明表。默认 Elsevier 格式，强制含 DOI 和 URL。**输出约束**：本工具返回严格的三段式 Markdown 报告，调用后必须原样展示全部三段（正文引用、参考文献、引文说明），禁止合并、删除、或重新编排。",
      inputSchema: {
        type: "object",
        properties: {
          papers: {
            type: "array",
            description: "论文列表（报告模式）。每项：authors, title, year, venue（必填）及 doi, url, volume, issue, pages, originalTextSummary, description（选填）",
            items: {
              type: "object",
              properties: {
                authors: { type: "string", description: "作者，格式: Smith, J.; Doe, A." },
                title: { type: "string", description: "标题" },
                year: { type: "number", description: "年份" },
                venue: { type: "string", description: "期刊/会议" },
                doi: { type: "string", description: "DOI（不含 https://doi.org/ 前缀），输出时强制生成完整 DOI 链接" },
                url: { type: "string", description: "论文直接 URL，DOI 优先，无 DOI 时使用此 URL" },
                volume: { type: "string" },
                issue: { type: "string" },
                pages: { type: "string" },
                originalTextSummary: { type: "string", description: "原文区域内容总结" },
                description: { type: "string", description: "引文说明" },
              },
              required: ["authors", "title", "year", "venue"],
            },
          },
          authors: { type: "string", description: "作者（单篇模式）" },
          title: { type: "string", description: "标题（单篇模式）" },
          year: { type: "number", description: "年份（单篇模式）" },
          venue: { type: "string", description: "期刊/会议（单篇模式）" },
          doi: { type: "string", description: "DOI（不含 https://doi.org/ 前缀），输出时强制生成完整 DOI 链接" },
          url: { type: "string", description: "论文直接 URL，DOI 优先，无 DOI 时使用此 URL" },
          volume: { type: "string" },
          issue: { type: "string" },
          pages: { type: "string" },
          style: {
            type: "string",
            description: "引文格式：apa | mla | gb7714 | bibtex | elsevier",
            enum: ["apa", "mla", "gb7714", "bibtex", "elsevier"],
            default: "elsevier",
          },
        },
      },
    },
    {
      name: "paper_analysis",
      description: "文献综述分析：搜索指定数量的高匹配文献，自动生成横向对比概览表 + 每篇详细总结。用户说「帮我了解下 XX 领域的研究现状」时使用。与 paper_search 区别：paper_search 返回列表，paper_analysis 返回带对比分析的综述报告。输出结果的概览表和详情表强制包含 DOI 和 URL 列。",
      inputSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "搜索关键词，建议英文",
          },
          count: {
            type: "number",
            description: "分析文献数，默认5",
            default: 5,
          },
          context: {
            type: "string",
            description: "背景上下文，额外关键词自动附加到搜索词后",
          },
        },
        required: ["query"],
      },
    },
    {
      name: "cite_text",
      description: "文本引文分析：输入文本段落 + 从文本中提取的论点列表，自动搜索支持文献，输出三段式报告（正文引用标记 + 参考文献表 + 引文说明表）。用户说「帮我给这段话插入参考文献」时使用。工作流：先提取文本中的论点 → 调用此工具搜索文献 → 获得三段式报告。参考文献表强制含 DOI 和 URL 链接，引文说明表强制含网址列。**输出约束**：本工具返回严格的三段式 Markdown 报告，调用后必须原样展示全部三段（正文引用、参考文献、引文说明），禁止合并、删除、或重新编排。",
      inputSchema: {
        type: "object",
        properties: {
          text: {
            type: "string",
            description: "需要插入引文的原始文本段落",
          },
          claims: {
            type: "array",
            description: "从文本中提取的论点列表。每项含 sentence（文本中的原句）和可选的 context（补充搜索上下文）",
            items: {
              type: "object",
              properties: {
                sentence: { type: "string", description: "文本中需要引文支持的论点句子（原文原句，用于定位插入位置）" },
                context: { type: "string", description: "补充搜索上下文，帮助提升搜索精度" },
              },
              required: ["sentence"],
            },
          },
          limit: {
            type: "number",
            description: "每个论点返回的最大论文数，默认2",
            default: 2,
          },
        },
        required: ["text", "claims"],
      },
    },
  ],
}))

// --- Prompt list ---

server.setRequestHandler(ListPromptsRequestSchema, async () => ({
  prompts: [
    {
      name: "literature_survey",
      description: "文献调研工作流：搜索→查看详情→推荐拓展。用于全面了解一个研究方向的文献脉络。",
      arguments: [
        { name: "query", description: "研究方向关键词（英文）", required: true },
        { name: "context", description: "补充背景描述（可选）", required: false },
      ],
    },
    {
      name: "paper_verify",
      description: "论据验证工作流：提取文本论点→双向搜索（正向+反向）→分级（A/B/C）→争议检测→输出验证报告。用于验证论文段落中的学术主张是否有文献支持。",
      arguments: [
        { name: "text", description: "需要验证的文本段落", required: true },
        { name: "claim_count", description: "提取论点数量，默认3", required: false },
      ],
    },
    {
      name: "cite_text",
      description: "文本引文插入工作流：分析文本→提取可引用的论点→搜索支持文献→输出三段式报告（正文引用+参考文献+引文说明）。用于给一段文本自动查找并插入参考文献。",
      arguments: [
        { name: "text", description: "需要插入引文的文本段落", required: true },
        { name: "context", description: "领域背景补充（可选）", required: false },
      ],
    },
  ],
}))

// --- Prompt content ---

server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  const { name, arguments: args } = request.params

  switch (name) {
    case "literature_survey": {
      const query = args?.query || "YOUR_QUERY"
      const context = args?.context || ""
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `## 文献调研：${query}

请按照以下工作流进行系统性的文献调研：

### 第一步：搜索文献
使用 **paper_search** 工具搜索「${query}」${context ? `，背景上下文：「${context}」` : ""}。
- 建议先用 source="s2" 获取 CS/AI 领域的高质量结果
- 如结果不足，用 source="all" 进行多源聚合搜索

### 第二步：查看详情
对于搜索结果中感兴趣的论文（3-5篇），使用 **paper_detail** 工具查看完整详情：
- 关注：研究问题、方法论、关键发现、局限性
- 记录每篇论文的 DOI、URL 链接和引用数

### 第三步：拓展发现
对于核心论文，使用 **paper_recommendations** 工具获取相关推荐：
- from="recent" 获取近期相关研究
- from="all-cs" 获取更广泛的相关文献

### 第四步：总结
整理调研结果，包括：
- 研究方向概述
- 关键论文列表（每篇强制含 DOI 和 URL 链接、引用数）
- 研究空白与未来方向`,
            },
          },
        ],
      }
    }

    case "paper_verify": {
      const text = args?.text || "YOUR_TEXT"
      const claimCount = parseInt(args?.claim_count || "3", 10)
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `## 论据验证

请验证以下文本中的学术主张是否在文献中有据可查。

> **原文段落**
> ${text}

### 工作流

#### 第一步：提取论点
从原文中提取 ${claimCount} 个可验证的学术主张。每个论点：
- 必须是可证伪的（有明确研究对象）
- 排除背景描述、常识性陈述、未来展望
- 用一句话概括核心断言，翻译为英文关键词

#### 第二步：双向搜索
对每个论点执行：
- **正向搜索**：用 **paper_search** (source="s2") 搜索支持文献
- **反向搜索**：用 **paper_search** 搜索否定/挑战性文献（加关键词：limitations, challenge, refute, contradict）

#### 第三步：分级
| 级别 | 标准 |
|------|------|
| A | 摘要明确验证论点，且为论文核心贡献 |
| B | 论文涉及该方向，但非主要结论 |
| C | 主题相关，但无直接证据 |

#### 第四步：输出验证报告
使用 **citation** 工具（报告模式）输出三段式报告：
- 正文引用编号
- 参考文献表（Elsevier 格式，强制含 DOI + URL）
- 引文说明表

如有反向搜索发现的反驳文献，标记「存在学术争议」。

**注意**：citation 工具返回的三段式报告必须**原样展示**全部三段（正文引用、参考文献、引文说明），不得合并或删减。`,
            },
          },
        ],
      }
    }

    case "cite_text": {
      const text = args?.text || "YOUR_TEXT"
      const context = args?.context || ""
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `## 文本引文分析

请为以下文本自动查找并插入支持文献。

> **原文**
> ${text}
${context ? `\n**领域背景**: ${context}` : ""}

### 工作流

#### 第一步：提取论点
分析文本，识别其中需要文献支持的**事实性断言**。每个断言提取为：
- \`sentence\`: 文本中的原句（用于定位插入位置）
- \`context\`: 补充搜索关键词（英文）

#### 第二步：搜索文献
使用 **cite_text** 工具，传入文本和提取的论点列表：
- text: 原始文本
- claims: 论点数组
- limit: 每个论点返回 2 篇最佳匹配论文

#### 第三步：输出报告
cite_text 工具会自动返回三段式报告：
1. **正文引用**——原文中在论点句末插入 [N] 标记
2. **参考文献**——Elsevier 格式，强制含 DOI 链接和 URL
3. **引文说明**——表格，含标题、网址、原文总结、说明

#### 第四步：原样输出
将 cite_text 返回的三段式报告**原样输出**给用户，不得修改格式、不得合并段落、不得省略任何一节。`,
            },
          },
        ],
      }
    }

    default:
      throw new Error(`未知 Prompt: ${name}`)
  }
})

// --- Tool handlers ---

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params

  try {
    switch (name) {
      // 1. paper_search — unified search
      case "paper_search": {
        const result = await searchPapers(
          String(args?.query ?? ""),
          String(args?.context ?? ""),
          Number(args?.limit ?? 10),
          String(args?.source ?? "all"),
        )
        return { content: [{ type: "text", text: result }] }
      }

      // 2. paper_detail — unified detail
      case "paper_detail": {
        const paperIds = Array.isArray(args?.paperIds) ? args.paperIds.map(String) : undefined
        const result = await getPaperDetailUnified({
          doi: args?.doi ? String(args.doi) : undefined,
          paperId: args?.paperId ? String(args.paperId) : undefined,
          paperIds,
        })
        return { content: [{ type: "text", text: result }] }
      }

      // 3. paper_recommendations
      case "paper_recommendations": {
        const result = await getPaperRecommendations(
          String(args?.paperId ?? ""),
          Number(args?.limit ?? 10),
          String(args?.from ?? "recent"),
        )
        return { content: [{ type: "text", text: result }] }
      }

      // 4. citation
      case "citation": {
        const style = args?.style ? String(args.style) : "elsevier"

        if (args?.papers && Array.isArray(args.papers) && style === "elsevier") {
          const papers = (args.papers as any[]).map(p => ({
            authors: String(p.authors ?? ""),
            title: String(p.title ?? ""),
            year: Number(p.year ?? 0),
            venue: String(p.venue ?? ""),
            doi: p.doi ? String(p.doi) : undefined,
            url: p.url ? String(p.url) : undefined,
            volume: p.volume ? String(p.volume) : undefined,
            issue: p.issue ? String(p.issue) : undefined,
            pages: p.pages ? String(p.pages) : undefined,
            originalTextSummary: p.originalTextSummary ? String(p.originalTextSummary) : undefined,
            description: p.description ? String(p.description) : undefined,
          }))
          const result = formatCitationReport({ papers, style })
          return { content: [{ type: "text", text: result }] }
        }

        const result = await formatCitation({
          authors: String(args?.authors ?? ""),
          title: String(args?.title ?? ""),
          year: Number(args?.year ?? 0),
          venue: String(args?.venue ?? ""),
          doi: args?.doi ? String(args.doi) : undefined,
          url: args?.url ? String(args.url) : undefined,
          volume: args?.volume ? String(args.volume) : undefined,
          issue: args?.issue ? String(args.issue) : undefined,
          pages: args?.pages ? String(args.pages) : undefined,
          style,
        })
        return { content: [{ type: "text", text: result }] }
      }

      // 5. paper_analysis
      case "paper_analysis": {
        const result = await analyzePapers(
          String(args?.query ?? ""),
          Number(args?.count ?? 5),
          String(args?.context ?? ""),
        )
        return { content: [{ type: "text", text: result }] }
      }

      // 6. cite_text
      case "cite_text": {
        const text = String(args?.text ?? "")
        const claims = Array.isArray(args?.claims)
          ? (args.claims as any[]).map(c => ({
              sentence: String(c.sentence ?? ""),
              context: c.context ? String(c.context) : undefined,
            }))
          : []
        if (!text) throw new Error("text 参数为必填")
        if (claims.length === 0) throw new Error("claims 参数为必填，且至少包含一个论点")
        const limit = Number(args?.limit ?? 2)
        const result = await citeText(text, claims, limit)
        const report = formatCiteTextReport(result)
        return { content: [{ type: "text", text: report }] }
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
