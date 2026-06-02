import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { formatCiteTextReport, CiteTextResult } from "../cite-text.js"

function makeResult(overrides: Partial<CiteTextResult> = {}): CiteTextResult {
  return {
    bodyText: "This is a test text.",
    references: [],
    tableRows: [],
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
