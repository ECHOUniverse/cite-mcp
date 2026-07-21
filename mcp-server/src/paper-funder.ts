import { config } from "./config.js"
import { fetchWithRetry } from "./retry.js"
import { formatAuthors } from "./utils.js"

export interface FunderWork {
  title: string
  authors: string
  year: number | null
  doi: string | null
  url: string
  type: string
}

export interface FunderResult {
  funderName: string
  funderId: string
  works: FunderWork[]
}

// config.crossref.baseUrl 以 /works 结尾；funders 端点挂在 Crossref API 根路径下
const crRoot = config.crossref.baseUrl.replace(/\/works$/, "")

async function resolveFunderByName(name: string): Promise<{ id: string; name: string }> {
  const { mailto } = config.crossref
  const params = new URLSearchParams({ query: name, rows: "1" })
  if (mailto) params.set("mailto", mailto)

  const resp = await fetchWithRetry(`${crRoot}/funders?${params}`)
  if (!resp.ok) {
    throw new Error(`资助方名称解析失败（HTTP ${resp.status}）: ${name}`)
  }
  const data = await resp.json()
  const item = data.message?.items?.[0]
  if (!item?.id) {
    throw new Error(`未找到名为 "${name}" 的资助方，请检查名称拼写或改用 funderId。`)
  }
  return { id: String(item.id), name: item.name || name }
}

function clampLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit)) return 20
  return Math.min(Math.max(Math.floor(limit), 1), 100)
}

export async function searchFunderWorks(options: {
  funderId?: string
  funderName?: string
  limit?: number
}): Promise<FunderResult> {
  const idArg = options.funderId?.trim()
  const nameArg = options.funderName?.trim()
  if (Boolean(idArg) === Boolean(nameArg)) {
    throw new Error("funderId 与 funderName 必须且只能提供其一。")
  }
  const limit = clampLimit(options.limit)

  let id: string
  let name: string
  if (nameArg) {
    const resolved = await resolveFunderByName(nameArg)
    id = resolved.id
    name = resolved.name
  } else {
    id = idArg!
    name = idArg!
  }

  const { mailto } = config.crossref
  const params = new URLSearchParams({
    rows: String(limit),
    select: "DOI,title,author,published,container-title,type",
  })
  if (mailto) params.set("mailto", mailto)

  const resp = await fetchWithRetry(`${crRoot}/funders/${encodeURIComponent(id)}/works?${params}`)
  const works: FunderWork[] = []
  if (resp.ok) {
    const data = await resp.json()
    for (const item of data.message?.items || []) {
      const doi = item.DOI || null
      works.push({
        title: item.title?.[0] || "",
        authors: formatAuthors(item.author || [], "familyGiven"),
        year: item.published?.["date-parts"]?.[0]?.[0] || null,
        doi,
        url: doi ? `${config.doi.baseUrl}/${doi}` : item.URL || "",
        type: item.type || "",
      })
    }
  }

  return { funderName: name, funderId: id, works }
}

export function formatFunderResult(r: FunderResult): string {
  const header = [
    "=== 资助方研究产出 ===",
    "",
    `资助方: ${r.funderName}`,
    `资助方ID: ${r.funderId}`,
    `成果数: ${r.works.length}`,
  ]
  if (r.works.length === 0) {
    return `${header.join("\n")}\n\n未找到该资助方资助的研究成果。`
  }
  const items = r.works.map((w, i) =>
    [
      `${i + 1}. ${w.title || "无标题"}`,
      `   作者: ${w.authors || "未知"}`,
      `   年份: ${w.year ?? "未知"}`,
      `   类型: ${w.type || "未知"}`,
      `   DOI: ${w.doi || "无"}`,
      `   URL: ${w.url || "无"}`,
    ].join("\n"),
  )
  return `${header.join("\n")}\n\n${items.join("\n\n")}`
}
