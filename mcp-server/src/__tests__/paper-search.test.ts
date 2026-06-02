import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { deduplicate, PaperResult } from "../paper-search.js"

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
