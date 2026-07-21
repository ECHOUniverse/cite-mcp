import { config } from "./config.js"

/** 将作者数组格式化为分号分隔的作者字符串 */
export function formatAuthors(
  authors: { name?: string; family?: string; given?: string }[],
  mode: "name" | "familyGiven" = "name",
): string {
  if (mode === "familyGiven") {
    return authors
      .map(a => `${a.family || ""}, ${a.given || ""}`)
      .filter(s => s.trim().length > 2)
      .join("; ")
  }
  return authors
    .map(a => a.name ?? "")
    .filter(Boolean)
    .join("; ")
}

/**
 * 论文稳定标识键：与 paper-search.ts deduplicate 语义一致 ——
 * 有非空 DOI 时取 `doi:小写DOI`（DOI 优先，大小写不敏感），否则取 `小写标题:年份`；
 * DOI 与标题皆缺时返回空串（空键永不视为匹配，避免 null === null 误判）
 */
export function paperKey(p: { doi?: string | null; title?: string | null; year?: number | null }): string {
  const doi = p.doi?.trim()
  if (doi) return `doi:${doi}`.toLowerCase()
  const title = p.title?.trim()
  if (!title) return ""
  return `${title}:${p.year ?? null}`.toLowerCase()
}

/** 摘要截断：默认 500 字符，在单词边界处断开 */
export function truncateAbstract(abstract: string, maxLen: number = 500): string {
  if (abstract.length <= maxLen) return abstract
  const truncated = abstract.slice(0, maxLen)
  const lastSpace = truncated.lastIndexOf(" ")
  return (lastSpace > maxLen * 0.8 ? truncated.slice(0, lastSpace) : truncated) + "..."
}

/**
 * 清洗含 XML/HTML 标记的文本（如 Crossref 返回的 JATS 摘要）：
 * 先解码常见 HTML 实体，再去掉所有标签，最后去首尾空白
 */
export function stripMarkup(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/<[^>]+>/g, "")
    .trim()
}

/**
 * 错误信息脱敏（roadmap C2）：发往 MCP 客户端前调用。
 * 1) 截掉堆栈行（首个 "\n    at " 起）；2) 已配置的 API key 值替换为 ***（仅非空时）；
 * 3) 绝对路径（/Users/... 及当前工作目录）替换为 <path>
 */
export function sanitizeErrorMessage(msg: string): string {
  let out = msg
  const stackIdx = out.indexOf("\n    at ")
  if (stackIdx !== -1) out = out.slice(0, stackIdx)
  for (const key of [config.s2.apiKey, config.openalex.apiKey]) {
    if (key) out = out.split(key).join("***")
  }
  out = out.replace(/\/Users\/[^\s"'`)]+/g, "<path>")
  const cwd = process.cwd()
  if (cwd && cwd !== "/") out = out.split(cwd).join("<path>")
  return out
}
