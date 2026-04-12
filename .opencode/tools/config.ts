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