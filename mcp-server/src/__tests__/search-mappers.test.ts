import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "fs"
import { resolve, dirname } from "path"
import { fileURLToPath } from "url"
import {
  mapS2Paper,
  mapOpenAlexWork,
  mapCrossrefWork,
  reconstructAbstract,
} from "../paper-search.js"

const __dirname = dirname(fileURLToPath(import.meta.url))

function loadFixture(name: string): any {
  return JSON.parse(readFileSync(resolve(__dirname, "fixtures", name), "utf-8"))
}

const s2Fixture = loadFixture("s2-search.json")
const openalexFixture = loadFixture("openalex-search.json")
const crossrefFixture = loadFixture("crossref-search.json")

describe("mapS2Paper against recorded S2 responses", () => {
  const items: any[] = s2Fixture.data
  assert.ok(items.length > 0, "fixture must contain items")

  it("every item maps to non-empty title and url", () => {
    for (const p of items) {
      const r = mapS2Paper(p)
      assert.ok(r.title.length > 0, `empty title for ${p.paperId}`)
      assert.ok(r.url.length > 0, `empty url for ${p.paperId}`)
    }
  })

  it("doi preserved from externalIds.DOI without doi.org prefix", () => {
    for (const p of items) {
      const r = mapS2Paper(p)
      const rawDoi = p.externalIds?.DOI
      if (rawDoi) {
        assert.equal(r.doi, rawDoi)
        assert.ok(!r.doi!.startsWith("https://doi.org/"), `doi carries prefix: ${r.doi}`)
      }
    }
  })

  it("authors string non-empty when authors exist", () => {
    for (const p of items) {
      const r = mapS2Paper(p)
      if ((p.authors || []).length > 0) {
        assert.ok(r.authors.length > 0, `empty authors for ${p.paperId}`)
      }
    }
  })

  it("source and year mapped", () => {
    for (const p of items) {
      const r = mapS2Paper(p)
      assert.equal(r.source, "Semantic Scholar")
      if (p.year) assert.equal(r.year, p.year)
    }
  })
})

describe("mapOpenAlexWork against recorded OpenAlex responses", () => {
  const items: any[] = openalexFixture.results
  assert.ok(items.length > 0, "fixture must contain items")

  it("every item maps to non-empty title and url", () => {
    for (const w of items) {
      const r = mapOpenAlexWork(w)
      assert.ok(r.title.length > 0, `empty title for ${w.id}`)
      assert.ok(r.url.length > 0, `empty url for ${w.id}`)
    }
  })

  it("doi normalized by stripping https://doi.org/ prefix", () => {
    const withDoi = items.filter((w) => w.doi)
    assert.ok(withDoi.length > 0, "fixture should contain a DOI-bearing work")
    for (const w of withDoi) {
      const r = mapOpenAlexWork(w)
      assert.ok(!r.doi!.startsWith("https://doi.org/"), `doi carries prefix: ${r.doi}`)
      assert.equal(r.doi, w.doi.replace("https://doi.org/", ""))
      assert.equal(r.url, w.doi)
    }
  })

  it("DOI-less work falls back to OpenAlex id as url", () => {
    const withoutDoi = items.filter((w) => !w.doi)
    assert.ok(withoutDoi.length > 0, "fixture should contain a DOI-less work")
    for (const w of withoutDoi) {
      const r = mapOpenAlexWork(w)
      assert.equal(r.doi, null)
      assert.equal(r.url, w.id)
      assert.ok(r.url.startsWith("https://openalex.org/"))
    }
  })

  it("abstract reconstructed from inverted index without undefined", () => {
    for (const w of items) {
      if (!w.abstract_inverted_index) continue
      const r = mapOpenAlexWork(w)
      assert.ok(r.abstract.length > 0, `empty abstract for ${w.id}`)
      assert.ok(!r.abstract.includes("undefined"), `abstract contains "undefined" for ${w.id}`)
    }
  })

  it("abstract word order matches inverted index positions", () => {
    // Recorded fixture: "Graph Attention Networks" abstract begins "We present graph attention networks"
    const gat = items.find((w) => w.title === "Graph Attention Networks")
    assert.ok(gat, "fixture should contain the Graph Attention Networks work")
    const r = mapOpenAlexWork(gat)
    assert.ok(
      r.abstract.startsWith("We present"),
      `unexpected abstract start: ${r.abstract.slice(0, 60)}`,
    )
  })
})

describe("mapCrossrefWork against recorded Crossref responses", () => {
  const items: any[] = crossrefFixture.message.items
  assert.ok(items.length > 0, "fixture must contain items")

  it("every item maps to non-empty title and url", () => {
    for (const item of items) {
      const r = mapCrossrefWork(item)
      assert.ok(r.title.length > 0, `empty title for ${item.DOI}`)
      assert.ok(r.url.length > 0, `empty url for ${item.DOI}`)
    }
  })

  it("year is a positive number when published/created date-parts exists", () => {
    for (const item of items) {
      const r = mapCrossrefWork(item)
      const hasDateParts =
        item.published?.["date-parts"]?.[0]?.[0] || item.created?.["date-parts"]?.[0]?.[0]
      if (hasDateParts) {
        assert.equal(typeof r.year, "number", `year not a number for ${item.DOI}`)
        assert.ok(r.year! > 0, `year not positive for ${item.DOI}`)
      }
    }
  })

  it("falls back to created date-parts when published is missing", () => {
    // Recorded fixture item: a Crossref component without `published`, only `created`
    const noPublished = items.find((item) => !item.published && item.created?.["date-parts"])
    assert.ok(noPublished, "fixture should contain an item without published")
    const r = mapCrossrefWork(noPublished)
    assert.equal(r.year, noPublished.created["date-parts"][0][0])
  })

  it("doi mapped without doi.org prefix", () => {
    for (const item of items) {
      const r = mapCrossrefWork(item)
      if (item.DOI) {
        assert.equal(r.doi, item.DOI)
        assert.ok(!r.doi!.startsWith("https://doi.org/"), `doi carries prefix: ${r.doi}`)
      }
    }
  })

  it("abstract stripped of JATS tags", () => {
    const r = mapCrossrefWork({
      title: ["T"],
      DOI: "10.1234/x",
      abstract: "<jats:p>Hello <jats:italic>world</jats:italic> &amp; friends</jats:p>",
    })
    assert.equal(r.abstract, "Hello world & friends")
  })
})

describe("reconstructAbstract", () => {
  it("rebuilds sentence from inverted index", () => {
    const index = { hello: [0], world: [1] }
    assert.equal(reconstructAbstract(index), "hello world")
  })

  it("handles multi-position words", () => {
    const index = { graph: [0, 2], neural: [1], networks: [3] }
    assert.equal(reconstructAbstract(index), "graph neural graph networks")
  })
})
