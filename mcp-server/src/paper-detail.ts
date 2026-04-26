import { config } from "./config.js"

interface PaperDetail {
  title: string
  authors: string
  year: number | null
  abstract: string
  doi: string | null
  url: string
  venue: string | null
  citationCount: number | null
  references: { title: string; doi: string | null; year: number | null }[]
  source: string
}

function formatDetail(p: PaperDetail): string {
  const lines = [
    `标题: ${p.title}`,
    `作者: ${p.authors || "未知"}`,
    `年份: ${p.year ?? "未知"}`,
    `期刊: ${p.venue || "未知"}`,
    `DOI: ${p.doi || "无"}`,
    `URL: ${p.url}`,
    `DOI链接: ${p.doi ? `${config.doi.baseUrl}/${p.doi}` : "无"}`,
    `引用数: ${p.citationCount ?? "未知"}`,
    `来源: ${p.source}`,
  ]
  if (p.abstract) {
    lines.push(`\n摘要:\n${p.abstract}`)
  }
  if (p.references.length > 0) {
    lines.push(`\n参考文献 (前10条):`)
    p.references.slice(0, 10).forEach((r, i) => {
      lines.push(`  ${i + 1}. ${r.title}${r.year ? ` (${r.year})` : ""}${r.doi ? ` - DOI: ${r.doi}` : ""}`)
    })
  }
  return lines.join("\n")
}

async function getByDoiCrossref(doi: string): Promise<PaperDetail | null> {
  const resp = await fetch(`${config.crossref.baseUrl}/${encodeURIComponent(doi)}`)
  if (!resp.ok) return null

  const data = await resp.json()
  const item = data.message
  if (!item) return null

  const authors = (item.author || [])
    .map((a: any) => `${a.family}, ${a.given}`)
    .join("; ")

  const venue = item["container-title"]?.[0] || null
  const refs = (item.reference || []).slice(0, 10).map((r: any) => ({
    title: r["article-title"] || r.unstructured || "未知",
    doi: r.DOI || null,
    year: r.year ? parseInt(r.year) : null,
  }))

  return {
    title: item.title?.[0] || "",
    authors,
    year: item.published?.date_parts?.[0]?.[0] || item.created?.date_parts?.[0]?.[0] || null,
    abstract: item.abstract || "",
    doi: item.DOI || doi,
    url: item.URL || `${config.doi.baseUrl}/${doi}`,
    venue,
    citationCount: item["is-referenced-by-count"] ?? null,
    references: refs,
    source: "Crossref",
  }
}

async function getByDoiSemantic(doi: string): Promise<PaperDetail | null> {
  const { apiKey, baseUrl, fields } = config.s2
  const headers: Record<string, string> = {}
  if (apiKey) headers["x-api-key"] = apiKey

  const resp = await fetch(
    `${baseUrl}/paper/DOI:${encodeURIComponent(doi)}?fields=${fields}`,
    { headers },
  )
  if (!resp.ok) return null

  const p = await resp.json()
  const authors = (p.authors || [])
    .map((a: any) => a.name)
    .filter(Boolean)
    .join("; ")

  const refs = (p.references || []).slice(0, 10).map((r: any) => ({
    title: r.title || "未知",
    doi: r.externalIds?.DOI || null,
    year: r.year || null,
  }))

  return {
    title: p.title || "",
    authors,
    year: p.year || null,
    abstract: p.abstract || "",
    doi: p.externalIds?.DOI || doi,
    url: p.url || `${config.doi.baseUrl}/${doi}`,
    venue: p.venue || null,
    citationCount: p.citationCount ?? null,
    references: refs,
    source: "Semantic Scholar",
  }
}

async function getByOpenAlex(doi: string): Promise<PaperDetail | null> {
  const { mailto, baseUrl } = config.openalex
  const url = `${baseUrl}/works/doi:${encodeURIComponent(doi)}${mailto ? `?mailto=${mailto}` : ""}`
  const resp = await fetch(url)
  if (!resp.ok) return null

  const w = await resp.json()
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

  const refs = (w.referenced_works || []).slice(0, 10).map((id: string) => ({
    title: id,
    doi: null,
    year: null,
  }))

  return {
    title: w.title || "",
    authors,
    year: w.publication_year || null,
    abstract,
    doi: w.doi ? w.doi.replace(`${config.doi.baseUrl}/`, "") : doi,
    url: w.doi || `${config.doi.baseUrl}/${doi}`,
    venue,
    citationCount: w.cited_by_count ?? null,
    references: refs,
    source: "OpenAlex",
  }
}

