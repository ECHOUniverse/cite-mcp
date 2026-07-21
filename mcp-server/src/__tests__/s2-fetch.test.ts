import { describe, it, afterEach } from "node:test"
import assert from "node:assert/strict"
import { fetchS2 } from "../s2-fetch.js"
import { config } from "../config.js"

interface Call {
  url: string
  apiKey: string | null
  method: string
  body: unknown
  contentType: string | null
}

describe("fetchS2", () => {
  const originalFetch = globalThis.fetch
  const originalKey = config.s2.apiKey
  let calls: Call[]

  function stubFetch(impl: (callIndex: number) => Promise<Response>) {
    calls = []
    globalThis.fetch = (async (url: any, init: any) => {
      const h = (init?.headers ?? {}) as Record<string, string>
      calls.push({
        url: String(url),
        apiKey: h["x-api-key"] ?? null,
        method: init?.method ?? "GET",
        body: init?.body,
        contentType: h["Content-Type"] ?? null,
      })
      return impl(calls.length - 1)
    }) as typeof fetch
  }

  afterEach(() => {
    globalThis.fetch = originalFetch
    config.s2.apiKey = originalKey
  })

  it("带 key 且成功：单次调用并携带 x-api-key", async () => {
    config.s2.apiKey = "test-key"
    stubFetch(async () => new Response("ok", { status: 200 }))
    const resp = await fetchS2("https://api.semanticscholar.org/x")
    assert.equal(resp.status, 200)
    assert.equal(calls.length, 1)
    assert.equal(calls[0].apiKey, "test-key")
  })

  it("带 key 403：自动去 key 回退公共池重试一次", async () => {
    config.s2.apiKey = "bad-key"
    stubFetch(async (i) =>
      i === 0 ? new Response("forbidden", { status: 403 }) : new Response("ok", { status: 200 }),
    )
    const resp = await fetchS2("https://api.semanticscholar.org/x")
    assert.equal(resp.status, 200)
    assert.equal(calls.length, 2)
    assert.equal(calls[0].apiKey, "bad-key")
    assert.equal(calls[1].apiKey, null)
  })

  it("带 key 401 同样触发回退", async () => {
    config.s2.apiKey = "bad-key"
    stubFetch(async (i) =>
      i === 0 ? new Response("unauthorized", { status: 401 }) : new Response("ok", { status: 200 }),
    )
    const resp = await fetchS2("https://api.semanticscholar.org/x")
    assert.equal(resp.status, 200)
    assert.equal(calls.length, 2)
  })

  it("回退后仍 403：直接返回，不循环重试", async () => {
    config.s2.apiKey = "bad-key"
    stubFetch(async () => new Response("forbidden", { status: 403 }))
    const resp = await fetchS2("https://api.semanticscholar.org/x")
    assert.equal(resp.status, 403)
    assert.equal(calls.length, 2)
  })

  it("带 key 429：不回退（key 池限流时公共池更紧张）", async () => {
    config.s2.apiKey = "test-key"
    stubFetch(async () => new Response("too many", { status: 429 }))
    const resp = await fetchS2("https://api.semanticscholar.org/x")
    assert.equal(resp.status, 429)
    assert.equal(calls.length, 1)
  })

  it("未配置 key：单次调用且不携带 x-api-key", async () => {
    config.s2.apiKey = ""
    stubFetch(async () => new Response("ok", { status: 200 }))
    const resp = await fetchS2("https://api.semanticscholar.org/x")
    assert.equal(resp.status, 200)
    assert.equal(calls.length, 1)
    assert.equal(calls[0].apiKey, null)
  })

  it("POST 回退保留 method / body / Content-Type", async () => {
    config.s2.apiKey = "bad-key"
    stubFetch(async (i) =>
      i === 0 ? new Response("forbidden", { status: 403 }) : new Response("[]", { status: 200 }),
    )
    const resp = await fetchS2("https://api.semanticscholar.org/graph/v1/paper/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: ["DOI:10.1/x"] }),
    })
    assert.equal(resp.status, 200)
    assert.equal(calls.length, 2)
    for (const c of calls) {
      assert.equal(c.method, "POST")
      assert.equal(c.contentType, "application/json")
      assert.equal(c.body, JSON.stringify({ ids: ["DOI:10.1/x"] }))
    }
    assert.equal(calls[1].apiKey, null)
  })
})
