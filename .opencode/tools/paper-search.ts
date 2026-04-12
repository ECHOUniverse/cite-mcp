import { tool } from "@opencode-ai/plugin"
import { config } from "./config"

interface PaperResult {
  title: string
  authors: string
  year: number | null
  abstract: string
  doi: string | null
  url: string
  source: string
  citationCount: number | null
  venue: string | null
}

async function searchOpenAlex(query: string, limit: number): Promise<PaperResult[]> {
  const { mailto, baseUrl } = config.openalex
  const params = new URLSearchParams({
    search: query,
    per_page: String(Math.min(limit, 50)),
    select: "title,authorships,publication_year,doi,abstract_inverted_index,cited_by_count,primary_location",
  })
  if (mailto) params.set("mailto", mailto)

  const resp = await fetch(`${baseUrl}/works?${params}`, {
    headers: mailto ? { "User-Agent": `OpenAlex/${mailto}` } : {},
  })
  if (!resp.ok) return []

  const data = await resp.json()
  const results: PaperResult[] = []

  for (const w of data.results || []) {
    const authors = (w.authorships || [])
      .map((a: any) => a.author?.display_name)
      .filter(Boolean)
      .join("; ")

    const loc = w.primary_location || {}
    const venue = loc.source?.display_name || null

    let abstract = ""
    if (w.abstract_inverted_index) {
      const words: string[] = []
      for (const [word, positions] of Object.entries(w.abstract_inverted_index)) {
        for (const pos of positions as number[]) {
          words[pos] = word
        }
      }
      abstract = words.filter(Boolean).join(" ")
    }

    results.push({
      title: w.title || "",
      authors,
      year: w.publication_year || null,
      abstract,
      doi: w.doi ? w.doi.replace(`${config.doi.baseUrl}/`, "") : null,
      url: w.doi || w.id || "",
      source: "OpenAlex",
      citationCount: w.cited_by_count ?? null,
      venue,
    })
  }
  return results
}

async function searchSemanticScholar(query: string, limit: number): Promise<PaperResult[]> {
  const { apiKey, baseUrl, fields } = config.s2
  const params = new URLSearchParams({
    query,
    limit: String(Math.min(limit, 100)),
    fields: "title,authors,year,abstract,externalIds,url,citationCount,venue",
  })

  const headers: Record<string, string> = {}
  if (apiKey) headers["x-api-key"] = apiKey

  const resp = await fetch(`${baseUrl}/paper/search?${params}`, { headers })
  if (!resp.ok) return []

  const data = await resp.json()
  const results: PaperResult[] = []

  for (const p of data.data || []) {
    const authors = (p.authors || [])
      .map((a: any) => a.name)
      .filter(Boolean)
      .join("; ")

    const ids = p.externalIds || {}
    const doi = ids.DOI || null

    results.push({
      title: p.title || "",
      authors,
      year: p.year || null,
      abstract: p.abstract || "",
      doi,
      url: p.url || (doi ? `${config.doi.baseUrl}/${doi}` : ""),
      source: "Semantic Scholar",
      citationCount: p.citationCount ?? null,
      venue: p.venue || null,
    })
  }
  return results
}

async function searchCrossref(query: string, limit: number): Promise<PaperResult[]> {
  const { baseUrl, mailto } = config.crossref
  const params = new URLSearchParams({
    query,
    rows: String(Math.min(limit, 50)),
  })
  if (mailto) params.set("mailto", mailto)

  const resp = await fetch(`${baseUrl}?${params}`)
  if (!resp.ok) return []

  const data = await resp.json()
  const results: PaperResult[] = []

  for (const item of (data.message?.items || [])) {
    const authors = (item.author || [])
      .map((a: any) => `${a.family}, ${a.given}`)
      .join("; ")

    const titles = item.title || []
    const venue = item["container-title"]?.[0] || null

    results.push({
      title: titles[0] || "",
      authors,
      year: item.published?.date_parts?.[0]?.[0] || item.created?.date_parts?.[0]?.[0] || null,
      abstract: item.abstract || "",
      doi: item.DOI || null,
      url: item.URL || (item.DOI ? `${config.doi.baseUrl}/${item.DOI}` : ""),
      source: "Crossref",
      citationCount: item["is-referenced-by-count"] ?? null,
      venue,
    })
  }
  return results
}

