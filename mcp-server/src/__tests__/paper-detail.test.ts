import { describe, it, afterEach } from "node:test"
import assert from "node:assert/strict"
import { getPaperDetail, mapRelatedPaper, toS2PaperId } from "../paper-detail.js"

describe("mapRelatedPaper", () => {
  it("maps a fully-populated entry", () => {
    const p = mapRelatedPaper({
      paperId: "abc123",
      title: "Deep Learning",
      authors: [{ name: "Smith, J." }, { name: "Doe, A." }],
      year: 2024,
      externalIds: { DOI: "10.1234/dl" },
      url: "https://www.semanticscholar.org/paper/abc123",
      citationCount: 42,
    })
    assert.deepEqual(p, {
      title: "Deep Learning",
      authors: "Smith, J.; Doe, A.",
      year: 2024,
      doi: "10.1234/dl",
      url: "https://www.semanticscholar.org/paper/abc123",
      citationCount: 42,
    })
  })

  it("falls back to DOI url when url is missing", () => {
    const p = mapRelatedPaper({ title: "T", externalIds: { DOI: "10.1234/x" } })
    assert.equal(p.doi, "10.1234/x")
    assert.equal(p.url, "https://doi.org/10.1234/x")
  })

  it("falls back to S2 url when only paperId exists", () => {
    const p = mapRelatedPaper({ paperId: "abc123" })
    assert.equal(p.doi, null)
    assert.equal(p.url, "https://www.semanticscholar.org/paper/abc123")
  })

  it("tolerates missing externalIds and authors", () => {
    const p = mapRelatedPaper({ title: "Sparse", year: 2020 })
    assert.equal(p.authors, "")
    assert.equal(p.doi, null)
    assert.equal(p.url, "")
    assert.equal(p.citationCount, null)
  })

  it("tolerates an empty entry", () => {
    const p = mapRelatedPaper({})
    assert.deepEqual(p, {
      title: "",
      authors: "",
      year: null,
      doi: null,
      url: "",
      citationCount: null,
    })
  })

  it("keeps citationCount 0 instead of null", () => {
    assert.equal(mapRelatedPaper({ citationCount: 0 }).citationCount, 0)
  })
})

describe("toS2PaperId", () => {
  it("prefixes a bare DOI with DOI:", () => {
    assert.equal(toS2PaperId("10.1234/test"), "DOI:10.1234/test")
  })

  it("leaves an already-prefixed DOI untouched", () => {
    assert.equal(toS2PaperId("DOI:10.1234/test"), "DOI:10.1234/test")
  })

  it("leaves an S2 paper id untouched", () => {
    const id = "649def34f8be52c8b66281af98ae884c09aef38b"
    assert.equal(toS2PaperId(id), id)
  })

  it("trims surrounding whitespace", () => {
    assert.equal(toS2PaperId("  10.1234/test  "), "DOI:10.1234/test")
  })
})

describe("getPaperDetail（fetch 打桩）", () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it("Crossref 摘要清洗 JATS 标签；无实质补充时省略「其他数据源补充信息」区块", async () => {
    globalThis.fetch = (async (url: any) => {
      const u = String(url)
      if (u.includes("semanticscholar")) return new Response("forbidden", { status: 403 })
      if (u.includes("openalex")) return new Response("{}", { status: 200 })
      // Crossref
      return new Response(
        JSON.stringify({
          message: {
            title: ["Test Paper"],
            DOI: "10.1234/test",
            abstract:
              "<jats:p>Cleaned abstract text that is definitely longer than fifty characters for best-selection.</jats:p>",
            "container-title": ["Nature"],
            "is-referenced-by-count": 5,
          },
        }),
        { status: 200 },
      )
    }) as typeof fetch

    const result = await getPaperDetail("10.1234/test")
    assert.match(result.text, /Cleaned abstract text/)
    assert.ok(!result.text.includes("jats"), `JATS 标签残留: ${result.text}`)
    assert.ok(
      !result.text.includes("其他数据源补充信息"),
      `空补充区块不应出现: ${result.text}`,
    )
  })
})
