import { config } from "./config.js"

interface RecommendedPaper {
  paperId: string
  title: string
  authors: string
  year: number | null
  abstract: string
  doi: string | null
  url: string
  venue: string | null
  citationCount: number | null
}

function formatRecommendations(papers: RecommendedPaper[], sourcePaperId: string): string {
  if (papers.length === 0) return `未找到论文 ${sourcePaperId} 的相关推荐。`
  return papers
    .map((p, i) => {
      const lines = [
        `${i + 1}. ${p.title}`,
        `   作者: ${p.authors || "未知"}`,
        `   年份: ${p.year ?? "未知"}`,
        `   期刊: ${p.venue || "未知"}`,
        `   DOI: ${p.doi || "无"}`,
        `   URL: ${p.url}`,
        `   引用数: ${p.citationCount ?? "未知"}`,
      ]
      if (p.abstract) {
        const shortened = p.abstract.length > 500 ? p.abstract.slice(0, 500) + "..." : p.abstract
        lines.push(`   摘要: ${shortened}`)
      }
      return lines.join("\n")
    })
    .join("\n\n")
}

async function getRecommendationsForPaper(
  paperId: string,
  limit: number,
  fromPool: string,
): Promise<RecommendedPaper[]> {
  const { apiKey, baseUrl } = config.s2
  const headers: Record<string, string> = {}
  if (apiKey) headers["x-api-key"] = apiKey

  const fields = "title,authors,year,abstract,externalIds,url,citationCount,venue"
  const resp = await fetch(
    `${baseUrl.replace("/graph/v1", "")}/recommendations/v1/papers/forpaper/${encodeURIComponent(paperId)}?limit=${Math.min(limit, 500)}&from=${fromPool}&fields=${encodeURIComponent(fields)}`,
    { headers },
  )
  if (!resp.ok) return []

  const data = await resp.json()
  const results: RecommendedPaper[] = []

  for (const p of data.recommendedPapers || []) {
    const authors = (p.authors || [])
      .map((a: any) => a.name)
      .filter(Boolean)
      .join("; ")

    const ids = p.externalIds || {}
    const doi = ids.DOI || null

    results.push({
      paperId: p.paperId || "",
      title: p.title || "",
      authors,
      year: p.year || null,
      abstract: p.abstract || "",
      doi,
      url: p.url || (doi ? `${config.doi.baseUrl}/${doi}` : ""),
      venue: p.venue || null,
      citationCount: p.citationCount ?? null,
    })
  }
  return results
}

export async function getPaperRecommendations(
  paperId: string,
  limit: number,
  from: string,
): Promise<string> {
  const results = await getRecommendationsForPaper(paperId, limit || 10, from || "recent")
  return formatRecommendations(results, paperId)
}