async function getByS2Id(paperId: string): Promise<PaperDetail | null> {
  const { apiKey, baseUrl, fields } = config.s2
  const headers: Record<string, string> = {}
  if (apiKey) headers["x-api-key"] = apiKey

  const resp = await fetch(
    `${baseUrl}/paper/${encodeURIComponent(paperId)}?fields=${fields}`,
    { headers },
  )
  if (!resp.ok) return null

  const p = await resp.json()
  const authors = (p.authors || [])
    .map((a: any) => a.name)
    .filter(Boolean)
    .join("; ")

  const refs = (p.references || []).slice(0, 10).map((r: any) => ({
    title: r.title || "未知",
    doi: r.externalIds?.DOI || null,
    year: r.year || null,
  }))

  return {
    title: p.title || "",
    authors,
    year: p.year || null,
    abstract: p.abstract || "",
    doi: p.externalIds?.DOI || null,
    url: p.url || "",
    venue: p.venue || null,
    citationCount: p.citationCount ?? null,
    references: refs,
    source: "Semantic Scholar",
  }
}

async function getByS2IdsBatch(paperIds: string[]): Promise<PaperDetail[]> {
  const { apiKey, baseUrl, fields } = config.s2
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (apiKey) headers["x-api-key"] = apiKey

  const resp = await fetch(
    `${baseUrl}/paper/batch?fields=${encodeURIComponent(fields)}`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ ids: paperIds.slice(0, 500) }),
    },
  )
  if (!resp.ok) return []

  const data = await resp.json()
  const results: PaperDetail[] = []

  for (const p of data || []) {
    if (!p) continue
    const authors = (p.authors || [])
      .map((a: any) => a.name)
      .filter(Boolean)
      .join("; ")

    const refs = (p.references || []).slice(0, 10).map((r: any) => ({
      title: r.title || "未知",
      doi: r.externalIds?.DOI || null,
      year: r.year || null,
    }))

    results.push({
      title: p.title || "",
      authors,
      year: p.year || null,
      abstract: p.abstract || "",
      doi: p.externalIds?.DOI || null,
      url: p.url || "",
      venue: p.venue || null,
      citationCount: p.citationCount ?? null,
      references: refs,
      source: "Semantic Scholar",
    })
  }
  return results
}

// -- Exported tools --

export async function getPaperDetail(doi: string): Promise<string> {
  const cleanDoi = doi.trim().replace(/^https?:\/\/doi\.org\//, "")

  const [cr, s2, oa] = await Promise.allSettled([
    getByDoiCrossref(cleanDoi),
    getByDoiSemantic(cleanDoi),
    getByOpenAlex(cleanDoi),
  ])

  const results: PaperDetail[] = [
    ...(cr.status === "fulfilled" && cr.value ? [cr.value] : []),
    ...(s2.status === "fulfilled" && s2.value ? [s2.value] : []),
    ...(oa.status === "fulfilled" && oa.value ? [oa.value] : []),
  ]

  if (results.length === 0) {
    return `未找到 DOI: ${doi} 对应的论文。请检查 DOI 是否正确。`
  }

  const best = results.find((r) => r.abstract && r.abstract.length > 50) || results[0]

  let output = "=== 论文详情 ===\n\n"
  output += formatDetail(best)

  if (results.length > 1) {
    output += "\n\n=== 其他数据源补充信息 ===\n"
    for (const r of results) {
      if (r === best) continue
      const extra: string[] = []
      if (r.citationCount !== null && best.citationCount === null) extra.push(`引用数: ${r.citationCount}`)
      if (r.venue && !best.venue) extra.push(`期刊: ${r.venue}`)
      if (extra.length > 0) {
        output += `\n[${r.source}] ${extra.join(", ")}`
      }
    }
  }

  return output
}

export async function getPaperDetailByS2Id(paperId: string): Promise<string> {
  const result = await getByS2Id(paperId)
  if (!result) {
    return `未找到 Paper ID: ${paperId} 对应的论文。`
  }
  return formatDetail(result)
}

export async function getPaperDetailBatch(paperIds: string[]): Promise<string> {
  const ids = paperIds.filter(Boolean)
  if (ids.length === 0) {
    return "请提供至少一个 Paper ID。"
  }
  const results = await getByS2IdsBatch(ids)
  if (results.length === 0) {
    return "未找到任何对应的论文详情。"
  }
  return results.map(formatDetail).join("\n\n---\n\n")
}
