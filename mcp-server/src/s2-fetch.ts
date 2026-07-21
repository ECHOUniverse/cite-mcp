import { config } from "./config.js"
import { fetchWithRetry } from "./retry.js"

/**
 * S2 统一请求入口：配置了 apiKey 时带 key 请求；
 * 若 key 鉴权失败（401/403），自动去掉 key 走未认证公共池重试一次——
 * 失效 key 会导致全端点 403，而不发 key 时公共池部分端点仍可用。
 * 429 不回退：key 池限流时公共池通常更紧张，重试无收益。
 */
export async function fetchS2(url: string, init: RequestInit = {}): Promise<Response> {
  const { apiKey } = config.s2
  const headers: Record<string, string> = { ...(init.headers as Record<string, string> | undefined) }
  if (apiKey) headers["x-api-key"] = apiKey

  const resp = await fetchWithRetry(url, { ...init, headers })
  if (!apiKey || (resp.status !== 401 && resp.status !== 403)) return resp

  console.error(`[cite-mcp] S2 API key 鉴权失败 (HTTP ${resp.status})，回退无 key 公共池重试`)
  await resp.text().catch(() => "") // drain body，复用 keep-alive 连接
  delete headers["x-api-key"]
  return fetchWithRetry(url, { ...init, headers })
}
