// outputSchema + structuredContent（roadmap 3.2）：每个工具的 ListTools outputSchema
// 与 CallTool structuredContent 的映射器集中在此，保证二者严格一致。
// 约定：schema 均 additionalProperties:false；可能缺失的数字用 ["number","null"]；
// 仅在有非空值时才输出的字段（abstract/tldr/doi 等）不列入 required。

import type { Tool } from "@modelcontextprotocol/sdk/types.js"
import type { PaperResult, SearchPapersResult } from "./paper-search.js"
import type { PaperRecommendationsResult, RecommendedPaper } from "./paper-recommendations.js"
import type { PaperDetail, PaperDetailUnifiedResult, RelatedPaper } from "./paper-detail.js"
import type { AnalyzePapersResult, GroupByItem } from "./paper-analysis.js"
import type { CiteTextResult } from "./cite-text.js"
import type { AuthorResult } from "./author-search.js"
import type { TopicResult } from "./topic-classify.js"
import type { FunderResult } from "./paper-funder.js"

type OutputSchema = NonNullable<Tool["outputSchema"]>

// -- 共享子 schema --

const searchPaperSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    authors: { type: "string" },
    year: { type: ["number", "null"] },
    venue: { type: ["string", "null"] },
    doi: { type: ["string", "null"] },
    url: { type: "string" },
    citationCount: { type: ["number", "null"] },
    source: { type: "string" },
    abstract: { type: "string" },
    tldr: { type: "string" },
  },
  required: ["title", "authors", "year", "venue", "doi", "url", "citationCount", "source"],
  additionalProperties: false,
}

const recommendedPaperSchema = {
  type: "object",
  properties: {
    paperId: { type: "string" },
    title: { type: "string" },
    authors: { type: "string" },
    year: { type: ["number", "null"] },
    venue: { type: ["string", "null"] },
    doi: { type: ["string", "null"] },
    url: { type: "string" },
    citationCount: { type: ["number", "null"] },
    abstract: { type: "string" },
    tldr: { type: "string" },
  },
  required: ["paperId", "title", "authors", "year", "venue", "doi", "url", "citationCount"],
  additionalProperties: false,
}

const detailPaperSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    authors: { type: "string" },
    year: { type: ["number", "null"] },
    venue: { type: ["string", "null"] },
    doi: { type: ["string", "null"] },
    url: { type: "string" },
    citationCount: { type: ["number", "null"] },
    source: { type: "string" },
    hasCitationStyles: { type: "boolean" },
    abstract: { type: "string" },
    tldr: { type: "string" },
  },
  required: ["title", "authors", "year", "venue", "doi", "url", "citationCount", "source", "hasCitationStyles"],
  additionalProperties: false,
}

const relatedPaperSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    authors: { type: "string" },
    year: { type: ["number", "null"] },
    doi: { type: ["string", "null"] },
    url: { type: "string" },
    citationCount: { type: ["number", "null"] },
  },
  required: ["title", "authors", "year", "doi", "url", "citationCount"],
  additionalProperties: false,
}

const groupByItemSchema = {
  type: "object",
  properties: {
    key: { type: "string" },
    key_display_name: { type: "string" },
    count: { type: "number" },
  },
  required: ["key", "count"],
  additionalProperties: false,
}

// -- 共享映射器 --

function mapSearchPaper(p: PaperResult): Record<string, unknown> {
  const out: Record<string, unknown> = {
    title: p.title,
    authors: p.authors,
    year: p.year,
    venue: p.venue,
    doi: p.doi,
    url: p.url,
    citationCount: p.citationCount,
    source: p.source,
  }
  if (p.abstract) out.abstract = p.abstract
  if (p.tldr) out.tldr = p.tldr
  return out
}

function mapRecommendedPaper(p: RecommendedPaper): Record<string, unknown> {
  const out: Record<string, unknown> = {
    paperId: p.paperId,
    title: p.title,
    authors: p.authors,
    year: p.year,
    venue: p.venue,
    doi: p.doi,
    url: p.url,
    citationCount: p.citationCount,
  }
  if (p.abstract) out.abstract = p.abstract
  if (p.tldr) out.tldr = p.tldr
  return out
}

function mapDetailPaper(d: PaperDetail): Record<string, unknown> {
  const out: Record<string, unknown> = {
    title: d.title,
    authors: d.authors,
    year: d.year,
    venue: d.venue,
    doi: d.doi,
    url: d.url,
    citationCount: d.citationCount,
    source: d.source,
    hasCitationStyles: Boolean(d.citationStyles && Object.keys(d.citationStyles).length > 0),
  }
  if (d.abstract) out.abstract = d.abstract
  if (d.tldr) out.tldr = d.tldr
  return out
}

