import { PaperResult, searchSemanticScholar, searchOpenAlex, searchCrossref, deduplicate } from "./paper-search.js"
import { PaperDetail, getPaperDetailRaw } from "./paper-detail.js"
import { stagger, mapWithConcurrency, fetchWithRetry } from "./retry.js"
import { config } from "./config.js"
import { trackOpenAlexCall } from "./usage.js"

function stripXml(html: string): string {
  return html.replace(/<\/?[a-zA-Z][^>]*>/g, "").trim()
}

function escapeCell(value: string): string {
  return value.replace(/\|/g, "\\|")
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
    "| # | 标题 | 年份 | 期刊/会议 | 引用数 | DOI | URL | 数据源 |",
    "|---|------|------|-----------|--------|-----|-----|--------|",
  ]

  for (let i = 0; i < papers.length; i++) {
    const p = papers[i]
    const title = p.title.length > 50 ? p.title.slice(0, 50) + "..." : p.title
    const citations = p.citationCount != null ? String(p.citationCount) : "未知"
    const year = p.year ?? "未知"
    const venue = p.venue || "-"
    const doi = p.doi || "无"
    const url = p.url || "无"
    lines.push(`| ${i + 1} | ${escapeCell(title)} | ${year} | ${escapeCell(venue)} | ${citations} | ${doi} | ${url} | ${p.source} |`)
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
    `| 标题 | ${escapeCell(paper.title)} |`,
    `| 作者 | ${escapeCell(paper.authors) || "未知"} |`,
    `| 年份 | ${paper.year ?? "未知"} |`,
    `| 期刊/会议 | ${escapeCell(paper.venue || "未知")} |`,
    `| DOI | ${paper.doi || "无"} |`,
    `| URL | ${paper.url || "无"} |`,
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

export interface GroupByItem {
  key: string
  key_display_name?: string
  count: number
}

export interface FieldTrends {
  years: GroupByItem[]
  types: GroupByItem[]
  topics: GroupByItem[]
}

const TREND_DIMENSIONS = ["publication_year", "type", "primary_topic.id"]

async function fetchGroupBy(query: string, dimension: string): Promise<GroupByItem[]> {
  const { mailto, apiKey, baseUrl } = config.openalex
  const params = new URLSearchParams({ search: query, group_by: dimension })
  if (mailto) params.set("mailto", mailto)
  if (apiKey) params.set("api_key", apiKey)

  trackOpenAlexCall("group_by")
  const resp = await fetchWithRetry(`${baseUrl}/works?${params}`, {
    headers: mailto ? { "User-Agent": `OpenAlex/${mailto}` } : {},
  })
  if (!resp.ok) return []

  const data = await resp.json()
  const groups: GroupByItem[] = []
  for (const g of data.group_by || []) {
    if (typeof g?.count !== "number") continue
    groups.push({
      key: String(g.key ?? ""),
      key_display_name: g.key_display_name ?? undefined,
      count: g.count,
    })
  }
  return groups
}

function settledGroups(result: PromiseSettledResult<GroupByItem[]>): GroupByItem[] {
  return result.status === "fulfilled" ? result.value : []
}

function groupDisplayName(item: GroupByItem): string {
  return escapeCell((item.key_display_name || item.key).trim())
}

export function formatTrendSection(trends: FieldTrends): string {
  // publication_year keys come back as strings and in count order — re-sort by year
  const years = trends.years
    .map((item) => ({ year: parseInt(item.key, 10), count: item.count }))
    .filter((item) => Number.isFinite(item.year))
    .sort((a, b) => b.year - a.year)
    .slice(0, 8)
  const types = [...trends.types].sort((a, b) => b.count - a.count).slice(0, 5)
  const topics = [...trends.topics].sort((a, b) => b.count - a.count).slice(0, 5)

  if (years.length === 0 && types.length === 0 && topics.length === 0) return ""

  const lines: string[] = ["---", "", "### 领域趋势", ""]
  if (years.length > 0) {
    lines.push("**年份趋势**", "")
    for (const { year, count } of years) lines.push(`- ${year}: ${count} 篇`)
    lines.push("")
  }
  if (types.length > 0) {
    lines.push("**类型分布**", "")
    for (const item of types) lines.push(`- ${groupDisplayName(item)}: ${item.count} 篇`)
    lines.push("")
  }
  if (topics.length > 0) {
    lines.push("**研究热点**", "")
    for (const item of topics) lines.push(`- ${groupDisplayName(item)}: ${item.count} 篇`)
    lines.push("")
  }
  return lines.join("\n").trimEnd()
}

export interface AnalyzePapersResult {
  text: string
  papers: PaperResult[]
  trends: FieldTrends
}

export async function analyzePapers(
  query: string,
  count: number,
  context: string = "",
): Promise<AnalyzePapersResult> {
  const combinedQuery = context ? `${query} ${context}` : query
  const perSource = count * 2

  const s2 = await searchSemanticScholar(combinedQuery, perSource).catch(() => [])
  let all: PaperResult[] = [...s2]

  if (all.length < perSource) {
    const [oa, cr] = await Promise.allSettled(
      stagger([
        () => searchOpenAlex(combinedQuery, perSource),
        () => searchCrossref(combinedQuery, perSource),
      ]),
    )
    if (oa.status === "fulfilled") all = all.concat(oa.value)
    if (cr.status === "fulfilled") all = all.concat(cr.value)
  }

  const papers = deduplicate(all).slice(0, Math.max(count, 1))

  if (papers.length === 0) {
    return { text: "未找到相关文献。", papers: [], trends: { years: [], types: [], topics: [] } }
  }

  const details = await mapWithConcurrency(papers, 5, (p) =>
    p.doi ? getPaperDetailRaw(p.doi) : Promise.resolve(null),
  )

  const trendResults = await mapWithConcurrency(TREND_DIMENSIONS, 3, (dimension) =>
    fetchGroupBy(combinedQuery, dimension),
  )

  const overviewTable = formatOverviewTable(query, papers)
  const analyses = papers.map((p, i) => {
    const detail = details[i].status === "fulfilled" ? details[i].value : undefined
    return formatPaperAnalysis(i + 1, p, detail ?? undefined)
  })

  const trends: FieldTrends = {
    years: settledGroups(trendResults[0]),
    types: settledGroups(trendResults[1]),
    topics: settledGroups(trendResults[2]),
  }
  const trendSection = formatTrendSection(trends)

  const report = `${overviewTable}\n\n${analyses.join("\n\n")}`
  return { text: trendSection ? `${report}\n\n${trendSection}` : report, papers, trends }
}
