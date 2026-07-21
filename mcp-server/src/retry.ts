export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export interface RetryOptions {
  maxRetries?: number
  baseDelayMs?: number
}

export async function fetchWithRetry(
  url: string,
  init?: RequestInit,
  options: RetryOptions = {},
): Promise<Response> {
  const maxRetries = options.maxRetries ?? 2
  const baseDelayMs = options.baseDelayMs ?? 1000

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const resp = await fetch(url, { ...init, signal: AbortSignal.timeout(30_000) })
      // 仅 5xx 服务端错误值得重试；4xx（403 key 无效 / 429 共享池限流等）重试无益且放大延迟
      if (resp.status >= 500 && attempt < maxRetries) {
        // Drain the body so the keep-alive connection can be reused
        await resp.text().catch(() => "")
        await sleep(baseDelayMs * Math.pow(2, attempt))
        continue
      }
      return resp
    } catch (err) {
      if (attempt < maxRetries) {
        await sleep(baseDelayMs * Math.pow(2, attempt))
        continue
      }
      throw err
    }
  }
  throw new Error(`Request failed after ${maxRetries + 1} attempts`)
}

export function stagger<T>(
  fns: Array<() => Promise<T>>,
  delayMs: number = 200,
): Array<Promise<T>> {
  return fns.map((fn, i) => {
    if (i === 0) return fn()
    return (async () => {
      await sleep(i * delayMs)
      return fn()
    })()
  })
}

export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length)
  let next = 0
  const worker = async () => {
    while (next < items.length) {
      const i = next++
      try {
        results[i] = { status: "fulfilled", value: await fn(items[i]) }
      } catch (reason) {
        results[i] = { status: "rejected", reason }
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker()),
  )
  return results
}
