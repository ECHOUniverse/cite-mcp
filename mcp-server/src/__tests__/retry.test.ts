import { describe, it, afterEach } from "node:test"
import assert from "node:assert/strict"
import { mapWithConcurrency, fetchWithRetry, sleep } from "../retry.js"

describe("mapWithConcurrency", () => {
  it("preserves order and resolves all results", async () => {
    const items = [30, 20, 10, 5, 1]
    const results = await mapWithConcurrency(items, 2, async (n) => {
      await sleep(n)
      return n * 2
    })
    assert.deepEqual(
      results.map((r) => r.status),
      ["fulfilled", "fulfilled", "fulfilled", "fulfilled", "fulfilled"],
    )
    assert.deepEqual(
      results.map((r) => (r as PromiseFulfilledResult<number>).value),
      [60, 40, 20, 10, 2],
    )
  })

  it("never exceeds the in-flight limit", async () => {
    let current = 0
    let max = 0
    const items = Array.from({ length: 10 }, (_, i) => i)
    const results = await mapWithConcurrency(items, 3, async (n) => {
      current++
      max = Math.max(max, current)
      await sleep(10)
      current--
      return n
    })
    assert.equal(results.length, 10)
    assert.ok(max <= 3, `max concurrency ${max} exceeded limit 3`)
    assert.ok(max >= 2, `max concurrency ${max} suspiciously low`)
  })

  it("captures rejection per item without rejecting the whole promise", async () => {
    const results = await mapWithConcurrency([1, 2, 3], 2, async (n) => {
      if (n === 2) throw new Error("boom")
      return n
    })
    assert.equal(results[0].status, "fulfilled")
    assert.equal(results[1].status, "rejected")
    assert.equal((results[1] as PromiseRejectedResult).reason.message, "boom")
    assert.equal(results[2].status, "fulfilled")
  })

  it("empty array returns empty", async () => {
    assert.deepEqual(await mapWithConcurrency([], 5, async () => 1), [])
  })
})

describe("fetchWithRetry", () => {
  const originalFetch = globalThis.fetch
  let calls = 0

  function stubFetch(impl: () => Promise<Response>) {
    calls = 0
    globalThis.fetch = (async () => {
      calls++
      return impl()
    }) as typeof fetch
  }

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it("no retry on 404 (single call)", async () => {
    stubFetch(async () => new Response("not found", { status: 404 }))
    const resp = await fetchWithRetry("https://example.com", undefined, { baseDelayMs: 1 })
    assert.equal(resp.status, 404)
    assert.equal(calls, 1)
  })

  it("no retry on 403 (auth failure is not retryable)", async () => {
    stubFetch(async () => new Response("forbidden", { status: 403 }))
    const resp = await fetchWithRetry("https://example.com", undefined, { baseDelayMs: 1 })
    assert.equal(resp.status, 403)
    assert.equal(calls, 1)
  })

  it("no retry on 429 (shared-pool rate limit does not recover in backoff window)", async () => {
    stubFetch(async () => new Response("too many", { status: 429 }))
    const resp = await fetchWithRetry("https://example.com", undefined, { baseDelayMs: 1 })
    assert.equal(resp.status, 429)
    assert.equal(calls, 1)
  })

  it("retries twice on 500 then returns response", async () => {
    stubFetch(async () => new Response("err", { status: 500 }))
    const resp = await fetchWithRetry("https://example.com", undefined, { baseDelayMs: 1 })
    assert.equal(resp.status, 500)
    assert.equal(calls, 3)
  })

  it("retries on 500 then returns success", async () => {
    let n = 0
    stubFetch(async () => {
      n++
      return n === 1
        ? new Response("err", { status: 500 })
        : new Response("ok", { status: 200 })
    })
    const resp = await fetchWithRetry("https://example.com", undefined, { baseDelayMs: 1 })
    assert.equal(resp.status, 200)
    assert.equal(calls, 2)
  })

  it("retries on network throw then rethrows", async () => {
    stubFetch(async () => {
      throw new Error("network down")
    })
    await assert.rejects(
      fetchWithRetry("https://example.com", undefined, { baseDelayMs: 1 }),
      /network down/,
    )
    assert.equal(calls, 3)
  })
})
