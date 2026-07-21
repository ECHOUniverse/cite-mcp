import { config } from "./config.js"
import { fetchWithRetry, stagger } from "./retry.js"
import { fetchS2 } from "./s2-fetch.js"
import { formatAuthors, stripMarkup, truncateAbstract } from "./utils.js"
import { trackOpenAlexCall } from "./usage.js"

export interface PaperResult {
  title: string
  authors: string
  year: number | null
  abstract: string
  tldr?: string
  doi: string | null
  url: string
  source: string
  citationCount: number | null
  venue: string | null
}

export function reconstructAbstract(invertedIndex: Record<string, number[]>): string {
  const words: string[] = []
  for (const [word, positions] of Object.entries(invertedIndex)) {
    for (const pos of positions as number[]) {
      words[pos] = word
    }
  }
  return words.filter(Boolean).join(" ")
}

export function mapOpenAlexWork(w: any): PaperResult {
  const authors = (w.authorships || [])
    .map((a: any) => a.author?.display_name)
    .filter(Boolean)
    .join("; ")

  const loc = w.primary_location || {}
  const venue = loc.source?.display_name || null

  let abstract = ""
  if (w.abstract_inverted_index) {
    abstract = reconstructAbstract(w.abstract_inverted_index)
  }

  return {
    title: w.title || "",
    authors,
    year: w.publication_year || null,
    abstract,
    doi: w.doi ? w.doi.replace(`${config.doi.baseUrl}/`, "") : null,
    url: w.doi || w.id || "",
    source: "OpenAlex",
    citationCount: w.cited_by_count ?? null,
    venue,
  }
}

/** OpenAlex 作者 ID 归一化：接受短 ID（A5086183426）或完整 URL，非法输入返回 null */
export function normalizeOpenAlexAuthorId(raw: string): string | null {
  const m = raw.trim().match(/^(?:https?:\/\/openalex\.org\/)?(A\d+)$/i)
  return m ? m[1].toUpperCase() : null
}

export async function searchOpenAlex(query: string, limit: number, mode: "keyword" | "semantic" = "keyword", authorId?: string): Promise<PaperResult[]> {
  const { mailto, apiKey, baseUrl } = config.openalex
  const params = new URLSearchParams({
    per_page: String(Math.min(limit, 50)),
    select: "id,title,authorships,publication_year,doi,abstract_inverted_index,cited_by_count,primary_location",
  })
  if (authorId) {
    params.set("filter", `author.id:${authorId}`)
    // 无关键词时按被引数排序（查作者代表作场景）；有关键词时保持相关性排序
    if (!query) params.set("sort", "cited_by_count:desc")
  }
  if (query) {
    if (mode === "semantic") {
      params.set("search.semantic", query)
    } else {
      params.set("search", query)
    }
  }
  if (mailto) params.set("mailto", mailto)
  if (apiKey) params.set("api_key", apiKey)

  trackOpenAlexCall("search")
  const resp = await fetchWithRetry(`${baseUrl}/works?${params}`, {
    headers: mailto ? { "User-Agent": `OpenAlex/${mailto}` } : {},
  })
  if (!resp.ok) throw new Error(`OpenAlex 请求失败: HTTP ${resp.status}`)

  const data = await resp.json()
  const results: PaperResult[] = []

  for (const w of data.results || []) {
    results.push(mapOpenAlexWork(w))
  }
  return results
}

export function mapS2Paper(p: any): PaperResult {
  const authors = formatAuthors(p.authors || [])

  const ids = p.externalIds || {}
  const doi = ids.DOI || null

  return {
    title: p.title || "",
    authors,
    year: p.year || null,
    abstract: p.abstract || "",
    tldr: p.tldr?.text || undefined,
    doi,
    url: p.url || (doi ? `${config.doi.baseUrl}/${doi}` : ""),
    source: "Semantic Scholar",
    citationCount: p.citationCount ?? null,
    venue: p.venue || null,
  }
}

export async function searchSemanticScholar(query: string, limit: number): Promise<PaperResult[]> {
  const { baseUrl } = config.s2
  const params = new URLSearchParams({
    query,
    limit: String(Math.min(limit, 100)),
    fields: "title,authors,year,abstract,tldr,externalIds,url,citationCount,venue",
  })

  const resp = await fetchS2(`${baseUrl}/paper/search?${params}`)
  if (!resp.ok) throw new Error(`Semantic Scholar 请求失败: HTTP ${resp.status}`)

  const data = await resp.json()
  const results: PaperResult[] = []

  for (const p of data.data || []) {
    results.push(mapS2Paper(p))
  }
  return results
}

export function mapCrossrefWork(item: any): PaperResult {
  const authors = formatAuthors(item.author || [], "familyGiven")

  const titles = item.title || []
  const venue = item["container-title"]?.[0] || null

  return {
    title: titles[0] || "",
    authors,
    year: item.published?.["date-parts"]?.[0]?.[0] || item.created?.["date-parts"]?.[0]?.[0] || null,
    abstract: item.abstract ? stripMarkup(item.abstract) : "",
    doi: item.DOI || null,
    url: item.URL || (item.DOI ? `${config.doi.baseUrl}/${item.DOI}` : ""),
    source: "Crossref",
    citationCount: item["is-referenced-by-count"] ?? null,
    venue,
  }
}

