import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { formatCitation, formatCitationReport, formatElsevierAuthors, formatElsevierRef } from "../citation.js"

describe("formatCitation", () => {
  const base = { authors: "Smith, J.; Doe, A.", title: "Test Paper", year: 2024, venue: "Nature" }

  it("APA format with DOI", async () => {
    const result = await formatCitation({ ...base, doi: "10.1234/test", style: "apa" })
    assert.match(result, /Smith, J.; Doe, A\. \(2024\)/)
    assert.match(result, /doi\.org\/10\.1234\/test/)
  })

  it("MLA format with volume issue pages", async () => {
    const result = await formatCitation({ ...base, volume: "10", issue: "2", pages: "100-120", style: "mla" })
    assert.match(result, /Doe, A\.+ "Test Paper/)
    assert.match(result, /\b10\.2\b/)
    assert.match(result, /pp\. 100-120/)
  })

  it("GB/T 7714 format", async () => {
    const result = await formatCitation({ ...base, doi: "10.1234/test", style: "gb7714" })
    assert.match(result, /\[J\]/)
    assert.match(result, /DOI: 10\.1234\/test/)
  })

  it("BibTeX format", async () => {
    const result = await formatCitation({ ...base, doi: "10.1234/test", volume: "1", style: "bibtex" })
    assert.match(result, /@article\{/)
    assert.match(result, /doi = \{10\.1234\/test\}/)
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
