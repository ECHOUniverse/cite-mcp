import { config } from "./config.js"
import { fetchWithRetry, stagger } from "./retry.js"
import { fetchS2 } from "./s2-fetch.js"
import { formatAuthors, stripMarkup } from "./utils.js"
import { trackOpenAlexCall } from "./usage.js"

// config.s2.fields + citationStyles（roadmap 3.5 构建块：原始值透传，后续 wave 再暴露）
const S2_FIELDS = `${config.s2.fields},citationStyles`

export interface PaperDetail {
  title: string
  authors: string
  year: number | null
  abstract: string
  tldr?: string
  citationStyles?: Record<string, string>
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
    `URL: ${p.url || "无"}`,
    `DOI链接: ${p.doi ? `${config.doi.baseUrl}/${p.doi}` : "无"}`,
    `引用数: ${p.citationCount ?? "未知"}`,
    `来源: ${p.source}`,
  ]
  if (p.tldr) {
    lines.push(`\n一句话摘要: ${p.tldr}`)
  }
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

export async function getByDoiCrossref(doi: string): Promise<PaperDetail | null> {
  const resp = await fetchWithRetry(`${config.crossref.baseUrl}/${encodeURIComponent(doi)}`)
  if (!resp.ok) return null

  const data = await resp.json()
  const item = data.message
  if (!item) return null

  const authors = formatAuthors(item.author || [], "familyGiven")

  const venue = item["container-title"]?.[0] || null
  const refs = (item.reference || []).slice(0, 10).map((r: any) => ({
    title: r["article-title"] || r.unstructured || "未知",
    doi: r.DOI || null,
    year: r.year ? parseInt(r.year) : null,
  }))

  return {
    title: item.title?.[0] || "",
    authors,
    year: item.published?.["date-parts"]?.[0]?.[0] || item.created?.["date-parts"]?.[0]?.[0] || null,
    abstract: item.abstract ? stripMarkup(item.abstract) : "",
    doi: item.DOI || doi,
    url: item.URL || `${config.doi.baseUrl}/${doi}`,
    venue,
    citationCount: item["is-referenced-by-count"] ?? null,
    references: refs,
    source: "Crossref",
  }
}

export async function getByDoiSemantic(doi: string): Promise<PaperDetail | null> {
  const { baseUrl } = config.s2

  const resp = await fetchS2(`${baseUrl}/paper/DOI:${encodeURIComponent(doi)}?fields=${S2_FIELDS}`)
  if (!resp.ok) return null

  const p = await resp.json()
  const authors = formatAuthors(p.authors || [])

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
    tldr: p.tldr?.text || undefined,
    citationStyles: p.citationStyles || undefined,
    doi: p.externalIds?.DOI || doi,
    url: p.url || `${config.doi.baseUrl}/${doi}`,
    venue: p.venue || null,
    citationCount: p.citationCount ?? null,
    references: refs,
    source: "Semantic Scholar",
  }
}

