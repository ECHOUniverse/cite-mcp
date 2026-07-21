import http from "node:http"
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js"

import "./config.js"
import { createServer } from "./server.js"

const port = Number(process.env.PORT ?? 3000)
const MCP_PATH = "/mcp"

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on("data", (chunk: Buffer) => chunks.push(chunk))
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")))
    req.on("error", reject)
  })
}

function sendJsonRpcError(res: http.ServerResponse, status: number, message: string) {
  res.writeHead(status, { "Content-Type": "application/json" })
  res.end(JSON.stringify({ jsonrpc: "2.0", error: { code: -32000, message }, id: null }))
}

const httpServer = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`)

  if (url.pathname !== MCP_PATH) {
    sendJsonRpcError(res, 404, "Not found")
    return
  }

  if (req.method !== "POST") {
    // 无会话（stateless）模式：GET/DELETE 的会话流不适用，最小化处理为 405
    sendJsonRpcError(res, 405, "Method not allowed")
    return
  }

  try {
    const rawBody = await readBody(req)
    let parsedBody: unknown
    try {
      parsedBody = JSON.parse(rawBody)
    } catch {
      sendJsonRpcError(res, 400, "Invalid JSON body")
      return
    }

    // 无会话模式（sessionIdGenerator: undefined）：每个请求创建独立的 transport + server，
    // 响应结束后随连接关闭一并释放，见 MCP SEP-2567
    const server = createServer()
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })
    res.on("close", () => {
      transport.close().catch(() => {})
      server.close().catch(() => {})
    })
    await server.connect(transport)
    await transport.handleRequest(req, res, parsedBody)
  } catch (error) {
    console.error("HTTP request error:", error)
    if (!res.headersSent) {
      sendJsonRpcError(res, 500, "Internal server error")
    } else {
      res.end()
    }
  }
})

httpServer.listen(port, () => {
  console.error(`cite-mcp HTTP server listening on http://localhost:${port}${MCP_PATH}`)
})

process.on("SIGINT", () => {
  httpServer.close(() => process.exit(0))
})
