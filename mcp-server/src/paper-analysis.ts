import { PaperResult, searchSemanticScholar, searchOpenAlex, searchCrossref, deduplicate } from "./paper-search.js"
import { PaperDetail, getPaperDetailRaw } from "./paper-detail.js"

function stripXml(html: string): string {
  return html.replace(/<\/?[a-zA-Z][^>]*>/g, "").trim()
}

function extractSummary(rawAbstract: string, maxSentences: number = 3): string {
  const abstract = stripXml(rawAbstract)
  if (!abstract) return "(摘要不可用)"
  const sentences = abstract.match(/[^.!?\n]+[.!?\n]?/g) || [abstract]
  return sentences.slice(0, maxSentences).join(" ").trim()
}

function formatOverviewTable(query: string, papers: PaperResult[]): string {
  const lines: string[] = [
    "## 文献分析报告",
    "",
    `**查询**: ${query}`,
    "",
    "### 文献概览",
    "",
    "| # | 标题 | 年份 | 期刊/会议 | 引用数 | 数据源 |",
    "|---|------|------|-----------|--------|--------|",
  ]

  for (let i = 0; i < papers.length; i++) {
    const p = papers[i]
    const title = p.title.length > 50 ? p.title.slice(0, 50) + "..." : p.title
    const citations = p.citationCount != null ? String(p.citationCount) : "未知"
    const year = p.year ?? "未知"
    const venue = p.venue || "-"
    lines.push(`| ${i + 1} | ${title} | ${year} | ${venue} | ${citations} | ${p.source} |`)
  }

  return lines.join("\n")
}

function formatPaperAnalysis(index: number, paper: PaperResult, detail?: PaperDetail): string {
  const blocks: string[] = [
    "---",
    "",
    `### ${index}. ${paper.title}`,
    "",
    `**总结**: ${extractSummary(detail?.abstract || paper.abstract)}`,
    "",
    "**性能数据**",
    "",
    "| 指标 | 值 |",
    "|------|-----|",
    `| 标题 | ${paper.title} |`,
    `| 作者 | ${paper.authors || "未知"} |`,
    `| 年份 | ${paper.year ?? "未知"} |`,
    `| 期刊/会议 | ${paper.venue || "未知"} |`,
    `| DOI | ${paper.doi || "无"} |`,
    `| 引用数 | ${paper.citationCount != null ? String(paper.citationCount) : "未知"} |`,
    `| 数据源 | ${paper.source} |`,
  ]

  // If detail is available and has a different citation count or venue, show supplementary info
  if (detail) {
    const extras: string[] = []
    if (detail.citationCount !== null && paper.citationCount === null) {
      extras.push(`引用数: ${detail.citationCount}`)
    }
    if (detail.venue && !paper.venue) {
      extras.push(`期刊: ${detail.venue}`)
    }
    if (extras.length > 0) {
      blocks.push("", `> 其他数据源补充: ${extras.join("; ")}`)
    }
  }

  return blocks.join("\n")
}

export async function analyzePapers(
  query: string,
  count: number,
  context: string = "",
): Promise<string> {
  const combinedQuery = context ? `${query} ${context}` : query
  const perSource = count * 2

  const s2 = await searchSemanticScholar(combinedQuery, perSource).catch(() => [])
  let all: PaperResult[] = [...s2]

  if (all.length < perSource) {
    const [oa, cr] = await Promise.allSettled([
      searchOpenAlex(combinedQuery, perSource),
      searchCrossref(combinedQuery, perSource),
    ])
    if (oa.status === "fulfilled") all = all.concat(oa.value)
    if (cr.status === "fulfilled") all = all.concat(cr.value)
  }

  const papers = deduplicate(all).slice(0, Math.max(count, 1))

  if (papers.length === 0) {
    return "未找到相关文献。"
  }

  const details = await Promise.allSettled(
    papers.map((p) => (p.doi ? getPaperDetailRaw(p.doi) : Promise.resolve(null))),
  )

  const overviewTable = formatOverviewTable(query, papers)
  const analyses = papers.map((p, i) => {
    const detail = details[i].status === "fulfilled" ? details[i].value : undefined
    return formatPaperAnalysis(i + 1, p, detail ?? undefined)
  })

  return `${overviewTable}\n\n${analyses.join("\n\n")}`
}
