import { PaperResult, searchSemanticScholar, searchOpenAlex, searchCrossref, deduplicate } from "./paper-search.js"
import { formatElsevierRef } from "./citation.js"
import { stagger } from "./retry.js"

export interface ClaimInput {
  sentence: string
  context?: string
}

interface ClaimMatch {
  claim: ClaimInput
  papers: PaperResult[]
}

export interface CiteTextResult {
  bodyText: string
  references: { authors: string; title: string; year: number; venue: string; doi?: string; url: string; volume?: string; issue?: string; pages?: string }[]
  tableRows: { index: number; title: string; url: string; summary: string; description: string }[]
}

// Extract key terms from sentence: take meaningful words (>3 chars)
function extractKeyTerms(sentence: string, context: string = ""): string {
  const combined = `${sentence} ${context}`
  const words = combined.split(/[\s,;:.!?()]+/).filter(w => w.length > 3)
  // Remove duplicates
  return [...new Set(words)].slice(0, 8).join(" ")
}

// Progressive query strategies
function buildQueries(sentence: string, context: string): string[] {
  const queries: string[] = []

  // Level 1: sentence + context (most specific)
  queries.push(context ? `${sentence} ${context}` : sentence)

  // Level 2: context alone (if exists), or first 60 chars of sentence
  if (context && context.length > 5) {
    queries.push(context)
  } else {
    queries.push(sentence.slice(0, 80))
  }

  // Level 3: key terms only
  queries.push(extractKeyTerms(sentence, context))

  return queries
}

// Search all three sources in parallel, deduplicate
async function searchAllSources(query: string, limit: number): Promise<PaperResult[]> {
  const [s2, oa, cr] = await Promise.allSettled(
    stagger([
      () => searchSemanticScholar(query, limit),
      () => searchOpenAlex(query, limit),
      () => searchCrossref(query, limit),
    ]),
  )

  const results: PaperResult[] = []
  if (s2.status === "fulfilled") results.push(...s2.value)
  if (oa.status === "fulfilled") results.push(...oa.value)
  if (cr.status === "fulfilled") results.push(...cr.value)

  return deduplicate(results)
}

// Search for a claim with progressive query refinement
async function searchForClaim(claim: ClaimInput, limit: number): Promise<PaperResult[]> {
  const queries = buildQueries(claim.sentence, claim.context || "")
  let allFound: PaperResult[] = []
  const seen = new Set<string>()

  for (const query of queries) {
    if (allFound.length >= limit) break

    const papers = await searchAllSources(query, limit * 2)
    const newPapers = papers.filter(p => {
      const key = p.doi ? `doi:${p.doi}` : `${p.title}:${p.year}`
      const lower = key.toLowerCase()
      if (seen.has(lower)) return false
      seen.add(lower)
      return true
    })

    allFound = allFound.concat(newPapers)

    // If still no results after first query, try next level immediately
    // If we got some but not enough, try next level for fill
    if (allFound.length >= 1) {
      // Stop if we have enough for this claim
      if (allFound.length >= limit) break
      // Otherwise continue to next query for supplemental results
    }
  }

  return allFound.slice(0, limit)
}

// Match claim sentence positions in original text, return indices
function findClaimPositions(text: string, claims: ClaimInput[]): { claim: ClaimInput; start: number; end: number }[] {
  const results: { claim: ClaimInput; start: number; end: number }[] = []
  for (const claim of claims) {
    const idx = text.indexOf(claim.sentence)
    if (idx !== -1) {
      results.push({ claim, start: idx, end: idx + claim.sentence.length })
    }
  }
  return results.sort((a, b) => a.start - b.start)
}

// Build body text with [N] markers inserted after each claim sentence
function buildBodyText(text: string, positions: { claim: ClaimInput; start: number; end: number; refNums: number[] }[]): string {
  if (positions.length === 0) return text

  // Build from right to left to preserve indices
  const sorted = [...positions].sort((a, b) => b.start - a.start)
  let result = text
  for (const pos of sorted) {
    const marker = pos.refNums.length === 1 ? `[${pos.refNums[0]}]` : `[${pos.refNums.join(",")}]`
    result = result.slice(0, pos.end) + marker + result.slice(pos.end)
  }
  return result
}

export async function citeText(
  text: string,
  claims: ClaimInput[],
  limit: number = 2,
): Promise<CiteTextResult> {
  // 1. Search for each claim with progressive refinement
  const claimMatches: ClaimMatch[] = []
  for (const claim of claims) {
    const papers = await searchForClaim(claim, limit)
    claimMatches.push({ claim, papers })
  }

  // 2. Global deduplication by DOI
  const allPapers: PaperResult[] = []
  for (const cm of claimMatches) {
    allPapers.push(...cm.papers)
  }
  const uniquePapers = deduplicate(allPapers)

  // 3. Assign papers to claims (best match first)
  const positions = findClaimPositions(text, claims)
  const claimRefMap: Map<string, number[]> = new Map()

  for (const cm of claimMatches) {
    const matchedPapers = cm.papers.filter(p => uniquePapers.includes(p))
    const refNums: number[] = []
    for (const paper of matchedPapers) {
      const globalIdx = uniquePapers.indexOf(paper)
      if (globalIdx !== -1 && !refNums.includes(globalIdx + 1)) {
        refNums.push(globalIdx + 1)
      }
    }
    claimRefMap.set(cm.claim.sentence, refNums)
  }

  // 4. Build body text with markers
  const posWithRefs = positions.map(p => ({
    ...p,
    refNums: claimRefMap.get(p.claim.sentence) || [],
  }))
  const bodyText = buildBodyText(text, posWithRefs)

  // 5. Build reference list entries
  const references = uniquePapers.map(p => ({
    authors: p.authors,
    title: p.title,
    year: p.year ?? 0,
    venue: p.venue || "未知",
    doi: p.doi || undefined,
    url: p.url || (p.doi ? `https://doi.org/${p.doi}` : ""),
  }))

  // 6. Build table rows
  const tableRows = uniquePapers.map((p, i) => {
    const doiUrl = p.doi ? `https://doi.org/${p.doi}` : p.url || "无"
    const relatedClaim = claimMatches.find(cm =>
      cm.papers.some(pp => pp.doi === p.doi || pp.title === p.title)
    )
    const summary = relatedClaim ? relatedClaim.claim.sentence : ""
    return {
      index: i + 1,
      title: p.title,
      url: doiUrl,
      summary,
      description: "",
    }
  })

  return { bodyText, references, tableRows }
}

// Format the three-section report
export function formatCiteTextReport(result: CiteTextResult): string {
  if (result.references.length === 0) {
    return "未找到相关文献。请尝试调整论点描述或扩展搜索范围。"
  }

  // Part 1: Body text
  const body = `## 正文引用\n\n${result.bodyText}\n\n`

  // Part 2: References (Elsevier format)
  const refs = result.references
    .map((r, i) => formatElsevierRef({ ...r, doi: r.doi, volume: r.volume, issue: r.issue, pages: r.pages }, i + 1))
    .join("\n\n")
  const refSection = `## 参考文献\n\n${refs}\n\n`

  // Part 3: Citation info table
  const header = "| 引文序号 | 标题 | 网址 | 原文区域内容总结 | 引文说明内容 |"
  const sep = "|----------|------|------|------------------|--------------|"
  const rows = result.tableRows
    .map(r => `| [${r.index}] | ${r.title} | ${r.url} | ${r.summary} | ${r.description} |`)
    .join("\n")
  const tableSection = `## 引文说明\n\n${header}\n${sep}\n${rows}`

  return body + refSection + tableSection
}
