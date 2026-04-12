import { tool } from "@opencode-ai/plugin"

function formatAPA(args: {
  authors: string
  title: string
  year: number
  venue: string
  doi?: string
  volume?: string
  issue?: string
  pages?: string
}): string {
  const doiPart = args.doi ? ` https://doi.org/${args.doi}` : ""
  const volIssue = args.volume
    ? args.issue
      ? `, ${args.volume}(${args.issue})`
      : `, ${args.volume}`
    : ""
  const pagesPart = args.pages ? `, ${args.pages}` : ""
  return `${args.authors} (${args.year}). ${args.title}. ${args.venue}${volIssue}${pagesPart}.${doiPart}`
}

function formatMLA(args: {
  authors: string
  title: string
  year: number
  venue: string
  doi?: string
  volume?: string
  issue?: string
  pages?: string
}): string {
  const doiPart = args.doi ? ` https://doi.org/${args.doi}` : ""
  const volIssue = args.volume
    ? args.issue
      ? ` ${args.volume}.${args.issue}`
      : ` ${args.volume}`
    : ""
  const pagesPart = args.pages ? `, pp. ${args.pages}` : ""
  return `${args.authors}. "${args.title}." ${args.venue}${volIssue}${pagesPart}, ${args.year}.${doiPart}`
}

function formatGB7714(args: {
  authors: string
  title: string
  year: number
  venue: string
  doi?: string
  volume?: string
  issue?: string
  pages?: string
}): string {
  const doiPart = args.doi ? ` DOI: ${args.doi}` : ""
  const volIssue = args.volume
    ? args.issue
      ? `, ${args.volume}(${args.issue})`
      : `, ${args.volume}`
    : ""
  const pagesPart = args.pages ? `: ${args.pages}` : ""
  return `${args.authors}. ${args.title}[J]. ${args.venue}${volIssue}${pagesPart}, ${args.year}.${doiPart}`
}

function formatBibTeX(args: {
  authors: string
  title: string
  year: number
  venue: string
  doi?: string
  volume?: string
  issue?: string
  pages?: string
}): string {
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

const citationInputSchema = {
  authors: tool.schema.string().describe("作者列表，格式：Smith, J.; Doe, A."),
  title: tool.schema.string().describe("论文标题"),
  year: tool.schema.number().describe("发表年份"),
  venue: tool.schema.string().describe("期刊/会议名称"),
  doi: tool.schema.string().optional().describe("DOI标识符（不含 https://doi.org/ 前缀）"),
  volume: tool.schema.string().optional().describe("卷号"),
  issue: tool.schema.string().optional().describe("期号"),
  pages: tool.schema.string().optional().describe("页码范围，如 1-15"),
  style: tool.schema
    .enum(["apa", "mla", "gb7714", "bibtex"])
    .default("apa")
    .describe("引文格式：apa | mla | gb7714 | bibtex"),
}

export default tool({
  description:
    "格式化学术引文。支持 APA 7th、MLA 9th、GB/T 7714-2015、BibTeX 四种格式。输入论元信息，输出标准格式的引文字符串。",
  args: citationInputSchema,
  async execute(args) {
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
  },
})