function mapRelatedPaperItem(p: RelatedPaper): Record<string, unknown> {
  return {
    title: p.title,
    authors: p.authors,
    year: p.year,
    doi: p.doi,
    url: p.url,
    citationCount: p.citationCount,
  }
}

function mapRelatedList(list: RelatedPaper[] | null | undefined): Record<string, unknown>[] | null | undefined {
  if (list === undefined) return undefined
  if (list === null) return null
  return list.map(mapRelatedPaperItem)
}

function mapGroupByItem(g: GroupByItem): Record<string, unknown> {
  const out: Record<string, unknown> = { key: g.key, count: g.count }
  if (g.key_display_name !== undefined) out.key_display_name = g.key_display_name
  return out
}

// -- 1. paper_search --

export const paperSearchOutputSchema: OutputSchema = {
  type: "object",
  properties: {
    papers: { type: "array", items: searchPaperSchema },
    count: { type: "number" },
    source: { type: "string" },
  },
  required: ["papers", "count", "source"],
  additionalProperties: false,
}

export function buildPaperSearchStructured(result: SearchPapersResult, source: string): Record<string, unknown> {
  return { papers: result.papers.map(mapSearchPaper), count: result.papers.length, source }
}

// -- 2. paper_detail --

export const paperDetailOutputSchema: OutputSchema = {
  type: "object",
  properties: {
    results: { type: "array", items: detailPaperSchema },
    citations: { type: ["array", "null"], items: relatedPaperSchema },
    references: { type: ["array", "null"], items: relatedPaperSchema },
    relatedByPaperId: {
      type: "object",
      additionalProperties: {
        type: "object",
        properties: {
          citations: { type: ["array", "null"], items: relatedPaperSchema },
          references: { type: ["array", "null"], items: relatedPaperSchema },
        },
        additionalProperties: false,
      },
    },
  },
  required: ["results"],
  additionalProperties: false,
}

export function buildPaperDetailStructured(result: PaperDetailUnifiedResult): Record<string, unknown> {
  const out: Record<string, unknown> = { results: result.results.map(mapDetailPaper) }
  const citations = mapRelatedList(result.citations)
  if (citations !== undefined) out.citations = citations
  const references = mapRelatedList(result.references)
  if (references !== undefined) out.references = references
  if (result.relatedByPaperId) {
    const byId: Record<string, unknown> = {}
    for (const [id, rel] of Object.entries(result.relatedByPaperId)) {
      const entry: Record<string, unknown> = {}
      const c = mapRelatedList(rel.citations)
      if (c !== undefined) entry.citations = c
      const r = mapRelatedList(rel.references)
      if (r !== undefined) entry.references = r
      byId[id] = entry
    }
    out.relatedByPaperId = byId
  }
  return out
}

// -- 3. paper_recommendations --

export const paperRecommendationsOutputSchema: OutputSchema = {
  type: "object",
  properties: {
    papers: { type: "array", items: recommendedPaperSchema },
    count: { type: "number" },
    paperId: { type: "string" },
    from: { type: "string" },
  },
  required: ["papers", "count", "paperId", "from"],
  additionalProperties: false,
}

export function buildPaperRecommendationsStructured(
  result: PaperRecommendationsResult,
  paperId: string,
  from: string,
): Record<string, unknown> {
  return { papers: result.papers.map(mapRecommendedPaper), count: result.papers.length, paperId, from }
}

// -- 4. citation（数据在 handler 作用域内直接组装，无需模块映射器） --

export const citationOutputSchema: OutputSchema = {
  type: "object",
  properties: {
    citations: { type: "array", items: { type: "string" } },
    style: { type: "string" },
    source: { type: "string" },
    mode: { type: "string", enum: ["single", "report"] },
  },
  required: ["citations", "style", "source", "mode"],
  additionalProperties: false,
}

// -- 5. paper_analysis --

export const paperAnalysisOutputSchema: OutputSchema = {
  type: "object",
  properties: {
    papers: { type: "array", items: searchPaperSchema },
    count: { type: "number" },
    trends: {
      type: "object",
      properties: {
        years: { type: "array", items: groupByItemSchema },
        types: { type: "array", items: groupByItemSchema },
        topics: { type: "array", items: groupByItemSchema },
      },
      required: ["years", "types", "topics"],
      additionalProperties: false,
    },
  },
  required: ["papers", "count", "trends"],
  additionalProperties: false,
}

