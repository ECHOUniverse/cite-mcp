# text-import-paper

This project provides **MCP tools for academic paper research** — paper search, detail retrieval, recommendations, and citation formatting. It integrates with Claude Code via the `paper-tools` MCP server.

## MCP Tools Available

### Paper Search
- `paper_search` — 多源聚合搜索 (S2 + OA + CR, deduplicated)
- `search_semantic_scholar` — Semantic Scholar 单源搜索，支持高级语法 (AND/OR/NOT/短语/前缀)
- `search_openalex` — OpenAlex 单源搜索（全学科）
- `search_crossref` — Crossref 单源搜索（DOI 元数据最权威）

### Paper Detail
- `paper_detail` — 通过 DOI 获取论文详情（多源合并，含摘要、参考文献）
- `get_by_s2id` — 通过 S2 Paper ID 获取论文详情
- `get_by_s2ids_batch` — 批量获取 S2 论文详情（最多500个）

### Paper Recommendations
- `paper_recommendations` — 基于已知论文获取 S2 推荐

### Citation
- `citation` — APA 7th / MLA 9th / GB/T 7714-2015 / BibTeX 格式化

---

## Protocols

### Paper Claim Verification (paper-verify)

当用户要求验证论文段落、查找支持文献、寻找引用时，使用以下工作流。

#### Step 1: 论点提取

从用户段落中提取 N 个可验证的学术主张（N 默认 3，用户可指定）。

**规则**:
- 只提取**可证伪**的主张（有明确研究主体、可在学术数据库中找到对应文献）
- 排除：背景描述、方法论说明、未来工作、常识性陈述
- 每个论点用一句话概括核心断言
- 论点翻译为英文关键词以便搜索

#### Step 2: 文献搜索

每个论点执行两组搜索：

**正向搜索**（找支持文献）:
- 优先 `search_semantic_scholar`（支持高级查询语法）
- 结果不足时补充 `paper_search`（多源聚合）

**反向搜索**（争议检测）:
- `paper_search` + 否定性关键词：`limitations/challenge/refute/contradict`

#### Step 3: 验证与分级

**证据分级**:
| 级别 | 标准 |
|------|------|
| A级 | 摘要明确验证论点，且为论文核心贡献 |
| B级 | 论文涉及该方向，但非主要结论 |
| C级 | 主题相关，但无直接证据 |

**争议标记**: 反向搜索发现强相关反驳文献 → 标记「存在学术争议」，列出双方最高质量文献

**格式化引文**: 对验证通过的文献，调用 `citation` 工具即可

#### Step 4: 输出报告

格式：
```
## 论点验证报告

> **原文段落**
> 「用户提交的完整原文段落」

### 论点 1: [一句话概括]

**验证状态**: ✅ 充分支持 | ⚠️ 部分支持 | ❌ 缺乏支持 | ⚡ 存在争议

| # | 级别 | 引文 | 关键证据 |
|---|------|------|----------|

每条文献附完整信息：
- DOI: https://doi.org/xxx
- URL: xxx
- 引用数: xx
```

### Search Strategy Guide

| 学科 | 优先数据源 |
|------|-----------|
| 通用/默认 | `search_semantic_scholar` → `paper_search` |
| 计算机科学 | `search_semantic_scholar` → `paper_search` |
| 生物医学 | `search_semantic_scholar` → `paper_search` |
| 交叉学科 | `paper_search`（多源搜索） |
