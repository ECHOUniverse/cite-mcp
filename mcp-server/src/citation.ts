import { config } from "./config.js"
import { fetchWithRetry } from "./retry.js"
import { getByDoiSemantic } from "./paper-detail.js"
import { stripMarkup } from "./utils.js"

interface CitationArgs {
  authors: string
  title: string
  year: number
  venue: string
  doi?: string
  url?: string
  volume?: string
  issue?: string
  pages?: string
  style?: string
}

interface PaperEntry {
  authors: string
  title: string
  year?: number | null
  venue: string
  doi?: string
  url?: string
  volume?: string
  issue?: string
  pages?: string
  originalTextSummary?: string
  description?: string
}

interface ReportArgs {
  papers: PaperEntry[]
  style?: string
}

/** 页码归一：优先 pages；缺省时由 first_page/last_page 组合（兼容 Crossref 风格字段命名） */
export function resolvePages(pages?: string, firstPage?: string, lastPage?: string): string | undefined {
  if (pages) return pages
  if (!firstPage) return undefined
  return lastPage && lastPage !== firstPage ? `${firstPage}-${lastPage}` : firstPage
}

function doiUrl(doi?: string): string {
  return doi ? ` https://doi.org/${doi}` : ""
}

/** 句末补句点：已以句点结尾则不重复添加（作者串常自带结尾句点，避免 "Doe, A.."） */
function withPeriod(s: string): string {
  return s.endsWith(".") ? s : s + "."
}

/** 标题补句点：以 . ? ! 结尾时不追加（避免 "What is AI?."） */
function titleWithPeriod(s: string): string {
  return /[.?!]$/.test(s) ? s : s + "."
}

