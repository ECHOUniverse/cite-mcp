import { PaperResult, searchSemanticScholar, searchOpenAlex, searchCrossref, deduplicate } from "./paper-search.js"
import { formatElsevierRef } from "./citation.js"
import { stagger } from "./retry.js"
import { paperKey } from "./utils.js"

export interface ClaimInput {
  sentence: string
  context?: string
}

export interface ClaimMatch {
  claim: ClaimInput
  papers: PaperResult[]
}

export interface CiteTextResult {
  bodyText: string
  references: { authors: string; title: string; year: number | null; venue: string; doi?: string; url: string; volume?: string; issue?: string; pages?: string }[]
  tableRows: { index: number; title: string; url: string; summary: string; description: string }[]
  /** 每个论点命中的参考文献编号（1 起，与 references 下标对应），按输入 claims 顺序 */
  claims: { sentence: string; refNums: number[] }[]
}

// Extract key terms from sentence: take meaningful words (>3 chars)
function extractKeyTerms(sentence: string, context: string = ""): string {
  const combined = `${sentence} ${context}`
  const words = combined.split(/[\s,;:.!?()]+/).filter(w => w.length > 3)
  // Remove duplicates
  return [...new Set(words)].slice(0, 8).join(" ")
}

// Progressive query strategies: context-first for precision
function buildQueries(sentence: string, context: string): string[] {
  const queries: string[] = []

  // Level 1: context alone (most specific—AI-extracted keywords)
  if (context && context.length > 5) {
    queries.push(context)
  } else {
    // No context: use sentence directly
    queries.push(sentence)
  }

  // Level 2: sentence + context (broader recall)
  if (context && context.length > 5) {
    queries.push(`${sentence} ${context}`)
  } else {
    queries.push(sentence.slice(0, 80))
  }

  // Level 3: key terms only (last resort)
  queries.push(extractKeyTerms(sentence, context))

  return queries
}

// S2-first search: S2 has best academic paper indexing quality.
// Only fall back to OA+CR when S2 results are insufficient.
async function searchAllSources(query: string, limit: number, useSemantic: boolean = false, s2Only: boolean = false): Promise<PaperResult[]> {
  // 1. Always search S2 first — highest precision for academic papers
  const s2 = await searchSemanticScholar(query, limit).catch(() => [] as PaperResult[])

  // If S2 results are sufficient or s2Only flag is set, skip OA/CR
  if (s2Only || s2.length >= limit) {
    return s2
  }

  // 2. S2 insufficient — supplement with OA + CR
  const [oa, cr] = await Promise.allSettled(
    stagger([
      () => searchOpenAlex(query, limit, useSemantic ? "semantic" : "keyword"),
      () => searchCrossref(query, limit),
    ]),
  )

  const supplements: PaperResult[] = []
  if (oa.status === "fulfilled") supplements.push(...oa.value)
  if (cr.status === "fulfilled") supplements.push(...cr.value)

  // S2 results first (higher quality), OA/CR supplements appended
  return deduplicate([...s2, ...supplements])
}

// Search for a claim with progressive query refinement
async function searchForClaim(claim: ClaimInput, limit: number): Promise<PaperResult[]> {
  const queries = buildQueries(claim.sentence, claim.context || "")
  let allFound: PaperResult[] = []
  const seen = new Set<string>()
  let queryIndex = 0

  for (const query of queries) {
    if (allFound.length >= limit) break

    // L1 (most precise): S2 only for highest match quality
    // L2+: S2-first with OA/CR supplement, semantic for first 2 levels
    const s2Only = queryIndex === 0
    const useSemantic = queryIndex < 2
    const papers = await searchAllSources(query, limit * 2, useSemantic, s2Only)
    queryIndex++
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

// Build the three-section report data from search results (pure function, unit-testable)
export function buildCiteTextResult(text: string, claimMatches: ClaimMatch[]): CiteTextResult {
  // 1. Global deduplication
  const allPapers: PaperResult[] = []
  for (const cm of claimMatches) {
    allPapers.push(...cm.papers)
  }
  const uniquePapers = deduplicate(allPapers)

  // 2. Assign papers to claims by stable paper key — each claim's search produces
  //    distinct object instances, so identity comparison would drop shared papers
  const keyToIndex = new Map<string, number>()
  uniquePapers.forEach((p, i) => {
    const key = paperKey(p)
    if (key && !keyToIndex.has(key)) keyToIndex.set(key, i)
  })

  const positions = findClaimPositions(text, claimMatches.map(cm => cm.claim))
  const claimRefMap: Map<string, number[]> = new Map()

  for (const cm of claimMatches) {
    const refNums: number[] = []
    for (const paper of cm.papers) {
      const globalIdx = keyToIndex.get(paperKey(paper))
      if (globalIdx !== undefined && !refNums.includes(globalIdx + 1)) {
        refNums.push(globalIdx + 1)
      }
    }
    claimRefMap.set(cm.claim.sentence, refNums)
  }

  // 3. Build body text with markers
  const posWithRefs = positions.map(p => ({
    ...p,
    refNums: claimRefMap.get(p.claim.sentence) || [],
  }))
  const bodyText = buildBodyText(text, posWithRefs)

  // 4. Build reference list entries — year stays null when unknown (no forced 0)
  const references = uniquePapers.map(p => ({
    authors: p.authors,
    title: p.title,
    year: p.year,
    venue: p.venue || "未知",
    doi: p.doi || undefined,
    url: p.url || (p.doi ? `https://doi.org/${p.doi}` : ""),
  }))

  // 5. Build table rows — attribute each paper to the claim that matched it.
  //    Match by paperKey; empty keys never match, so DOI-less/title-less papers
  //    are never cross-attributed via null === null.
  const tableRows = uniquePapers.map((p, i) => {
    const doiUrl = p.doi ? `https://doi.org/${p.doi}` : p.url || "无"
    const key = paperKey(p)
    const relatedClaim = key
      ? claimMatches.find(cm => cm.papers.some(pp => paperKey(pp) === key))
      : undefined
    const summary = relatedClaim ? relatedClaim.claim.sentence : ""
    return {
      index: i + 1,
      title: p.title,
      url: doiUrl,
      summary,
      description: "",
    }
  })

  return {
    bodyText,
    references,
    tableRows,
    claims: claimMatches.map((cm) => ({
      sentence: cm.claim.sentence,
      refNums: claimRefMap.get(cm.claim.sentence) || [],
    })),
  }
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

  // 2. Build report data (dedup → ref numbers → body text → references → table)
  return buildCiteTextResult(text, claimMatches)
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
