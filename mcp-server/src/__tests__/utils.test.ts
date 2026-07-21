import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { sanitizeErrorMessage, stripMarkup } from "../utils.js"
import { config } from "../config.js"

describe("stripMarkup", () => {
  it("去除 JATS 标签", () => {
    const input = "<jats:p>Hello <jats:italic>world</jats:italic></jats:p>"
    assert.equal(stripMarkup(input), "Hello world")
  })

  it("去除 jats:title 等嵌套标签并保留文本", () => {
    const input = '<jats:p>The role of <jats:title>TiO<sub>2</sub></jats:title> in catalysis</jats:p>'
    assert.equal(stripMarkup(input), "The role of TiO2 in catalysis")
  })

  it("解码常见 HTML 实体", () => {
    assert.equal(stripMarkup("A &amp; B &quot;q&quot; &#39;s&apos;"), `A & B "q" 's'`)
  })

  it("实体解码后的尖括号按标签处理（先解码后去标签）", () => {
    assert.equal(stripMarkup("A &lt;C&gt; B"), "A  B")
  })

  it("普通文本仅去首尾空白", () => {
    assert.equal(stripMarkup("  plain text  "), "plain text")
  })
})

describe("sanitizeErrorMessage", () => {
  it("去除堆栈行（首个 \"\\n    at \" 起截断）", () => {
    const msg = '请求失败: HTTP 429\n    at fetchWithRetry (/Users/x/retry.ts:20:11)\n    at run (/Users/x/a.ts:1:1)'
    assert.equal(sanitizeErrorMessage(msg), "请求失败: HTTP 429")
  })

  it("替换已配置的 API key 为 ***", () => {
    const oldS2 = config.s2.apiKey
    const oldOa = config.openalex.apiKey
    config.s2.apiKey = "s2-secret-abc"
    config.openalex.apiKey = "oa-secret-xyz"
    try {
      const msg = "鉴权失败: key=s2-secret-abc, key2=oa-secret-xyz"
      assert.equal(sanitizeErrorMessage(msg), "鉴权失败: key=***, key2=***")
    } finally {
      config.s2.apiKey = oldS2
      config.openalex.apiKey = oldOa
    }
  })

  it("空 API key 不产生替换", () => {
    const oldS2 = config.s2.apiKey
    const oldOa = config.openalex.apiKey
    config.s2.apiKey = ""
    config.openalex.apiKey = ""
    try {
      const msg = "普通错误信息"
      assert.equal(sanitizeErrorMessage(msg), "普通错误信息")
    } finally {
      config.s2.apiKey = oldS2
      config.openalex.apiKey = oldOa
    }
  })

  it("替换 /Users/... 绝对路径为 <path>", () => {
    const msg = "ENOENT: no such file, open '/Users/hanxu/secret/config.json'"
    assert.equal(sanitizeErrorMessage(msg), "ENOENT: no such file, open '<path>'")
  })

  it("替换当前工作目录路径为 <path>", () => {
    const cwd = process.cwd()
    if (cwd === "/") return // 根目录时不替换，跳过
    const msg = `文件缺失: ${cwd}/dist/index.js`
    assert.equal(sanitizeErrorMessage(msg), "文件缺失: <path>/dist/index.js")
  })

  it("干净信息原样返回", () => {
    const msg = "limit 参数必须在 1-100 之间"
    assert.equal(sanitizeErrorMessage(msg), msg)
  })
})
