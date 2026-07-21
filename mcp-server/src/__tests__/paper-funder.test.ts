import { describe, it, afterEach } from "node:test"
import assert from "node:assert/strict"
import { searchFunderWorks, formatFunderResult, FunderResult } from "../paper-funder.js"

const originalFetch = globalThis.fetch

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), { status: 200 })
}

const funderSearchPayload = {
  message: {
    items: [
      {
        id: "501100001711",
        name: "Swiss National Science Foundation",
        uri: "https://doi.org/10.13039/501100001711",
      },
    ],
  },
}

const worksPayload = {
  message: {
    items: [
      {
        DOI: "10.1007/abc",
        title: ["Losing Face on Facebook"],
        author: [{ given: "Carmen", family: "Maíz-Arévalo" }],
        published: { "date-parts": [[2018, 9, 30]] },
        "container-title": ["Analyzing Digital Discourse"],
        type: "book-chapter",
      },
      {
        // 无 DOI：回退到 CR 的 URL 字段
        title: ["No DOI Work"],
        author: [],
        published: { "date-parts": [[2020]] },
        type: "journal-article",
        URL: "https://api.crossref.org/works/no-doi",
      },
      {
        // 字段稀疏：无标题、无 published、无标识
        type: "dataset",
      },
    ],
  },
}

/** 按 URL 路由：/works? → 成果列表；其余 → 资助方名称解析 */
function stubCr(opts: { works?: unknown; funders?: unknown; seen?: string[] }) {
  globalThis.fetch = (async (input: any) => {
    const url = String(input)
    opts.seen?.push(url)
    if (url.includes("/works?")) return jsonResponse(opts.works ?? worksPayload)
    return jsonResponse(opts.funders ?? funderSearchPayload)
  }) as typeof fetch
}

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe("searchFunderWorks validation", () => {
  it("throws when neither funderId nor funderName given", async () => {
    await assert.rejects(searchFunderWorks({}), /必须且只能提供其一/)
  })

  it("throws when both funderId and funderName given", async () => {
    await assert.rejects(
      searchFunderWorks({ funderId: "123", funderName: "NSF" }),
      /必须且只能提供其一/,
    )
  })
})

describe("searchFunderWorks", () => {
  it("resolves funderName then fetches works", async () => {
    stubCr({})
    const r = await searchFunderWorks({ funderName: "swiss national science foundation" })
    assert.equal(r.funderId, "501100001711")
    assert.equal(r.funderName, "Swiss National Science Foundation")
    assert.equal(r.works.length, 3)
  })

  it("maps work fields: year from date-parts, authors, doi url, type", async () => {
    stubCr({})
    const r = await searchFunderWorks({ funderId: "501100001711" })
    const w = r.works[0]
    assert.equal(w.title, "Losing Face on Facebook")
    assert.equal(w.authors, "Maíz-Arévalo, Carmen")
    assert.equal(w.year, 2018)
    assert.equal(w.doi, "10.1007/abc")
    assert.equal(w.url, "https://doi.org/10.1007/abc")
    assert.equal(w.type, "book-chapter")
    // 直接传 funderId 时不做名称解析，名称回退为 id
    assert.equal(r.funderName, "501100001711")
  })

  it("falls back to CR URL when DOI missing; sparse item stays safe", async () => {
    stubCr({})
    const r = await searchFunderWorks({ funderId: "501100001711" })
    const noDoi = r.works[1]
    assert.equal(noDoi.doi, null)
    assert.equal(noDoi.url, "https://api.crossref.org/works/no-doi")
    assert.equal(noDoi.year, 2020)
    const sparse = r.works[2]
    assert.equal(sparse.title, "")
    assert.equal(sparse.year, null)
    assert.equal(sparse.doi, null)
    assert.equal(sparse.url, "")
  })

  it("throws when funderName resolves to nothing", async () => {
    stubCr({ funders: { message: { items: [] } } })
    await assert.rejects(searchFunderWorks({ funderName: "nonexistent funder xyz" }), /未找到名为/)
  })

  it("defaults limit to 20 and clamps to 100", async () => {
    const seen: string[] = []
    stubCr({ seen })
    await searchFunderWorks({ funderId: "123" })
    assert.ok(seen[0].includes("rows=20"), `default rows: ${seen[0]}`)
    seen.length = 0
    await searchFunderWorks({ funderId: "123", limit: 500 })
    assert.ok(seen[0].includes("rows=100"), `clamped rows: ${seen[0]}`)
  })
})

describe("formatFunderResult", () => {
  it("renders funder info plus works list", () => {
    const r: FunderResult = {
      funderName: "Swiss National Science Foundation",
      funderId: "501100001711",
      works: [
        {
          title: "Some Work",
          authors: "Doe, John",
          year: 2021,
          doi: "10.1/x",
          url: "https://doi.org/10.1/x",
          type: "journal-article",
        },
      ],
    }
    const out = formatFunderResult(r)
    assert.ok(out.includes("资助方: Swiss National Science Foundation"))
    assert.ok(out.includes("资助方ID: 501100001711"))
    assert.ok(out.includes("成果数: 1"))
    assert.ok(out.includes("1. Some Work"))
    assert.ok(out.includes("URL: https://doi.org/10.1/x"))
  })

  it("empty works renders not-found line", () => {
    const out = formatFunderResult({ funderName: "X", funderId: "1", works: [] })
    assert.ok(out.includes("未找到该资助方资助的研究成果。"))
  })
})
