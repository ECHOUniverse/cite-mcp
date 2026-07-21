import { config } from "./config.js"
import { fetchWithRetry, stagger } from "./retry.js"
import { fetchS2 } from "./s2-fetch.js"
import { trackOpenAlexCall } from "./usage.js"

export interface AuthorResult {
  name: string
  affiliations: string
  paperCount: number | null
  citationCount: number | null
  hIndex: number | null
  source: string
  url: string
}

export async function searchAuthorsS2(query: string, limit: number): Promise<AuthorResult[]> {
  const { baseUrl } = config.s2
  const params = new URLSearchParams({
    query,
    limit: String(limit),
    fields: "name,affiliations,paperCount,citationCount,hIndex,url",
  })

  const resp = await fetchS2(`${baseUrl}/author/search?${params}`)
  if (!resp.ok) return []

  const data = await resp.json()
  const results: AuthorResult[] = []

  for (const a of data.data || []) {
    results.push({
      name: a.name || "",
      affiliations: (a.affiliations || []).filter(Boolean).join("; "),
      paperCount: a.paperCount ?? null,
      citationCount: a.citationCount ?? null,
      hIndex: a.hIndex ?? null,
      source: "Semantic Scholar",
      url: a.url || (a.authorId ? `https://api.semanticscholar.org/author/${a.authorId}` : ""),
    })
  }
  return results
}

export async function searchAuthorsOpenAlex(query: string, limit: number): Promise<AuthorResult[]> {
  const { mailto, apiKey, baseUrl } = config.openalex
  const params = new URLSearchParams({
    search: query,
    per_page: String(Math.min(limit, 50)),
  })
  if (mailto) params.set("mailto", mailto)
  if (apiKey) params.set("api_key", apiKey)

  trackOpenAlexCall("authors")
  const resp = await fetchWithRetry(`${baseUrl}/authors?${params}`, {
    headers: mailto ? { "User-Agent": `OpenAlex/${mailto}` } : {},
  })
  if (!resp.ok) return []

  const data = await resp.json()
  const results: AuthorResult[] = []

  for (const a of data.results || []) {
    // last_known_institutions 为现行字段；last_known_institution（单数）为旧版字段，作兜底
    const institutions: any[] = a.last_known_institutions
      || (a.last_known_institution ? [a.last_known_institution] : [])
    const affiliations = institutions
      .map((inst: any) => inst?.display_name)
      .filter(Boolean)
      .join("; ")

    results.push({
      name: a.display_name || "",
      affiliations,
      paperCount: a.works_count ?? null,
      citationCount: a.cited_by_count ?? null,
      hIndex: a.summary_stats?.h_index ?? null,
      source: "OpenAlex",
      url: a.id || "",
    })
  }
  return results
}

function clampLimit(limit: number): number {
  if (!Number.isFinite(limit)) return 10
  return Math.min(Math.max(Math.floor(limit), 1), 100)
}

export async function searchAuthors(
  query: string,
  source: "s2" | "openalex" | "all" = "all",
  limit: number = 10,
): Promise<AuthorResult[]> {
  if (!query || !query.trim()) {
    throw new Error("作者姓名（query）不能为空。")
  }
  if (source !== "s2" && source !== "openalex" && source !== "all") {
    throw new Error(`不支持的数据源 source: ${source}，可选值: s2 / openalex / all。`)
  }
  const lim = clampLimit(limit)
  const q = query.trim()

  if (source === "s2") return searchAuthorsS2(q, lim)
  if (source === "openalex") return searchAuthorsOpenAlex(q, lim)

  // "all": S2 与 OA 并发（stagger 200ms 防抖），拼接后按小写姓名去重，再截断到 limit
  const [s2, oa] = await Promise.allSettled(
    stagger([
      () => searchAuthorsS2(q, lim),
      () => searchAuthorsOpenAlex(q, lim),
    ]),
  )
  const all: AuthorResult[] = [
    ...(s2.status === "fulfilled" ? s2.value : []),
    ...(oa.status === "fulfilled" ? oa.value : []),
  ]

  const seen = new Set<string>()
  const deduped = all.filter((a) => {
    const key = a.name.trim().toLowerCase()
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
  return deduped.slice(0, lim)
}

export function formatAuthorResults(results: AuthorResult[]): string {
  if (results.length === 0) return "未找到相关作者。"
  return results
    .map((a, i) =>
      [
        `${i + 1}. ${a.name}`,
        `   机构: ${a.affiliations || "未知"}`,
        `   论文数: ${a.paperCount ?? "未知"}`,
        `   引用数: ${a.citationCount ?? "未知"}`,
        `   h指数: ${a.hIndex ?? "未知"}`,
        `   来源: ${a.source}`,
        `   URL: ${a.url || "无"}`,
      ].join("\n"),
    )
    .join("\n\n")
}
