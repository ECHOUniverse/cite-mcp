import { readFileSync, existsSync } from "fs"
import { resolve, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))

function loadEnv() {
  const candidates = [
    resolve(dirname(dirname(__dirname)), ".env"),
    resolve(process.cwd(), ".env"),
  ]
  for (const envPath of candidates) {
    if (existsSync(envPath)) {
      const text = readFileSync(envPath, "utf-8")
      for (const rawLine of text.split(/\r?\n/)) {
        const line = rawLine.trim()
        if (line.startsWith("#") || line === "") continue
        const idx = line.indexOf("=")
        if (idx === -1) continue
        const key = line.slice(0, idx).trim()
        const value = line.slice(idx + 1).trim()
        if (key && process.env[key] === undefined) {
          process.env[key] = value
        }
      }
      break
    }
  }
}

loadEnv()

export const config = {
  s2: {
    apiKey: process.env.S2_API_KEY ?? "",
    baseUrl: "https://api.semanticscholar.org/graph/v1",
    fields:
      "title,authors,year,abstract,externalIds,url,citationCount,venue,references.title,references.year,references.externalIds",
  },
  openalex: {
    mailto: process.env.OPENALEX_MAILTO ?? "",
    baseUrl: "https://api.openalex.org",
  },
  crossref: {
    baseUrl: "https://api.crossref.org/works",
    mailto: process.env.CROSSREF_MAILTO ?? "",
  },
  doi: {
    baseUrl: "https://doi.org",
  },
}