/** BibTeX 特殊字符转义 */
function escapeBibTeX(s: string): string {
  return s.replace(/[&%_#{}]/g, ch => `\\${ch}`)
}

function formatAPA(args: CitationArgs): string {
  const doiPart = args.doi
    ? ` https://doi.org/${args.doi}`
    : (args.url ? ` ${args.url}` : " DOI: 无")
  const volIssue = args.volume
    ? args.issue
      ? `, ${args.volume}(${args.issue})`
      : `, ${args.volume}`
    : ""
  const pagesPart = args.pages ? `, ${args.pages}` : ""
  return `${args.authors} (${args.year}). ${titleWithPeriod(args.title)} ${args.venue}${volIssue}${pagesPart}.${doiPart}`
}

function formatMLA(args: CitationArgs): string {
  const doiPart = args.doi
    ? ` https://doi.org/${args.doi}`
    : (args.url ? ` ${args.url}` : " DOI: 无")
  // MLA9: Journal, vol. 10, no. 2, 2024, pp. 100-120.
  const volPart = args.volume ? `, vol. ${args.volume}` : ""
  const issuePart = args.issue ? `, no. ${args.issue}` : ""
  const pagesPart = args.pages ? `, pp. ${args.pages}` : ""
  return `${withPeriod(args.authors)} "${titleWithPeriod(args.title)}" ${args.venue}${volPart}${issuePart}, ${args.year}${pagesPart}.${doiPart}`
}

function formatGB7714(args: CitationArgs): string {
  const doiPart = args.doi
    ? ` DOI: ${args.doi}`
    : (args.url ? ` URL: ${args.url}` : " DOI: 无")
  // GB/T 7714: 刊名, 年, 卷(期): 页码.
  const volIssue = args.volume
    ? args.issue
      ? `, ${args.volume}(${args.issue})`
      : `, ${args.volume}`
    : ""
  const pagesPart = args.pages ? `: ${args.pages}` : ""
  return `${withPeriod(args.authors)} ${args.title}[J]. ${args.venue}, ${args.year}${volIssue}${pagesPart}.${doiPart}`
}

function formatBibTeX(args: CitationArgs): string {
  const firstAuthor = args.authors.split(/[;,]/)[0]?.trim().split(" ").pop()?.toLowerCase() || "unknown"
  const key = `${firstAuthor}${args.year}`
  // BibTeX 作者间必须以 " and " 连接（输入为分号分隔）
  const authors = args.authors.split(";").map(s => s.trim()).filter(Boolean).join(" and ")
  // 页码区间单连字符 → 双连字符（已是 -- 的不重复替换）
  const pages = args.pages ? args.pages.replace(/(\d)-(\d)/g, "$1--$2") : undefined
  const lines: string[] = [
    `@article{${key},`,
    `  author = {${escapeBibTeX(authors)}},`,
    `  title = {${escapeBibTeX(args.title)}},`,
    `  journal = {${escapeBibTeX(args.venue)}},`,
    `  year = {${args.year}},`,
  ]
  if (args.volume) lines.push(`  volume = {${args.volume}},`)
  if (args.issue) lines.push(`  number = {${args.issue}},`)
  if (pages) lines.push(`  pages = {${pages}},`)
  if (args.doi) lines.push(`  doi = {${args.doi}},`)
  if (args.url) lines.push(`  url = {${args.url}},`)
  lines.push("}")
  return lines.join("\n")
}

// --- Elsevier format functions ---

export function formatElsevierAuthors(authors: string): string {
  const parts = authors.split(";").map(s => s.trim()).filter(Boolean)
  if (parts.length === 0) return ""
  if (parts.length === 1) return parts[0]
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`
  return parts.slice(0, -1).join(", ") + ", and " + parts[parts.length - 1]
}

export function formatElsevierRef(entry: PaperEntry, index: number): string {
  const authorStr = formatElsevierAuthors(entry.authors)
  const volPart = entry.volume ? `, vol. ${entry.volume}` : ""
  const issuePart = entry.issue ? `, no. ${entry.issue}` : ""
  const pagesPart = entry.pages ? `, pp. ${entry.pages}` : ""
  // 年份缺失时省略年份段，避免输出 ", 0."
  const yearPart = entry.year ? `, ${entry.year}` : ""
  const urlPart = entry.doi
    ? ` https://doi.org/${entry.doi}`
    : entry.url
      ? ` ${entry.url}`
      : ""
  return `[${index}] ${authorStr}, ${entry.title}, ${entry.venue}${volPart}${issuePart}${pagesPart}${yearPart}.${urlPart}`
}

// --- Citation report (Elsevier default) ---

export function formatCitationReport(args: ReportArgs): string {
  if (!args.papers || args.papers.length === 0) {
    return "未提供论文列表。"
  }

  // Part 1: In-text citation markers
  const refNumbers = args.papers.map((_, i) => `[${i + 1}]`).join(", ")
  const body = `## 正文引用\n\n${refNumbers}\n\n`

  // Part 2: Reference list
  const refs = args.papers.map((p, i) => formatElsevierRef(p, i + 1)).join("\n\n")
  const refSection = `## 参考文献\n\n${refs}\n\n`

  // Part 3: Citation info table
  const header = "| 引文序号 | 标题 | 网址 | 原文区域内容总结 | 引文说明内容 |"
  const sep = "|----------|------|------|------------------|--------------|"
  const rows = args.papers.map((p, i) => {
    const doiUrl = p.doi ? `https://doi.org/${p.doi}` : (p.url || "无")
    return `| [${i + 1}] | ${p.title} | ${doiUrl} | ${p.originalTextSummary || ""} | ${p.description || ""} |`
  }).join("\n")
  const tableSection = `## 引文说明\n\n${header}\n${sep}\n${rows}`

  return body + refSection + tableSection
}

export async function formatCitation(args: CitationArgs): Promise<string> {
  const formatters: Record<string, () => string> = {
    apa: () => formatAPA(args),
    mla: () => formatMLA(args),
    gb7714: () => formatGB7714(args),
    bibtex: () => formatBibTeX(args),
    elsevier: () => formatElsevierRef(args as PaperEntry, 1),
  }
  const fn = formatters[args.style || "elsevier"]
  if (!fn) {
    return `不支持的引文格式: ${args.style}。可选：apa, mla, gb7714, bibtex, elsevier`
  }
  return fn()
}

// --- Crossref content negotiation (roadmap 3.4 building block) ---

/** 项目引文风格 → Crossref CSL 风格映射；gb7714/elsevier 无可靠等价，返回 null 由调用方回退内部格式化 */
export const CROSSREF_STYLE_MAP: Record<string, string> = {
  apa: "apa",
  mla: "modern-language-association",
}

/** Crossref 书目文本清洗：复用共享实现（解码常见 HTML 实体、去标签、去首尾空白） */
const cleanCrossrefText = stripMarkup

/**
 * Crossref 内容协商引文格式化：bibtex 走 Crossref REST transform 端点，
 * apa/mla 走 doi.org 内容协商（text/bibliography; style=<csl>，REST /works 对该 Accept 返回 406）；
 * 不支持的风格或请求失败返回 null（永不抛错）
 */
export async function formatCitationFromCrossref(doi: string, style: string): Promise<string | null> {
  let url: string
  let accept: string
  if (style === "bibtex") {
    url = `${config.crossref.baseUrl}/${encodeURIComponent(doi)}/transform/application/x-bibtex`
    accept = "application/x-bibtex"
  } else {
    const csl = CROSSREF_STYLE_MAP[style]
    if (!csl) return null
    url = `${config.doi.baseUrl}/${encodeURIComponent(doi)}`
    accept = `text/bibliography; style=${csl}`
  }
  try {
    const resp = await fetchWithRetry(url, { headers: { Accept: accept } })
    if (!resp.ok) return null
    const text = cleanCrossrefText(await resp.text())
    return text || null
  } catch {
    return null
  }
}

/**
 * Semantic Scholar citationStyles 引文：经详情路径获取 citationStyles 字段，
 * 目前仅可靠提供 bibtex；其余风格或请求失败返回 null（永不抛错），由调用方回退内部格式化
 */
export async function formatCitationFromS2(doi: string, style: string): Promise<string | null> {
  if (style !== "bibtex") return null
  try {
    const detail = await getByDoiSemantic(doi)
    const text = detail?.citationStyles?.bibtex
    return text?.trim() || null
  } catch {
    return null
  }
}
