import { describe, it, afterEach } from "node:test"
import assert from "node:assert/strict"
import { searchAuthors, formatAuthorResults, AuthorResult } from "../author-search.js"

const originalFetch = globalThis.fetch

function stubFetch(impl: (url: string) => Promise<Response>) {
  globalThis.fetch = (async (input: any) => impl(String(input))) as typeof fetch
}

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), { status: 200 })
}

const s2Payload = {
  total: 2,
  data: [
    {
      authorId: "111",
      name: "Geoffrey Hinton",
      affiliations: ["University of Toronto", "Google"],
      paperCount: 300,
      citationCount: 500000,
      hIndex: 150,
      url: "https://www.semanticscholar.org/author/111",
    },
    {
      authorId: "222",
      name: "Yann LeCun",
      affiliations: [],
      paperCount: null,
      citationCount: 400000,
      hIndex: 120,
      url: "https://www.semanticscholar.org/author/222",
    },
  ],
}

const oaPayload = {
  results: [
    {
      id: "https://openalex.org/A123",
      display_name: "geoffrey hinton",
      works_count: 250,
      cited_by_count: 450000,
      summary_stats: { h_index: 140 },
      last_known_institutions: [
        { id: "https://openalex.org/I1", display_name: "University of Toronto" },
      ],
    },
  ],
}

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe("searchAuthors (s2)", () => {
  it("maps S2 author fields", async () => {
    stubFetch(async () => jsonResponse(s2Payload))
    const results = await searchAuthors("hinton", "s2", 10)
    assert.equal(results.length, 2)
    const r = results[0]
    assert.equal(r.name, "Geoffrey Hinton")
    assert.equal(r.affiliations, "University of Toronto; Google")
    assert.equal(r.paperCount, 300)
    assert.equal(r.citationCount, 500000)
    assert.equal(r.hIndex, 150)
    assert.equal(r.source, "Semantic Scholar")
    assert.equal(r.url, "https://www.semanticscholar.org/author/111")
    // null / 空数组字段透传
    assert.equal(results[1].paperCount, null)
    assert.equal(results[1].affiliations, "")
  })

  it("falls back to api url when S2 url missing", async () => {
    stubFetch(async () =>
      jsonResponse({ data: [{ authorId: "999", name: "No Url", affiliations: [] }] }),
    )
    const results = await searchAuthors("x", "s2", 10)
    assert.equal(results[0].url, "https://api.semanticscholar.org/author/999")
    assert.equal(results[0].hIndex, null)
  })
})

describe("searchAuthors (openalex)", () => {
  it("maps OA author fields incl. last_known_institutions", async () => {
    stubFetch(async () => jsonResponse(oaPayload))
    const results = await searchAuthors("hinton", "openalex", 10)
    assert.equal(results.length, 1)
    const r = results[0]
    assert.equal(r.name, "geoffrey hinton")
    assert.equal(r.affiliations, "University of Toronto")
    assert.equal(r.paperCount, 250)
    assert.equal(r.citationCount, 450000)
    assert.equal(r.hIndex, 140)
    assert.equal(r.source, "OpenAlex")
    assert.equal(r.url, "https://openalex.org/A123")
  })

  it("handles missing OA fields", async () => {
    stubFetch(async () =>
      jsonResponse({ results: [{ id: "https://openalex.org/A9", display_name: "Sparse Author" }] }),
    )
    const results = await searchAuthors("x", "openalex", 10)
    const r = results[0]
    assert.equal(r.affiliations, "")
    assert.equal(r.paperCount, null)
    assert.equal(r.citationCount, null)
    assert.equal(r.hIndex, null)
    assert.equal(r.url, "https://openalex.org/A9")
  })
})

describe("searchAuthors (all)", () => {
  it("dedups by lowercase name across sources and truncates to limit", async () => {
    stubFetch(async (url) => {
      if (url.includes("semanticscholar")) return jsonResponse(s2Payload)
      return jsonResponse(oaPayload)
    })
    // S2 "Geoffrey Hinton" 与 OA "geoffrey hinton" 视为同一人
    const results = await searchAuthors("hinton", "all", 10)
    assert.equal(results.length, 2)
    assert.equal(results[0].name, "Geoffrey Hinton")
    assert.equal(results[1].name, "Yann LeCun")

    const truncated = await searchAuthors("hinton", "all", 1)
    assert.equal(truncated.length, 1)
  })
})

describe("searchAuthors validation", () => {
  it("throws on empty query", async () => {
    await assert.rejects(searchAuthors("  ", "all", 10), /不能为空/)
  })

  it("throws on invalid source", async () => {
    await assert.rejects(searchAuthors("x", "cr" as any, 10), /不支持的数据源/)
  })

  it("clamps limit to 1-100", async () => {
    let seenUrl = ""
    stubFetch(async (url) => {
      seenUrl = url
      return jsonResponse({ data: [] })
    })
    await searchAuthors("x", "s2", 500)
    assert.ok(seenUrl.includes("limit=100"), `limit not clamped: ${seenUrl}`)
  })
})

describe("formatAuthorResults", () => {
  it("renders Chinese-labelled list with url on every entry", () => {
    const results: AuthorResult[] = [
      {
        name: "Geoffrey Hinton",
        affiliations: "University of Toronto",
        paperCount: 300,
        citationCount: 500000,
        hIndex: 150,
        source: "Semantic Scholar",
        url: "https://www.semanticscholar.org/author/111",
      },
    ]
    const out = formatAuthorResults(results)
    assert.ok(out.includes("1. Geoffrey Hinton"))
    assert.ok(out.includes("机构: University of Toronto"))
    assert.ok(out.includes("h指数: 150"))
    assert.ok(out.includes("URL: https://www.semanticscholar.org/author/111"))
  })

  it("empty array returns not-found message", () => {
    assert.equal(formatAuthorResults([]), "未找到相关作者。")
  })
})
