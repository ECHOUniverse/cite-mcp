import { describe, it, afterEach } from "node:test"
import assert from "node:assert/strict"
import { classifyTopic, formatTopicResults, TopicResult } from "../topic-classify.js"

const originalFetch = globalThis.fetch

function stubFetch(payload: unknown) {
  globalThis.fetch = (async () =>
    new Response(JSON.stringify(payload), { status: 200 })) as typeof fetch
}

// 两个 topic：T1 与 T2 同属一个 field/subfield，但 domain 不同
const topicsPayload = {
  results: [
    {
      id: "https://openalex.org/T1",
      display_name: "Machine Learning in Materials Science",
      works_count: 142493,
      description: "ML for materials",
      domain: { id: "https://openalex.org/domains/3", display_name: "Physical Sciences" },
      field: { id: "https://openalex.org/fields/25", display_name: "Materials Science" },
      subfield: { id: "https://openalex.org/subfields/2505", display_name: "Materials Chemistry" },
    },
    {
      id: "https://openalex.org/T2",
      display_name: "Deep Learning for Biology",
      works_count: 80000,
      domain: { id: "https://openalex.org/domains/4", display_name: "Life Sciences" },
      field: { id: "https://openalex.org/fields/25", display_name: "Materials Science" },
      subfield: { id: "https://openalex.org/subfields/2505", display_name: "Materials Chemistry" },
    },
    {
      id: "https://openalex.org/T3",
      display_name: "Topic Without Ancestors",
      works_count: 10,
    },
  ],
}

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe("classifyTopic", () => {
  it("level 0 returns distinct domains with null worksCount", async () => {
    stubFetch(topicsPayload)
    const results = await classifyTopic("machine learning", 0)
    assert.equal(results.length, 2)
    assert.deepEqual(
      results.map((r) => r.name),
      ["Physical Sciences", "Life Sciences"],
    )
    assert.equal(results[0].levelName, "领域")
    assert.equal(results[0].worksCount, null)
    assert.equal(results[0].url, "https://openalex.org/domains/3")
  })

  it("level 1 dedups fields shared by multiple topics", async () => {
    stubFetch(topicsPayload)
    const results = await classifyTopic("machine learning", 1)
    assert.equal(results.length, 1)
    assert.equal(results[0].name, "Materials Science")
    assert.equal(results[0].levelName, "学科")
    assert.equal(results[0].url, "https://openalex.org/fields/25")
  })

  it("level 2 returns subfields and skips topics missing them", async () => {
    stubFetch(topicsPayload)
    const results = await classifyTopic("machine learning", 2)
    assert.equal(results.length, 1)
    assert.equal(results[0].name, "Materials Chemistry")
    assert.equal(results[0].levelName, "子学科")
    assert.equal(results[0].url, "https://openalex.org/subfields/2505")
  })

  it("defaults to level 0", async () => {
    stubFetch(topicsPayload)
    const results = await classifyTopic("machine learning")
    assert.equal(results[0].levelName, "领域")
  })

  it("throws on empty query", async () => {
    await assert.rejects(classifyTopic("", 0), /不能为空/)
  })

  it("throws on invalid level listing allowed values", async () => {
    await assert.rejects(classifyTopic("x", 3), /0（领域）、1（学科）、2（子学科）/)
    await assert.rejects(classifyTopic("x", -1), /无效的层级/)
  })
})

describe("formatTopicResults", () => {
  it("renders header with level name and url per entry", () => {
    const results: TopicResult[] = [
      {
        name: "Physical Sciences",
        levelName: "领域",
        worksCount: null,
        url: "https://openalex.org/domains/3",
      },
    ]
    const out = formatTopicResults(results, 0)
    assert.ok(out.includes("=== 主题分类（层级: 领域）==="))
    assert.ok(out.includes("1. Physical Sciences"))
    assert.ok(out.includes("成果数: 未知"))
    assert.ok(out.includes("URL: https://openalex.org/domains/3"))
  })

  it("empty array returns not-found message", () => {
    assert.equal(formatTopicResults([], 1), "未找到匹配的主题分类。")
  })
})
