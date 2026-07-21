import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { parseEnvValue } from "../config.js"

describe("parseEnvValue", () => {
  it("strips double quotes", () => {
    assert.equal(parseEnvValue('"abc123"'), "abc123")
  })

  it("strips single quotes", () => {
    assert.equal(parseEnvValue("'abc'"), "abc")
  })

  it("unquoted value unchanged", () => {
    assert.equal(parseEnvValue("abc"), "abc")
  })

  it("empty value unchanged", () => {
    assert.equal(parseEnvValue(""), "")
  })

  it("mismatched quotes unchanged", () => {
    assert.equal(parseEnvValue('"abc\''), '"abc\'')
  })
})