function deduplicate(papers: PaperResult[]): PaperResult[] {
  const seen = new Set<string>()
  return papers.filter((p) => {
    const key = p.doi ? `doi:${p.doi}` : `${p.title}:${p.year}`
    const lower = key.toLowerCase()
    if (seen.has(lower)) return false
    seen.add(lower)
    return true
  })
}

function formatResults(papers: PaperResult[]): string {
  if (papers.length === 0) return "未找到相关论文。"
  return papers
    .map((p, i) => {
      const lines = [
        `${i + 1}. ${p.title}`,
        `   作者: ${p.authors || "未知"}`,
        `   年份: ${p.year ?? "未知"}`,
        `   期刊: ${p.venue || "未知"}`,
        `   DOI: ${p.doi || "无"}`,
        `   URL: ${p.url}`,
        `   引用数: ${p.citationCount ?? "未知"}`,
        `   来源: ${p.source}`,
      ]
      if (p.abstract) {
        const shortened = p.abstract.length > 500 ? p.abstract.slice(0, 500) + "..." : p.abstract
        lines.push(`   摘要: ${shortened}`)
      }
      return lines.join("\n")
    })
    .join("\n\n")
}

export const search_openalex = tool({
  description: "通过 OpenAlex 搜索学术论文（全学科通用，2.5亿+工作）。返回标题、作者、年份、摘要、DOI、引用数等。",
  args: {
    query: tool.schema.string().describe("搜索关键词，建议使用英文"),
    limit: tool.schema.number().default(10).describe("返回结果数量，默认10，最大50"),
  },
  async execute(args) {
    const results = await searchOpenAlex(args.query, args.limit || 10)
    return formatResults(results)
  },
})

export const search_semantic = tool({
  description: "通过 Semantic Scholar 搜索学术论文（计算机科学和神经科学特别强）。返回标题、作者、年份、摘要、DOI、引用数等。",
  args: {
    query: tool.schema.string().describe("搜索关键词，建议使用英文"),
    limit: tool.schema.number().default(10).describe("返回结果数量，默认10，最大100"),
  },
  async execute(args) {
    const results = await searchSemanticScholar(args.query, args.limit || 10)
    return formatResults(results)
  },
})

export const search_crossref = tool({
  description: "通过 Crossref 搜索学术论文（DOI 元数据最权威）。返回标题、作者、年份、摘要、DOI、引用数等。",
  args: {
    query: tool.schema.string().describe("搜索关键词，建议使用英文"),
    limit: tool.schema.number().default(10).describe("返回结果数量，默认10，最大50"),
  },
  async execute(args) {
    const results = await searchCrossref(args.query, args.limit || 10)
    return formatResults(results)
  },
})

export default tool({
  description:
    "多源学术论文搜索。同时搜索 OpenAlex、Semantic Scholar、Crossref 三个数据库，去重后返回统一结果。推荐优先使用此工具。",
  args: {
    query: tool.schema.string().describe("搜索关键词，建议使用英文"),
    limit: tool.schema.number().default(10).describe("每个数据源返回的结果数，默认10"),
  },
  async execute(args) {
    const perSource = args.limit || 10
    const [oa, s2, cr] = await Promise.allSettled([
      searchOpenAlex(args.query, perSource),
      searchSemanticScholar(args.query, perSource),
      searchCrossref(args.query, perSource),
    ])
    const all: PaperResult[] = [
      ...(oa.status === "fulfilled" ? oa.value : []),
      ...(s2.status === "fulfilled" ? s2.value : []),
      ...(cr.status === "fulfilled" ? cr.value : []),
    ]
    const deduped = deduplicate(all)
    const errors: string[] = []
    if (oa.status === "rejected") errors.push(`OpenAlex: ${oa.reason}`)
    if (s2.status === "rejected") errors.push(`Semantic Scholar: ${s2.reason}`)
    if (cr.status === "rejected") errors.push(`Crossref: ${cr.reason}`)

    let output = formatResults(deduped)
    if (errors.length > 0) {
      output += `\n\n---\n部分数据源出错:\n${errors.join("\n")}`
    }
    return output
  },
})