// referenced_works are raw OpenAlex IDs; batch-fetch real titles in one request, fall back to ID display
async function resolveOpenAlexRefs(ids: string[]): Promise<{ title: string; doi: null; year: number | null }[]> {
  const fallback = ids.map((id) => ({ title: id, doi: null, year: null }))
  if (ids.length === 0) return fallback
  try {
    const { mailto, apiKey, baseUrl } = config.openalex
    const shortIds = ids.map((id) => id.replace(/^https?:\/\/openalex\.org\//, ""))
    const params = new URLSearchParams({
      filter: `ids.openalex:${shortIds.join("|")}`,
      select: "id,title,publication_year",
      per_page: String(ids.length),
    })
    if (mailto) params.set("mailto", mailto)
    if (apiKey) params.set("api_key", apiKey)
    trackOpenAlexCall("refs")
    const resp = await fetchWithRetry(`${baseUrl}/works?${params}`)
    if (!resp.ok) return fallback
    const data = await resp.json()
    const byId = new Map<string, any>()
    for (const w of data.results || []) {
      byId.set(String(w.id || "").replace(/^https?:\/\/openalex\.org\//, ""), w)
    }
    return ids.map((id, i) => {
      const w = byId.get(shortIds[i])
      if (!w?.title) return fallback[i]
      return { title: w.title, doi: null, year: w.publication_year || null }
    })
  } catch {
    return fallback
  }
}

export async function getByOpenAlex(doi: string): Promise<PaperDetail | null> {
  const { mailto, apiKey, baseUrl } = config.openalex
  const params = new URLSearchParams()
  if (mailto) params.set("mailto", mailto)
  if (apiKey) params.set("api_key", apiKey)
  const qs = params.toString()
  const url = `${baseUrl}/works/doi:${encodeURIComponent(doi)}${qs ? `?${qs}` : ""}`
  trackOpenAlexCall("detail")
  const resp = await fetchWithRetry(url)
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

  const refs = await resolveOpenAlexRefs((w.referenced_works || []).slice(0, 10))

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
  const { baseUrl } = config.s2

  const resp = await fetchS2(`${baseUrl}/paper/${encodeURIComponent(paperId)}?fields=${S2_FIELDS}`)
  if (!resp.ok) return null

  const p = await resp.json()
  const authors = formatAuthors(p.authors || [])

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
    tldr: p.tldr?.text || undefined,
    citationStyles: p.citationStyles || undefined,
    doi: p.externalIds?.DOI || null,
    url: p.url || "",
    venue: p.venue || null,
    citationCount: p.citationCount ?? null,
    references: refs,
    source: "Semantic Scholar",
  }
}

async function getByS2IdsBatch(paperIds: string[]): Promise<PaperDetail[]> {
  const { baseUrl } = config.s2

  const resp = await fetchS2(
    `${baseUrl}/paper/batch?fields=${encodeURIComponent(S2_FIELDS)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
      tldr: p.tldr?.text || undefined,
      citationStyles: p.citationStyles || undefined,
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

// -- S2 citations/references 端点（roadmap 3.1 构建块） --

export interface RelatedPaper {
  title: string
  authors: string
  year: number | null
  doi: string | null
  url: string
  citationCount: number | null
}

/** S2 paper id 归一化：裸 DOI（10.xxxx/...）自动补 DOI: 前缀，其余原样透传 */
export function toS2PaperId(paperId: string): string {
  const id = paperId.trim()
  return /^10\.\d{4,9}\//.test(id) ? `DOI:${id}` : id
}

/** 将 citingPaper/citedPaper 条目映射为统一结构；容忍稀疏元数据，url 回退链：p.url → doi.org → S2 页面 */
export function mapRelatedPaper(p: any): RelatedPaper {
  const doi = p?.externalIds?.DOI || null
  const url =
    p?.url ||
    (doi ? `${config.doi.baseUrl}/${doi}` : "") ||
    (p?.paperId ? `https://www.semanticscholar.org/paper/${p.paperId}` : "")
  return {
    title: p?.title || "",
    authors: formatAuthors(p?.authors || []),
    year: p?.year || null,
    doi,
    url,
    citationCount: p?.citationCount ?? null,
  }
}

async function getRelatedPapers(
  paperId: string,
  limit: number,
  kind: "citations" | "references",
): Promise<RelatedPaper[] | null> {
  const id = toS2PaperId(paperId)
  if (!id) return null
  const { baseUrl } = config.s2
  const clamped = Math.min(100, Math.max(1, Math.trunc(limit) || 1))
  const fields = "title,authors,year,externalIds,url,citationCount"

  const resp = await fetchS2(
    `${baseUrl}/paper/${encodeURIComponent(id)}/${kind}?limit=${clamped}&fields=${fields}`,
  )
  if (!resp.ok) return null

  const data = await resp.json()
  const key = kind === "citations" ? "citingPaper" : "citedPaper"
  const list: any[] = Array.isArray(data?.data) ? data.data : []
  return list
    .map((entry: any) => entry?.[key])
    .filter(Boolean)
    .map(mapRelatedPaper)
}

export function getPaperCitations(paperId: string, limit: number): Promise<RelatedPaper[] | null> {
  return getRelatedPapers(paperId, limit, "citations")
}

export function getPaperReferences(paperId: string, limit: number): Promise<RelatedPaper[] | null> {
  return getRelatedPapers(paperId, limit, "references")
}

// -- 被引/参考文献附加区块（paper_detail 的 includeCitations/includeReferences 参数） --

export interface RelatedOptions {
  includeCitations?: boolean
  includeReferences?: boolean
  relatedLimit?: number
}

/** 作者串截断：最多保留前 max 位，超出以「等」结尾 */
function truncateAuthorList(authors: string, max: number = 3): string {
  const parts = authors.split(";").map((s) => s.trim()).filter(Boolean)
  if (parts.length <= max) return parts.join("; ")
  return `${parts.slice(0, max).join("; ")} 等`
}

const RELATED_TITLES = { citations: "被引论文", references: "参考文献" } as const

interface RelatedSectionData {
  text: string
  /** null = 端点请求失败/数据源不可用；[] = 正常但无记录 */
  papers: RelatedPaper[] | null
}

async function formatRelatedSection(
  paperId: string,
  limit: number,
  kind: "citations" | "references",
): Promise<RelatedSectionData> {
  const title = RELATED_TITLES[kind]
  const header = `\n\n=== ${title}（前 ${limit} 条）===\n\n`
  let papers: RelatedPaper[] | null
  try {
    // S2 端点网络错误会抛错（与 getByDoiSemantic 一致），此处兜底为提示文案，绝不让详情响应崩溃
    papers = kind === "citations"
      ? await getPaperCitations(paperId, limit)
      : await getPaperReferences(paperId, limit)
  } catch {
    return { text: `${header}获取失败，请稍后重试。`, papers: null }
  }
  if (papers === null) return { text: `${header}数据源暂不可用，未能获取${title}列表。`, papers: null }
  if (papers.length === 0) return { text: `${header}暂无${title}记录。`, papers: [] }
  const items = papers.slice(0, limit).map((p, i) => {
    const authors = truncateAuthorList(p.authors)
    const head = `${i + 1}. ${p.title || "无标题"}${p.year ? ` (${p.year})` : ""}${authors ? ` — ${authors}` : ""}, 被引数 ${p.citationCount ?? "未知"}`
    return `${head}\n   DOI: ${p.doi || "无"} | URL: ${p.url || "无"}`
  })
  return { text: header + items.join("\n\n"), papers: papers.slice(0, limit) }
}

interface RelatedSectionsResult {
  text: string
  /** 仅在 includeCitations 时出现；null 表示获取失败/不可用 */
  citations?: RelatedPaper[] | null
  /** 仅在 includeReferences 时出现；null 表示获取失败/不可用 */
  references?: RelatedPaper[] | null
}

async function collectRelatedSections(
  paperId: string,
  opts: RelatedOptions,
  label?: string,
): Promise<RelatedSectionsResult> {
  const limit = opts.relatedLimit ?? 10
  const jobs: { kind: "citations" | "references"; promise: Promise<RelatedSectionData> }[] = []
  if (opts.includeCitations) jobs.push({ kind: "citations", promise: formatRelatedSection(paperId, limit, "citations") })
  if (opts.includeReferences) jobs.push({ kind: "references", promise: formatRelatedSection(paperId, limit, "references") })
  if (jobs.length === 0) return { text: "" }
  const sections = await Promise.all(jobs.map((j) => j.promise))
  const result: RelatedSectionsResult = {
    text: (label ? `\n\n--- ${label} ---` : "") + sections.map((s) => s.text).join(""),
  }
  for (let i = 0; i < jobs.length; i++) {
    if (jobs[i].kind === "citations") result.citations = sections[i].papers
    else result.references = sections[i].papers
  }
  return result
}

// -- Raw data export for internal reuse --

// Strips URL / "doi:" prefixes and surrounding whitespace; idempotent
function cleanDoi(doi: string): string {
  return doi
    .trim()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, "")
    .replace(/^doi:\s*/i, "")
    .trim()
}

export async function getPaperDetailRaw(doi: string): Promise<PaperDetail | null> {
  const cleaned = cleanDoi(doi)

  const [cr, s2, oa] = await Promise.allSettled(
    stagger([
      () => getByDoiCrossref(cleaned),
      () => getByDoiSemantic(cleaned),
      () => getByOpenAlex(cleaned),
    ]),
  )

  const results: PaperDetail[] = [
    ...(cr.status === "fulfilled" && cr.value ? [cr.value] : []),
    ...(s2.status === "fulfilled" && s2.value ? [s2.value] : []),
    ...(oa.status === "fulfilled" && oa.value ? [oa.value] : []),
  ]

  if (results.length === 0) return null
  return results.find((r) => r.abstract && r.abstract.length > 50) || results[0]
}

// -- Exported tools --

export interface PaperDetailData {
  text: string
  /** 单篇模式 0-1 条（展示用 best）；批量模式为全部命中 */
  results: PaperDetail[]
}

export async function getPaperDetail(doi: string): Promise<PaperDetailData> {
  const cleaned = cleanDoi(doi)

  const [cr, s2, oa] = await Promise.allSettled(
    stagger([
      () => getByDoiCrossref(cleaned),
      () => getByDoiSemantic(cleaned),
      () => getByOpenAlex(cleaned),
    ]),
  )

  const results: PaperDetail[] = [
    ...(cr.status === "fulfilled" && cr.value ? [cr.value] : []),
    ...(s2.status === "fulfilled" && s2.value ? [s2.value] : []),
    ...(oa.status === "fulfilled" && oa.value ? [oa.value] : []),
  ]

  if (results.length === 0) {
    return { text: `未找到 DOI: ${doi} 对应的论文。请检查 DOI 是否正确。`, results: [] }
  }

  const best = results.find((r) => r.abstract && r.abstract.length > 50) || results[0]

  let output = "=== 论文详情 ===\n\n"
  output += formatDetail(best)

  if (results.length > 1) {
    // 先收集补充行，确有内容才输出区块标题（避免源故障时留下空标题区块）
    const extraLines: string[] = []
    for (const r of results) {
      if (r === best) continue
      const extra: string[] = []
      if (r.citationCount !== null && best.citationCount === null) extra.push(`引用数: ${r.citationCount}`)
      if (r.venue && !best.venue) extra.push(`期刊: ${r.venue}`)
      if (extra.length > 0) {
        extraLines.push(`[${r.source}] ${extra.join(", ")}`)
      }
    }
    if (extraLines.length > 0) {
      output += "\n\n=== 其他数据源补充信息 ===\n\n" + extraLines.join("\n")
    }
  }

  return { text: output, results: [best] }
}

export async function getPaperDetailByS2Id(paperId: string): Promise<PaperDetailData> {
  const result = await getByS2Id(paperId)
  if (!result) {
    return { text: `未找到 Paper ID: ${paperId} 对应的论文。`, results: [] }
  }
  return { text: formatDetail(result), results: [result] }
}

export async function getPaperDetailBatch(paperIds: string[]): Promise<PaperDetailData> {
  const ids = paperIds.filter(Boolean)
  if (ids.length === 0) {
    return { text: "请提供至少一个 Paper ID。", results: [] }
  }
  const results = await getByS2IdsBatch(ids)
  if (results.length === 0) {
    return { text: "未找到任何对应的论文详情。", results: [] }
  }
  return { text: results.map(formatDetail).join("\n\n---\n\n"), results }
}

export interface PaperDetailUnifiedResult extends PaperDetailData {
  /** 单篇模式（doi/paperId）且 includeCitations 时出现 */
  citations?: RelatedPaper[] | null
  /** 单篇模式（doi/paperId）且 includeReferences 时出现 */
  references?: RelatedPaper[] | null
  /** 批量模式（paperIds）且 include* 时出现，按查询 ID 分组 */
  relatedByPaperId?: Record<string, { citations?: RelatedPaper[] | null; references?: RelatedPaper[] | null }>
}

// Unified detail entry: dispatches by doi / paperId / paperIds
export async function getPaperDetailUnified(args: {
  doi?: string
  paperId?: string
  paperIds?: string[]
  includeCitations?: boolean
  includeReferences?: boolean
  relatedLimit?: number
}): Promise<PaperDetailUnifiedResult> {
  const related: RelatedOptions = {
    includeCitations: args.includeCitations,
    includeReferences: args.includeReferences,
    relatedLimit: args.relatedLimit,
  }
  if (args.doi) {
    // 被引/参考文献端点经 toS2PaperId 自动补 DOI: 前缀，doi 输入始终可用
    const detail = await getPaperDetail(args.doi)
    const rel = await collectRelatedSections(args.doi, related)
    return { text: detail.text + rel.text, results: detail.results, citations: rel.citations, references: rel.references }
  }
  if (args.paperId) {
    const detail = await getPaperDetailByS2Id(args.paperId)
    const rel = await collectRelatedSections(args.paperId, related)
    return { text: detail.text + rel.text, results: detail.results, citations: rel.citations, references: rel.references }
  }
  if (args.paperIds && args.paperIds.length > 0) {
    const ids = args.paperIds.filter(Boolean)
    const detail = await getPaperDetailBatch(ids)
    const sections = await Promise.all(
      ids.map((id) => collectRelatedSections(id, related, `以下列表对应 Paper ID: ${id}`)),
    )
    const out: PaperDetailUnifiedResult = {
      text: detail.text + sections.map((s) => s.text).join(""),
      results: detail.results,
    }
    if (related.includeCitations || related.includeReferences) {
      const byId: PaperDetailUnifiedResult["relatedByPaperId"] = {}
      for (let i = 0; i < ids.length; i++) {
        byId[ids[i]] = { citations: sections[i].citations, references: sections[i].references }
      }
      out.relatedByPaperId = byId
    }
    return out
  }
  return { text: "请提供 doi、paperId 或 paperIds 参数之一。", results: [] }
}
