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
      const resp = await fetch(url, init)
      if ((resp.status >= 500 || resp.status === 429) && attempt < maxRetries) {
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