export async function searchCrossref(query: string, limit: number): Promise<PaperResult[]> {
  const { baseUrl, mailto } = config.crossref
  const params = new URLSearchParams({
    query,
    rows: String(Math.min(limit, 50)),
  })
  if (mailto) params.set("mailto", mailto)

  const resp = await fetchWithRetry(`${baseUrl}?${params}`)
  if (!resp.ok) throw new Error(`Crossref 请求失败: HTTP ${resp.status}`)

  const data = await resp.json()
  const results: PaperResult[] = []

  for (const item of (data.message?.items || [])) {
    results.push(mapCrossrefWork(item))
  }
  return results
}

export function deduplicate(papers: PaperResult[]): PaperResult[] {
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
        `   URL: ${p.url || "无"}`,
        `   引用数: ${p.citationCount ?? "未知"}`,
        `   来源: ${p.source}`,
      ]
      if (p.tldr) {
        lines.push(`   TLDR: ${p.tldr}`)
      }
      if (p.abstract) {
        const shortened = truncateAbstract(p.abstract)
        lines.push(`   摘要: ${shortened}`)
      }
      return lines.join("\n")
    })
    .join("\n\n")
}

export interface SearchPapersResult {
  text: string
  papers: PaperResult[]
}

// Unified search with source parameter
export async function searchPapers(
  query: string,
  context: string,
  limit: number,
  source: string = "all",
  authorId?: string,
): Promise<SearchPapersResult> {
  const combinedQuery = context ? `${query} ${context}` : query
  const perSource = limit || 10
  const errors: string[] = []

  // 作者过滤路径：仅 OpenAlex 支持 author.id，直接走 OpenAlex（失败抛错，由调用方返回 isError）
  if (authorId) {
    const results = await searchOpenAlex(combinedQuery, perSource, "keyword", authorId)
    const deduped = deduplicate(results)
    const header = `作者过滤: OpenAlex author.id=${authorId}\n\n`
    return { text: header + formatResults(deduped), papers: deduped }
  }

  source = source.toLowerCase()
  // 指定单一数据源时请求失败直接抛错（不降级为"未找到相关论文"），由调用方返回 isError
  if (source === "s2" || source === "semantic_scholar") {
    const results = await searchSemanticScholar(combinedQuery, perSource)
    const deduped = deduplicate(results)
    return { text: formatResults(deduped), papers: deduped }
  }

  if (source === "openalex" || source === "oa") {
    const results = await searchOpenAlex(combinedQuery, perSource)
    return { text: formatResults(results), papers: results }
  }

  if (source === "crossref" || source === "cr") {
    const results = await searchCrossref(combinedQuery, perSource)
    return { text: formatResults(results), papers: results }
  }

  // Default: "all" — S2 first, fallback to OA+CR；单源失败不致命，但在结果末尾说明可用性
  const s2 = await searchSemanticScholar(combinedQuery, perSource).catch((err) => {
    errors.push(`Semantic Scholar: ${err instanceof Error ? err.message : String(err)}`)
    return []
  })

  let all: PaperResult[] = [...s2]

  if (all.length < perSource) {
    const [oa, cr] = await Promise.allSettled(
      stagger([
        () => searchOpenAlex(combinedQuery, perSource),
        () => searchCrossref(combinedQuery, perSource),
      ]),
    )
    if (oa.status === "fulfilled") all = all.concat(oa.value)
    else errors.push(`OpenAlex: ${oa.reason instanceof Error ? oa.reason.message : String(oa.reason)}`)
    if (cr.status === "fulfilled") all = all.concat(cr.value)
    else errors.push(`Crossref: ${cr.reason instanceof Error ? cr.reason.message : String(cr.reason)}`)
  }

  const deduped = deduplicate(all)

  let output = formatResults(deduped)
  if (errors.length > 0) {
    output += `\n\n---\n数据源可用性说明（部分源请求失败，结果可能不完整）:\n${errors.join("\n")}`
  }
  return { text: output, papers: deduped }
}

export async function searchSemantic(query: string, context: string, limit: number): Promise<string> {
  const combinedQuery = context ? `${query} ${context}` : query
  const results = await searchSemanticScholar(combinedQuery, limit || 10)
  return formatResults(results)
}

export async function searchOpenAlexApi(query: string, context: string, limit: number): Promise<string> {
  const combinedQuery = context ? `${query} ${context}` : query
  const results = await searchOpenAlex(combinedQuery, limit || 10)
  return formatResults(results)
}

export async function searchCrossrefApi(query: string, context: string, limit: number): Promise<string> {
  const combinedQuery = context ? `${query} ${context}` : query
  const results = await searchCrossref(combinedQuery, limit || 10)
  return formatResults(results)
}