export function buildPaperAnalysisStructured(result: AnalyzePapersResult): Record<string, unknown> {
  return {
    papers: result.papers.map(mapSearchPaper),
    count: result.papers.length,
    trends: {
      years: result.trends.years.map(mapGroupByItem),
      types: result.trends.types.map(mapGroupByItem),
      topics: result.trends.topics.map(mapGroupByItem),
    },
  }
}

// -- 6. cite_text --

export const citeTextOutputSchema: OutputSchema = {
  type: "object",
  properties: {
    references: {
      type: "array",
      items: {
        type: "object",
        properties: {
          authors: { type: "string" },
          title: { type: "string" },
          year: { type: ["number", "null"] },
          venue: { type: "string" },
          doi: { type: "string" },
          url: { type: "string" },
        },
        required: ["authors", "title", "year", "venue", "url"],
        additionalProperties: false,
      },
    },
    claims: {
      type: "array",
      items: {
        type: "object",
        properties: {
          sentence: { type: "string" },
          refNums: { type: "array", items: { type: "number" } },
        },
        required: ["sentence", "refNums"],
        additionalProperties: false,
      },
    },
    count: { type: "number" },
  },
  required: ["references", "claims", "count"],
  additionalProperties: false,
}

export function buildCiteTextStructured(result: CiteTextResult): Record<string, unknown> {
  return {
    references: result.references.map((r) => {
      const out: Record<string, unknown> = {
        authors: r.authors,
        title: r.title,
        year: r.year,
        venue: r.venue,
        url: r.url,
      }
      if (r.doi) out.doi = r.doi
      return out
    }),
    claims: result.claims.map((c) => ({ sentence: c.sentence, refNums: c.refNums })),
    count: result.references.length,
  }
}

// -- 7. author_search --

export const authorSearchOutputSchema: OutputSchema = {
  type: "object",
  properties: {
    authors: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          affiliations: { type: "string" },
          paperCount: { type: ["number", "null"] },
          citationCount: { type: ["number", "null"] },
          hIndex: { type: ["number", "null"] },
          source: { type: "string" },
          url: { type: "string" },
        },
        required: ["name", "affiliations", "paperCount", "citationCount", "hIndex", "source", "url"],
        additionalProperties: false,
      },
    },
    count: { type: "number" },
  },
  required: ["authors", "count"],
  additionalProperties: false,
}

export function buildAuthorSearchStructured(results: AuthorResult[]): Record<string, unknown> {
  return {
    authors: results.map((a) => ({
      name: a.name,
      affiliations: a.affiliations,
      paperCount: a.paperCount,
      citationCount: a.citationCount,
      hIndex: a.hIndex,
      source: a.source,
      url: a.url,
    })),
    count: results.length,
  }
}

// -- 8. topic_classify --

export const topicClassifyOutputSchema: OutputSchema = {
  type: "object",
  properties: {
    topics: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          levelName: { type: "string" },
          worksCount: { type: ["number", "null"] },
          url: { type: "string" },
        },
        required: ["name", "levelName", "worksCount", "url"],
        additionalProperties: false,
      },
    },
    count: { type: "number" },
    level: { type: "number" },
  },
  required: ["topics", "count", "level"],
  additionalProperties: false,
}

export function buildTopicClassifyStructured(results: TopicResult[], level: number): Record<string, unknown> {
  return {
    topics: results.map((t) => ({
      name: t.name,
      levelName: t.levelName,
      worksCount: t.worksCount,
      url: t.url,
    })),
    count: results.length,
    level,
  }
}

// -- 9. paper_funder --

export const paperFunderOutputSchema: OutputSchema = {
  type: "object",
  properties: {
    funder: {
      type: "object",
      properties: {
        name: { type: "string" },
        id: { type: "string" },
      },
      required: ["name", "id"],
      additionalProperties: false,
    },
    works: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          authors: { type: "string" },
          year: { type: ["number", "null"] },
          doi: { type: ["string", "null"] },
          url: { type: "string" },
          type: { type: "string" },
        },
        required: ["title", "authors", "year", "doi", "url", "type"],
        additionalProperties: false,
      },
    },
    count: { type: "number" },
  },
  required: ["funder", "works", "count"],
  additionalProperties: false,
}

export function buildPaperFunderStructured(result: FunderResult): Record<string, unknown> {
  return {
    funder: { name: result.funderName, id: result.funderId },
    works: result.works.map((w) => ({
      title: w.title,
      authors: w.authors,
      year: w.year,
      doi: w.doi,
      url: w.url,
      type: w.type,
    })),
    count: result.works.length,
  }
}
