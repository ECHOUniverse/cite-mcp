interface CitationArgs {
  authors: string
  title: string
  year: number
  venue: string
  doi?: string
  volume?: string
  issue?: string
  pages?: string
  style?: string
}

interface PaperEntry {
  authors: string
  title: string
  year: number
  venue: string
  doi?: string
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

function formatAPA(args: CitationArgs): string {
  const doiPart = args.doi ? ` https://doi.org/${args.doi}` : ""
  const volIssue = args.volume
    ? args.issue
      ? `, ${args.volume}(${args.issue})`
      : `, ${args.volume}`
    : ""
  const pagesPart = args.pages ? `, ${args.pages}` : ""
  return `${args.authors} (${args.year}). ${args.title}. ${args.venue}${volIssue}${pagesPart}.${doiPart}`
}

function formatMLA(args: CitationArgs): string {
  const doiPart = args.doi ? ` https://doi.org/${args.doi}` : ""
  const volIssue = args.volume
    ? args.issue
      ? ` ${args.volume}.${args.issue}`
      : ` ${args.volume}`
    : ""
  const pagesPart = args.pages ? `, pp. ${args.pages}` : ""
  return `${args.authors}. "${args.title}." ${args.venue}${volIssue}${pagesPart}, ${args.year}.${doiPart}`
}

function formatGB7714(args: CitationArgs): string {
  const doiPart = args.doi ? ` DOI: ${args.doi}` : ""
  const volIssue = args.volume
    ? args.issue
      ? `, ${args.volume}(${args.issue})`
      : `, ${args.volume}`
    : ""
  const pagesPart = args.pages ? `: ${args.pages}` : ""
  return `${args.authors}. ${args.title}[J]. ${args.venue}${volIssue}${pagesPart}, ${args.year}.${doiPart}`
}

function formatBibTeX(args: CitationArgs): string {
  const firstAuthor = args.authors.split(/[;,]/)[0]?.trim().split(" ").pop()?.toLowerCase() || "unknown"
  const key = `${firstAuthor}${args.year}`
  const lines: string[] = [
    `@article{${key},`,
    `  author = {${args.authors}},`,
    `  title = {${args.title}},`,
    `  journal = {${args.venue}},`,
    `  year = {${args.year}},`,
  ]
  if (args.volume) lines.push(`  volume = {${args.volume}},`)
  if (args.issue) lines.push(`  number = {${args.issue}},`)
  if (args.pages) lines.push(`  pages = {${args.pages}},`)
  if (args.doi) lines.push(`  doi = {${args.doi}},`)
  lines.push("}")
  return lines.join("\n")
}

// --- Elsevier format functions ---

function formatElsevierAuthors(authors: string): string {
  const parts = authors.split(";").map(s => s.trim()).filter(Boolean)
  if (parts.length === 0) return ""
  if (parts.length === 1) return parts[0]
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`
  return parts.slice(0, -1).join(", ") + ", and " + parts[parts.length - 1]
}

function formatElsevierRef(entry: PaperEntry, index: number): string {
  const authorStr = formatElsevierAuthors(entry.authors)
  const volPart = entry.volume ? `, vol. ${entry.volume}` : ""
  const issuePart = entry.issue ? `, no. ${entry.issue}` : ""
  const pagesPart = entry.pages ? `, pp. ${entry.pages}` : ""
  const doiPart = entry.doi ? ` https://doi.org/${entry.doi}` : ""
  return `[${index}] ${authorStr}, ${entry.title}, ${entry.venue}${volPart}${issuePart}${pagesPart}, ${entry.year}.${doiPart}`
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
    const doiUrl = p.doi ? `https://doi.org/${p.doi}` : ""
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
