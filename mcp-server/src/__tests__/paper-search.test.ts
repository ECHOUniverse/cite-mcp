import { describe, it, afterEach } from "node:test"
import assert from "node:assert/strict"
import { deduplicate, normalizeOpenAlexAuthorId, searchPapers, PaperResult } from "../paper-search.js"

function makePaper(overrides: Partial<PaperResult> = {}): PaperResult {
  return {
    title: "Default Title",
    authors: "Author",
    year: 2024,
    abstract: "Abstract",
    doi: null,
    url: "https://example.com",
    source: "Test",
    citationCount: null,
    venue: null,
    ...overrides,
  }
}

describe("deduplicate", () => {
  it("empty array returns empty", () => {
    assert.deepEqual(deduplicate([]), [])
  })

  it("no duplicates keeps all", () => {
    const papers = [
      makePaper({ title: "A", doi: "10.1" }),
      makePaper({ title: "B", doi: "10.2" }),
    ]
    assert.equal(deduplicate(papers).length, 2)
  })

  it("same DOI removes duplicate", () => {
    const papers = [
      makePaper({ title: "First", doi: "10.1234/abc" }),
      makePaper({ title: "Duplicate", doi: "10.1234/abc" }),
      makePaper({ title: "Third", doi: "10.5678/xyz" }),
    ]
    const result = deduplicate(papers)
    assert.equal(result.length, 2)
    assert.equal(result[0].title, "First")
  })

  it("same title:year removes duplicate when no DOI", () => {
    const papers = [
      makePaper({ title: "Same Title", year: 2024 }),
      makePaper({ title: "Same Title", year: 2024 }),
    ]
    assert.equal(deduplicate(papers).length, 1)
  })

  it("case insensitive DOI match", () => {
    const papers = [
      makePaper({ title: "A", doi: "10.1234/ABCD" }),
      makePaper({ title: "B", doi: "10.1234/abcd" }),
    ]
    assert.equal(deduplicate(papers).length, 1)
  })

  it("different titles with same year kept when no DOI", () => {
    const papers = [
      makePaper({ title: "Title A", year: 2024 }),
      makePaper({ title: "Title B", year: 2024 }),
    ]
    assert.equal(deduplicate(papers).length, 2)
  })

  it("DOI takes precedence over title:year for dedup key", () => {
    const papers = [
      makePaper({ title: "Title A", doi: "10.1" }),
      makePaper({ title: "Title A", year: 2024 }),
    ]
    // Second has no DOI, uses "title:year" key which won't match "doi:10.1"
    assert.equal(deduplicate(papers).length, 2)
  })
})

describe("normalizeOpenAlexAuthorId", () => {
  it("接受短 ID", () => {
    assert.equal(normalizeOpenAlexAuthorId("A5086183426"), "A5086183426")
  })

  it("接受完整 OpenAlex URL", () => {
    assert.equal(normalizeOpenAlexAuthorId("https://openalex.org/A5086183426"), "A5086183426")
  })

  it("小写 id 归一化为大写", () => {
    assert.equal(normalizeOpenAlexAuthorId("a5086183426"), "A5086183426")
  })

  it("非法输入返回 null", () => {
    assert.equal(normalizeOpenAlexAuthorId("W123"), null)
    assert.equal(normalizeOpenAlexAuthorId(""), null)
    assert.equal(normalizeOpenAlexAuthorId("https://example.com/A1"), null)
  })
})

describe("searchPapers 错误处理与作者过滤", () => {
  const originalFetch = globalThis.fetch

  function stubFetch(impl: (url: string) => Promise<Response>) {
    globalThis.fetch = (async (url: any) => impl(String(url))) as typeof fetch
  }

  const OA_JSON = JSON.stringify({
    results: [{ id: "https://openalex.org/W1", title: "OA Paper", doi: "https://doi.org/10.1/oa" }],
  })
  const CR_JSON = JSON.stringify({
    message: { items: [{ title: ["CR Paper"], DOI: "10.1/cr", URL: "https://doi.org/10.1/cr" }] },
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it("指定 source=s2 且请求失败时抛错，不降级为「未找到」", async () => {
    stubFetch(async () => new Response("forbidden", { status: 403 }))
    await assert.rejects(searchPapers("anything", "", 5, "s2"), /Semantic Scholar 请求失败: HTTP 403/)
  })

  it("source=all 时单源失败在结果末尾附数据源可用性说明", async () => {
    stubFetch(async (url) => {
      if (url.includes("semanticscholar")) return new Response("forbidden", { status: 403 })
      if (url.includes("openalex")) return new Response(OA_JSON, { status: 200 })
      return new Response(CR_JSON, { status: 200 })
    })
    const result = await searchPapers("perovskite", "", 5, "all")
    assert.equal(result.papers.length, 2)
    assert.match(result.text, /数据源可用性说明/)
    assert.match(result.text, /Semantic Scholar: Semantic Scholar 请求失败: HTTP 403/)
  })

  it("authorId 过滤走 OpenAlex 并带 filter 参数，空 query 时按被引排序", async () => {
    const urls: string[] = []
    stubFetch(async (url) => {
      urls.push(url)
      return new Response(OA_JSON, { status: 200 })
    })
    const result = await searchPapers("", "", 5, "all", "A5086183426")
    assert.equal(urls.length, 1)
    const req = new URL(urls[0])
    assert.ok(req.host.includes("openalex"))
    assert.equal(req.searchParams.get("filter"), "author.id:A5086183426")
    assert.equal(req.searchParams.get("sort"), "cited_by_count:desc")
    assert.equal(req.searchParams.get("search"), null)
    assert.match(result.text, /^作者过滤: OpenAlex author\.id=A5086183426/)
    assert.equal(result.papers.length, 1)
  })

  it("authorId + query 时保留关键词搜索且不强加排序", async () => {
    const urls: string[] = []
    stubFetch(async (url) => {
      urls.push(url)
      return new Response(OA_JSON, { status: 200 })
    })
    await searchPapers("perovskite", "", 5, "all", "A5086183426")
    const req = new URL(urls[0])
    assert.equal(req.searchParams.get("filter"), "author.id:A5086183426")
    assert.equal(req.searchParams.get("search"), "perovskite")
    assert.equal(req.searchParams.get("sort"), null)
  })
})
