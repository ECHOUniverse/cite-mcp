import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { formatTrendSection, GroupByItem } from "../paper-analysis.js"

function gb(key: string, count: number, name?: string): GroupByItem {
  return { key, key_display_name: name, count }
}

function yearItems(years: number[]): GroupByItem[] {
  // Deliberately shuffled: API returns count order, not year order
  return years.map((y, i) => gb(String(y), (i + 1) * 100, String(y))).reverse()
}

describe("formatTrendSection", () => {
  it("renders all three dimensions", () => {
    const out = formatTrendSection({
      years: yearItems([2022, 2024, 2023]),
      types: [gb("https://openalex.org/types/article", 100, "article")],
      topics: [gb("https://openalex.org/T1", 50, "Machine Learning")],
    })
    assert.ok(out.includes("### 领域趋势"))
    assert.ok(out.includes("**年份趋势**"))
    assert.ok(out.includes("**类型分布**"))
    assert.ok(out.includes("**研究热点**"))
    assert.ok(out.includes("- article: 100 篇"))
    assert.ok(out.includes("- Machine Learning: 50 篇"))
  })

  it("all dimensions empty returns empty string", () => {
    assert.equal(formatTrendSection({ years: [], types: [], topics: [] }), "")
  })

  it("years sorted descending regardless of input order", () => {
    const out = formatTrendSection({
      years: yearItems([2022, 2024, 2023]),
      types: [],
      topics: [],
    })
    const i2024 = out.indexOf("- 2024:")
    const i2023 = out.indexOf("- 2023:")
    const i2022 = out.indexOf("- 2022:")
    assert.ok(i2024 !== -1 && i2023 !== -1 && i2022 !== -1)
    assert.ok(i2024 < i2023 && i2023 < i2022)
  })

  it("non-numeric year keys are skipped", () => {
    const out = formatTrendSection({
      years: [gb("unknown", 999, "unknown"), gb("2024", 100, "2024")],
      types: [],
      topics: [],
    })
    assert.ok(!out.includes("unknown"))
    assert.ok(out.includes("- 2024: 100 篇"))
  })

  it("year trend limited to 8 most recent years", () => {
    const years = yearItems([2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024])
    const out = formatTrendSection({ years, types: [], topics: [] })
    const yearLines = out.split("\n").filter((l) => /^- \d{4}:/.test(l))
    assert.equal(yearLines.length, 8)
    assert.ok(yearLines[0].startsWith("- 2024:"))
    assert.ok(yearLines[7].startsWith("- 2017:"))
  })

  it("types and topics limited to top 5 by count", () => {
    const types = [1, 2, 3, 4, 5, 6, 7].map((i) => gb(`t${i}`, i * 10, `type${i}`))
    const topics = [1, 2, 3, 4, 5, 6, 7].map((i) => gb(`T${i}`, i * 10, `topic${i}`))
    const out = formatTrendSection({ years: [], types, topics })
    assert.ok(out.includes("- type7: 70 篇"))
    assert.ok(out.includes("- type3: 30 篇"))
    assert.ok(!out.includes("type2"))
    assert.ok(out.includes("- topic7: 70 篇"))
    assert.ok(!out.includes("topic2"))
  })

  it("missing key_display_name falls back to key", () => {
    const out = formatTrendSection({
      years: [],
      types: [gb("article", 100)],
      topics: [],
    })
    assert.ok(out.includes("- article: 100 篇"))
  })

  it("pipe characters in display names are escaped", () => {
    const out = formatTrendSection({
      years: [],
      types: [],
      topics: [gb("T1", 10, "Foo | Bar")],
    })
    assert.ok(out.includes("- Foo \\| Bar: 10 篇"))
  })

  it("partial data renders only available subsections", () => {
    const out = formatTrendSection({
      years: [gb("2024", 100, "2024")],
      types: [],
      topics: [],
    })
    assert.ok(out.includes("**年份趋势**"))
    assert.ok(!out.includes("**类型分布**"))
    assert.ok(!out.includes("**研究热点**"))
  })
})
