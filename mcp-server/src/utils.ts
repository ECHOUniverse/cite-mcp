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

/** 摘要截断：默认 500 字符，在单词边界处断开 */
export function truncateAbstract(abstract: string, maxLen: number = 500): string {
  if (abstract.length <= maxLen) return abstract
  const truncated = abstract.slice(0, maxLen)
  const lastSpace = truncated.lastIndexOf(" ")
  return (lastSpace > maxLen * 0.8 ? truncated.slice(0, lastSpace) : truncated) + "..."
}
