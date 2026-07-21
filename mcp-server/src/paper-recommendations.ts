import { config } from "./config.js"
import { fetchS2 } from "./s2-fetch.js"
import { formatAuthors, truncateAbstract } from "./utils.js"

export interface RecommendedPaper {
  paperId: string
  title: string
  authors: string
  year: number | null
  abstract: string
  tldr?: string
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
        `   URL: ${p.url || "无"}`,
        `   引用数: ${p.citationCount ?? "未知"}`,
      ]
      if (p.tldr) {
        lines.push(`   TLDR: ${p.tldr}`)
      }
      if (p.abstract) {
        const shortened = truncateAbstract(p.abstract)
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
  const { baseUrl } = config.s2

  // recommendations 端点不支持 tldr 字段（带它 S2 返回 400），勿加入
  const fields = "title,authors,year,abstract,externalIds,url,citationCount,venue"
  const resp = await fetchS2(
    `${baseUrl.replace("/graph/v1", "")}/recommendations/v1/papers/forpaper/${encodeURIComponent(paperId)}?limit=${Math.min(limit, 500)}&from=${fromPool}&fields=${encodeURIComponent(fields)}`,
  )
  if (!resp.ok) return []

  const data = await resp.json()
  const results: RecommendedPaper[] = []

  for (const p of data.recommendedPapers || []) {
    const authors = formatAuthors(p.authors || [])

    const ids = p.externalIds || {}
    const doi = ids.DOI || null

    results.push({
      paperId: p.paperId || "",
      title: p.title || "",
      authors,
      year: p.year || null,
      abstract: p.abstract || "",
      tldr: p.tldr?.text || undefined,
      doi,
      url: p.url || (doi ? `${config.doi.baseUrl}/${doi}` : ""),
      venue: p.venue || null,
      citationCount: p.citationCount ?? null,
    })
  }
  return results
}

export interface PaperRecommendationsResult {
  text: string
  papers: RecommendedPaper[]
}

export async function getPaperRecommendations(
  paperId: string,
  limit: number,
  from: string,
): Promise<PaperRecommendationsResult> {
  const results = await getRecommendationsForPaper(paperId, limit || 10, from || "recent")
  return { text: formatRecommendations(results, paperId), papers: results }
}
