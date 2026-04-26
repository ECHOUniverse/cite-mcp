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

export async function formatCitation(args: CitationArgs): Promise<string> {
  const formatters: Record<string, () => string> = {
    apa: () => formatAPA(args),
    mla: () => formatMLA(args),
    gb7714: () => formatGB7714(args),
    bibtex: () => formatBibTeX(args),
  }
  const fn = formatters[args.style || "apa"]
  if (!fn) {
    return `不支持的引文格式: ${args.style}。可选：apa, mla, gb7714, bibtex`
  }
  return fn()
}
