import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { buildCiteTextResult, formatCiteTextReport, CiteTextResult, ClaimMatch } from "../cite-text.js"
import { PaperResult } from "../paper-search.js"
import { paperKey } from "../utils.js"

function makeResult(overrides: Partial<CiteTextResult> = {}): CiteTextResult {
  return {
    bodyText: "This is a test text.",
    references: [],
    tableRows: [],
    ...overrides,
  }
}

function makePaper(overrides: Partial<PaperResult> = {}): PaperResult {
  return {
    title: "T",
    authors: "A",
    year: 2024,
    abstract: "",
    doi: null,
    url: "",
    source: "Semantic Scholar",
    citationCount: null,
    venue: "V",
    ...overrides,
  }
}

describe("formatCiteTextReport", () => {
  it("empty references returns helpful message", () => {
    const result = formatCiteTextReport(makeResult())
    assert.match(result, /未找到相关文献/)
  })

  it("returns all three sections", () => {
    const result = formatCiteTextReport(makeResult({
      bodyText: "Claim [1] at end of sentence.",
      references: [
        { authors: "Smith, J.", title: "Test Paper", year: 2024, venue: "Nature", doi: "10.1234/test", url: "https://doi.org/10.1234/test" },
      ],
      tableRows: [
        { index: 1, title: "Test Paper", url: "https://doi.org/10.1234/test", summary: "claim summary", description: "note" },
      ],
    }))
    assert.match(result, /## 正文引用/)
    assert.match(result, /## 参考文献/)
    assert.match(result, /## 引文说明/)
    assert.match(result, /Claim \[1\] at end/)
    assert.match(result, /https:\/\/doi\.org\/10\.1234\/test/)
  })

  it("table rows include summary and description", () => {
    const result = formatCiteTextReport(makeResult({
      bodyText: "Text [1].",
      references: [
        { authors: "A", title: "T", year: 2024, venue: "V", doi: "10.1", url: "https://doi.org/10.1" },
      ],
      tableRows: [
        { index: 1, title: "T", url: "https://doi.org/10.1", summary: "my summary", description: "my note" },
      ],
    }))
    assert.match(result, /my summary/)
    assert.match(result, /my note/)
  })

  it("multiple references produce multiple rows", () => {
    const result = formatCiteTextReport(makeResult({
      bodyText: "Text [1,2] end.",
      references: [
        { authors: "A", title: "T1", year: 2024, venue: "V1", doi: "10.1", url: "https://doi.org/10.1" },
        { authors: "B", title: "T2", year: 2023, venue: "V2", doi: "10.2", url: "https://doi.org/10.2" },
      ],
      tableRows: [
        { index: 1, title: "T1", url: "https://doi.org/10.1", summary: "s1", description: "" },
        { index: 2, title: "T2", url: "https://doi.org/10.2", summary: "s2", description: "" },
      ],
    }))
    assert.match(result, /s1/)
    assert.match(result, /s2/)
  })
})

describe("paperKey", () => {
  it("prefers DOI, case-insensitive", () => {
    assert.equal(paperKey({ doi: "10.1234/ABC", title: "X", year: 2024 }), "doi:10.1234/abc")
  })

  it("falls back to title:year when no DOI", () => {
    assert.equal(paperKey({ doi: null, title: "Some Title", year: 2024 }), "some title:2024")
  })

  it("empty-string DOI falls back to title:year", () => {
    assert.equal(paperKey({ doi: "", title: "Some Title", year: 2024 }), "some title:2024")
  })

  it("returns empty string when both DOI and title are missing", () => {
    assert.equal(paperKey({ doi: null, title: "", year: null }), "")
  })
})

describe("buildCiteTextResult", () => {
  it("two claims sharing one paper both receive ref numbers", () => {
    const text = "First claim sentence. Second claim sentence."
    // 两个 claim 的搜索各自产生不同对象实例，但 DOI 相同（同一篇论文）
    const sharedA = makePaper({ title: "Shared Paper", doi: "10.1234/shared" })
    const sharedB = makePaper({ title: "Shared Paper", doi: "10.1234/shared" })
    const other = makePaper({ title: "Other Paper", doi: "10.1234/other" })
    const claimMatches: ClaimMatch[] = [
      { claim: { sentence: "First claim sentence." }, papers: [sharedA, other] },
      { claim: { sentence: "Second claim sentence." }, papers: [sharedB] },
    ]
    const result = buildCiteTextResult(text, claimMatches)
    assert.equal(result.references.length, 2)
    assert.match(result.bodyText, /First claim sentence\.\[1,2\]/)
    assert.match(result.bodyText, /Second claim sentence\.\[1\]/)
  })

  it("attributes DOI-less papers to the correct claim", () => {
    const text = "Alpha sentence. Beta sentence."
    const alpha = makePaper({ title: "Alpha Paper", year: 2024, doi: null })
    const beta = makePaper({ title: "Beta Paper", year: 2023, doi: null })
    const claimMatches: ClaimMatch[] = [
      { claim: { sentence: "Alpha sentence." }, papers: [alpha] },
      { claim: { sentence: "Beta sentence." }, papers: [beta] },
    ]
    const result = buildCiteTextResult(text, claimMatches)
    const alphaRow = result.tableRows.find(r => r.title === "Alpha Paper")
    const betaRow = result.tableRows.find(r => r.title === "Beta Paper")
    assert.equal(alphaRow?.summary, "Alpha sentence.")
    assert.equal(betaRow?.summary, "Beta sentence.")
  })

  it("papers without DOI and title never cross-attribute via empty keys", () => {
    const text = "Empty one. Empty two."
    const e1 = makePaper({ title: "", year: null, doi: null })
    const e2 = makePaper({ title: "", year: null, doi: null })
    const claimMatches: ClaimMatch[] = [
      { claim: { sentence: "Empty one." }, papers: [e1] },
      { claim: { sentence: "Empty two." }, papers: [e2] },
    ]
    const result = buildCiteTextResult(text, claimMatches)
    for (const row of result.tableRows) {
      assert.equal(row.summary, "")
    }
  })

  it("missing year stays null and renders without ', 0.'", () => {
    const text = "Claim without year."
    const noYear = makePaper({ title: "No Year Paper", year: null, doi: "10.1234/noyear" })
    const claimMatches: ClaimMatch[] = [
      { claim: { sentence: "Claim without year." }, papers: [noYear] },
    ]
    const result = buildCiteTextResult(text, claimMatches)
    assert.equal(result.references[0].year, null)
    const report = formatCiteTextReport(result)
    assert.ok(!report.includes(", 0."), `unexpected ', 0.': ${report}`)
    assert.match(report, /No Year Paper, V\./)
  })
})
