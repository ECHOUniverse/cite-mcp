import { config } from "./config.js"
import { fetchWithRetry } from "./retry.js"
import { trackOpenAlexCall } from "./usage.js"

export interface TopicResult {
  name: string
  levelName: string
  worksCount: number | null
  url: string
  description?: string
}

// OpenAlex 主题层级: domain > field > subfield > topic
// level 映射: 0 = domain（领域）, 1 = field（学科）, 2 = subfield（子学科）
const LEVEL_KEYS = ["domain", "field", "subfield"] as const
const LEVEL_NAMES = ["领域", "学科", "子学科"]

export async function classifyTopic(query: string, level: number = 0): Promise<TopicResult[]> {
  if (!query || !query.trim()) {
    throw new Error("搜索关键词（query）不能为空。")
  }
  if (![0, 1, 2].includes(level)) {
    throw new Error(`无效的层级 level: ${level}，可选值: 0（领域）、1（学科）、2（子学科）。`)
  }

  const { mailto, apiKey, baseUrl } = config.openalex
  const params = new URLSearchParams({
    search: query.trim(),
    per_page: "25",
  })
  if (mailto) params.set("mailto", mailto)
  if (apiKey) params.set("api_key", apiKey)

  trackOpenAlexCall("topics")
  const resp = await fetchWithRetry(`${baseUrl}/topics?${params}`, {
    headers: mailto ? { "User-Agent": `OpenAlex/${mailto}` } : {},
  })
  if (!resp.ok) return []

  const data = await resp.json()
  const key = LEVEL_KEYS[level]

  // 按层级取每个命中主题的祖先节点，按 id 去重并保持首次出现顺序
  const seen = new Set<string>()
  const results: TopicResult[] = []
  for (const t of data.results || []) {
    const ancestor = t[key]
    if (!ancestor?.id || !ancestor?.display_name) continue
    if (seen.has(ancestor.id)) continue
    seen.add(ancestor.id)
    results.push({
      name: ancestor.display_name,
      levelName: LEVEL_NAMES[level],
      // 祖先节点不带 works_count（仅 topic 层有），缺省为 null
      worksCount: ancestor.works_count ?? null,
      url: ancestor.id,
    })
  }
  return results
}

export function formatTopicResults(results: TopicResult[], level: number): string {
  if (results.length === 0) return "未找到匹配的主题分类。"
  const levelName = LEVEL_NAMES[level] ?? `层级 ${level}`
  const items = results.map((t, i) => {
    const lines = [
      `${i + 1}. ${t.name}`,
      `   层级: ${t.levelName}`,
      `   成果数: ${t.worksCount ?? "未知"}`,
      `   URL: ${t.url || "无"}`,
    ]
    if (t.description) lines.push(`   描述: ${t.description}`)
    return lines.join("\n")
  })
  return `=== 主题分类（层级: ${levelName}）===\n\n${items.join("\n\n")}`
}
