// OpenAlex API 调用计数（roadmap C4）：进程内内存计数，每 25 次调用向 stderr 输出一行汇总
const counts = new Map<string, number>()
let total = 0

export function trackOpenAlexCall(endpoint: string): void {
  const key = endpoint || "unknown"
  counts.set(key, (counts.get(key) ?? 0) + 1)
  total += 1
  if (total % 25 === 0) {
    const summary = [...counts.entries()].map(([k, v]) => `${k}:${v}`).join(", ")
    console.error(`[cite-mcp] OpenAlex 调用累计 ${total} 次 — ${summary}`)
  }
}

export function getOpenAlexUsage(): Record<string, number> {
  return Object.fromEntries(counts)
}

/** 仅供测试使用：清零计数器 */
export function resetOpenAlexUsage(): void {
  counts.clear()
  total = 0
}
