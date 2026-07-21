import { describe, it, afterEach } from "node:test"
import assert from "node:assert/strict"
import { formatCitation, formatCitationReport, formatElsevierAuthors, formatElsevierRef, formatCitationFromCrossref, resolvePages } from "../citation.js"

describe("resolvePages", () => {
  it("pages 优先，忽略 first/last", () => {
    assert.equal(resolvePages("100-120", "100", "120"), "100-120")
  })

  it("first_page + last_page 组合为区间", () => {
    assert.equal(resolvePages(undefined, "100", "120"), "100-120")
  })

  it("仅 first_page 时返回单页", () => {
    assert.equal(resolvePages(undefined, "100"), "100")
  })

  it("first_page 与 last_page 相同返回单页", () => {
    assert.equal(resolvePages(undefined, "100", "100"), "100")
  })

  it("全部缺省返回 undefined", () => {
    assert.equal(resolvePages(), undefined)
  })
})

describe("formatCitation", () => {
  const base = { authors: "Smith, J.; Doe, A.", title: "Test Paper", year: 2024, venue: "Nature" }

  it("APA format with DOI", async () => {
    const result = await formatCitation({ ...base, doi: "10.1234/test", style: "apa" })
    assert.match(result, /Smith, J.; Doe, A\. \(2024\)/)
    assert.match(result, /doi\.org\/10\.1234\/test/)
  })

  it("APA suppresses extra period when title ends with !", async () => {
    const result = await formatCitation({ ...base, title: "Big News!", style: "apa" })
    assert.ok(!result.includes("!."), `unexpected '!.': ${result}`)
  })

  it("MLA9 format with volume issue pages", async () => {
    const result = await formatCitation({ ...base, volume: "10", issue: "2", pages: "100-120", style: "mla" })
    assert.match(result, /Doe, A\. "Test Paper\."/)
    assert.match(result, /Nature, vol\. 10, no\. 2, 2024, pp\. 100-120\./)
  })

  it("MLA collapses double period after authors", async () => {
    const result = await formatCitation({ ...base, style: "mla" })
    assert.ok(!result.includes("A.."), `unexpected double period: ${result}`)
  })

  it("MLA suppresses extra period when title ends with ?", async () => {
    const result = await formatCitation({ ...base, title: "What is AI?", style: "mla" })
    assert.match(result, /"What is AI\?"/)
    assert.ok(!result.includes("?."), `unexpected '?.': ${result}`)
  })

  it("GB/T 7714 format", async () => {
    const result = await formatCitation({ ...base, doi: "10.1234/test", style: "gb7714" })
    assert.match(result, /\[J\]/)
    assert.match(result, /DOI: 10\.1234\/test/)
  })

  it("GB/T 7714 order is 刊名, 年, 卷(期): 页码", async () => {
    const result = await formatCitation({ ...base, volume: "10", issue: "2", pages: "100-120", style: "gb7714" })
    assert.match(result, /Nature, 2024, 10\(2\): 100-120\./)
  })

  it("GB/T 7714 collapses double period after authors", async () => {
    const result = await formatCitation({ ...base, style: "gb7714" })
    assert.ok(!result.includes("A.."), `unexpected double period: ${result}`)
  })

  it("BibTeX format", async () => {
    const result = await formatCitation({ ...base, doi: "10.1234/test", volume: "1", style: "bibtex" })
    assert.match(result, /@article\{/)
    assert.match(result, /doi = \{10\.1234\/test\}/)
  })

  it("BibTeX joins authors with 'and'", async () => {
    const result = await formatCitation({ ...base, style: "bibtex" })
    assert.match(result, /author = \{Smith, J\. and Doe, A\.\}/)
  })

  it("BibTeX escapes & % _ in title and journal", async () => {
    const result = await formatCitation({ ...base, title: "A & B: 100% sure_x", venue: "J_Test & Co", style: "bibtex" })
    assert.match(result, /title = \{A \\& B: 100\\% sure\\_x\}/)
    assert.match(result, /journal = \{J\\_Test \\& Co\}/)
  })

  it("BibTeX converts page range dash to --", async () => {
    const result = await formatCitation({ ...base, pages: "100-120", style: "bibtex" })
    assert.match(result, /pages = \{100--120\}/)
  })

  it("BibTeX leaves existing page range -- untouched", async () => {
    const result = await formatCitation({ ...base, pages: "100--120", style: "bibtex" })
    assert.match(result, /pages = \{100--120\}/)
  })

  it("Elsevier single format", async () => {
    const result = await formatCitation({ ...base, doi: "10.1234/test", style: "elsevier" })
    assert.match(result, /^\[1\]/)
    assert.match(result, /doi\.org\/10\.1234\/test/)
  })

  it("missing DOI falls back to URL", async () => {
    const result = await formatCitation({ ...base, url: "https://example.com/paper", style: "apa" })
    assert.match(result, /example\.com\/paper/)
  })

  it("unsupported style returns error message", async () => {
    const result = await formatCitation({ ...base, style: "unsupported" as any })
    assert.match(result, /不支持的引文格式/)
  })

  it("default style is elsevier", async () => {
    const result = await formatCitation(base)
    assert.match(result, /^\[1\]/)
  })
})

describe("formatElsevierAuthors", () => {
  it("single author", () => {
    assert.equal(formatElsevierAuthors("Smith, J."), "Smith, J.")
  })

  it("two authors uses 'and'", () => {
    assert.equal(formatElsevierAuthors("Smith, J.; Doe, A."), "Smith, J. and Doe, A.")
  })

  it("three authors uses commas and 'and'", () => {
    assert.equal(formatElsevierAuthors("Smith, J.; Doe, A.; Lee, B."), "Smith, J., Doe, A., and Lee, B.")
  })

  it("empty string", () => {
    assert.equal(formatElsevierAuthors(""), "")
  })

  it("whitespace only", () => {
    assert.equal(formatElsevierAuthors("  ;  ; "), "")
  })
})

describe("formatElsevierRef", () => {
  it("basic reference with DOI", () => {
    const entry = { authors: "Smith, J.", title: "Paper", year: 2024, venue: "Nature", doi: "10.1234/x" }
    const result = formatElsevierRef(entry, 1)
    assert.match(result, /^\[1\]/)
    assert.match(result, /doi\.org\/10\.1234\/x/)
  })

  it("reference falls back to URL", () => {
    const entry = { authors: "Doe, A.", title: "Paper", year: 2023, venue: "Science", url: "https://x.com" }
    const result = formatElsevierRef(entry, 3)
    assert.match(result, /^\[3\]/)
    assert.match(result, /https:\/\/x\.com/)
  })

  it("omits year segment when year is null", () => {
    const entry = { authors: "Smith, J.", title: "Paper", year: null, venue: "Nature", doi: "10.1234/x" }
    const result = formatElsevierRef(entry, 1)
    assert.ok(!result.includes(", 0."), `unexpected ', 0.': ${result}`)
    assert.match(result, /Paper, Nature\./)
  })

  it("omits year segment when year is undefined", () => {
    const entry = { authors: "Smith, J.", title: "Paper", venue: "Nature" }
    const result = formatElsevierRef(entry, 2)
    assert.match(result, /Paper, Nature\./)
  })
})

describe("formatCitationReport", () => {
  it("empty papers returns message", () => {
    const result = formatCitationReport({ papers: [] })
    assert.match(result, /未提供论文列表/)
  })

  it("three papers produces all three sections", () => {
    const papers = [
      { authors: "A", title: "T1", year: 2024, venue: "V1", doi: "10.1" },
      { authors: "B", title: "T2", year: 2023, venue: "V2", doi: "10.2" },
      { authors: "C", title: "T3", year: 2022, venue: "V3", doi: "10.3" },
    ]
    const result = formatCitationReport({ papers })
    assert.match(result, /## 正文引用/)
    assert.match(result, /## 参考文献/)
    assert.match(result, /## 引文说明/)
    assert.match(result, /\[1\], \[2\], \[3\]/)
    assert.match(result, /https:\/\/doi\.org\/10\.1/)
  })

  it("report includes originalTextSummary and description", () => {
    const papers = [
      { authors: "A", title: "T1", year: 2024, venue: "V1", originalTextSummary: "summary text", description: "note" },
    ]
    const result = formatCitationReport({ papers })
    assert.match(result, /summary text/)
    assert.match(result, /note/)
  })
})

describe("formatCitationFromCrossref", () => {
  const originalFetch = globalThis.fetch
  let calls: { url: string; accept: string | null }[]

  function stubFetch(impl: () => Promise<Response>) {
    calls = []
    globalThis.fetch = (async (url: any, init: any) => {
      calls.push({ url: String(url), accept: init?.headers?.Accept ?? null })
      return impl()
    }) as typeof fetch
  }

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it("bibtex uses x-bibtex accept header and returns trimmed text", async () => {
    stubFetch(async () => new Response("\n@article{doe2024,\n  title={T}\n}\n\n", { status: 200 }))
    const result = await formatCitationFromCrossref("10.1234/test", "bibtex")
    assert.equal(result, "@article{doe2024,\n  title={T}\n}")
    assert.equal(calls.length, 1)
    assert.equal(calls[0].accept, "application/x-bibtex")
    assert.match(calls[0].url, /works\/10\.1234%2Ftest\/transform\/application\/x-bibtex$/)
  })

  it("apa sends CSL bibliography accept header", async () => {
    stubFetch(async () => new Response("Doe, A. (2024). Title. Nature.", { status: 200 }))
    const result = await formatCitationFromCrossref("10.1234/test", "apa")
    assert.equal(calls[0].accept, "text/bibliography; style=apa")
    assert.match(result!, /Doe, A\. \(2024\)/)
  })

  it("mla maps to modern-language-association", async () => {
    stubFetch(async () => new Response('Doe, A. "Title." Nature, 2024.', { status: 200 }))
    await formatCitationFromCrossref("10.1234/test", "mla")
    assert.equal(calls[0].accept, "text/bibliography; style=modern-language-association")
  })

  it("strips html tags and decodes entities", async () => {
    stubFetch(async () => new Response("Doe, A. (2024). <i>Nature</i>, A &amp; B.\n", { status: 200 }))
    const result = await formatCitationFromCrossref("10.1234/test", "apa")
    assert.equal(result, "Doe, A. (2024). Nature, A & B.")
  })

  it("returns null after retries on persistent 500", async () => {
    stubFetch(async () => new Response("err", { status: 500 }))
    const result = await formatCitationFromCrossref("10.1234/test", "apa")
    assert.equal(result, null)
    assert.equal(calls.length, 3)
  })

  it("gb7714 returns null without any fetch call", async () => {
    stubFetch(async () => new Response("unreachable", { status: 200 }))
    const result = await formatCitationFromCrossref("10.1234/test", "gb7714")
    assert.equal(result, null)
    assert.equal(calls.length, 0)
  })

  it("elsevier returns null without any fetch call", async () => {
    stubFetch(async () => new Response("unreachable", { status: 200 }))
    const result = await formatCitationFromCrossref("10.1234/test", "elsevier")
    assert.equal(result, null)
    assert.equal(calls.length, 0)
  })
})
