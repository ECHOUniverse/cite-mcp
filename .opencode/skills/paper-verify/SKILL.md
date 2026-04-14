---
name: paper-verify
description: 验证论文段落论点。从段落提取学术主张，搜索文献证据（含争议检测），输出结构化验证报告与标准引文。
---

# Skill: paper-verify

从用户提供的论文段落中提取可验证论点，搜索学术文献进行支持/反驳验证，输出结构化报告。

## 触发条件

当用户提供论文段落并要求验证论点、查找支持文献、寻找引用时触发。

常见触发语：「验证这段」「找引用」「这段论点有文献支持吗」「帮我找 supporting evidence」

## 可用工具

| 工具名 | 用途 |
|--------|------|
| `paper-search` (default export) | 多源聚合搜索。优先 Semantic Scholar，结果不足时补充 OpenAlex + Crossref |
| `paper-search_search_semantic` | 单独搜索 Semantic Scholar（支持 AND/OR/短语/否定等高级语法） |
| `paper-search_search_openalex` | 单独搜索 OpenAlex |
| `paper-search_search_crossref` | 单独搜索 Crossref |
| `paper-detail` (default export) | 通过 DOI 获取论文完整详情 |
| `paper-detail_get_by_doi` | 通过 DOI 获取论文详情（独立接口） |
| `paper-detail_get_by_s2id` | 通过 Semantic Scholar Paper ID 获取论文详情 |
| `paper-detail_get_by_s2ids_batch` | 批量通过 S2 Paper ID 获取论文详情（最多500个） |
| `paper-recommendations` (default export) | 基于已知 S2 Paper ID 获取相关推荐论文 |
| `paper-recommendations_for_paper` | 基于已知 S2 Paper ID 获取相关推荐论文（独立接口） |
| `citation` | 格式化学术引文（APA/MLA/GB7714/BibTeX） |

## 工作流程

### Step 1: 论点提取

从用户段落中提取 N 个可验证的学术主张（N 默认为 3，用户可指定）。

**提取规则**：
- 只提取**可证伪**的学术主张（有明确研究主体、可在学术数据库中找到对应文献）
- 排除：背景描述、方法论说明、未来工作、常识性陈述
- 每个论点用一句话概括核心断言
- 将论点翻译为英文关键词以便搜索

**示例**：
> 原文：「研究结果表明，基于Transformer的模型在低资源语言任务上的表现显著优于传统RNN架构（Smith et al., 2022）。此外，数据增强策略可以将训练效率提升30%以上。」

提取为：
1. 「基于Transformer的模型在低资源语言任务上显著优于RNN架构」→ 关键词: `Transformer vs RNN low-resource language`
2. 「数据增强策略可以将训练效率提升30%以上」→ 关键词: `data augmentation training efficiency improvement`

### Step 2: 文献搜索

对每个论点执行**两组搜索**：

#### 2a. 正向搜索（找支持文献）

- 优先使用 `paper-search_search_semantic`（Semantic Scholar 单源搜索，支持高级查询语法）
- 搜索关键词：论点核心概念的**英文**关键词
- 若结果不足（<3篇），补充使用 `paper-search`（多源聚合搜索）或 `paper-search_search_openalex` 单源搜索
- 每个论点搜索 1-2 次，使用不同的关键词组合

#### 2b. 反向搜索（争议检测）

对同一论点，追加包含否定/质疑性关键词的搜索：
- 使用 `paper-search` 搜索：`论点关键词 + limitations/challenge/refute/contradict`
- 若发现潜在反驳文献，使用 `paper-detail` 获取完整摘要以确认

### Step 3: 验证与分级

#### 3a. 阅读验证

对搜索结果中的候选文献，使用 `paper-detail` 获取完整信息：
- 确认文献**确实支持或反驳**该论点
- **禁止仅凭标题匹配就判定相关性**，必须阅读摘要确认
- 提取文献中直接支持/反驳的关键信息

#### 3b. 证据分级

| 级别 | 标准 |
|------|------|
| **A级** | 摘要明确验证论点，且为论文核心贡献 |
| **B级** | 论文涉及该方向，但非主要结论 |
| **C级** | 主题相关，但无直接证据 |

每个论点至少需要 1 篇 A 级或 2 篇 B 级证据。不足时标记为「缺乏直接支持」。

#### 3c. 争议标记

若反向搜索找到强相关反驳文献：
- 标记该论点为「存在学术争议」
- 同时列出支持方和反对方最高质量文献各 1 篇

#### 3d. 格式化引文

对验证通过的文献，调用 `citation` 工具生成格式化引文。

调用方式：
```
citation({
  authors: "Smith, J.; Doe, A.",
  title: "Paper Title",
  year: 2022,
  venue: "Nature",
  doi: "10.1038/xxx",
  style: "apa"
})
```

默认使用 APA 格式，用户可指定其他格式（mla, gb7714, bibtex）。

### Step 4: 输出报告

严格按以下格式输出，每个论点独立一个区块。使用 Markdown 表格和引用块提升可读性。

---

```
## 论点验证报告

> **原文段落**
> 「用户提交的完整原文段落，逐字保留」

---

### 论点 1: [一句话概括]

> **原文引用**: 「原文中支撑此论点的关键句子，逐字引用」

**验证状态**: ✅ 充分支持 | ⚠️ 部分支持 | ❌ 缺乏支持 | ⚡ 存在争议

| # | 级别 | 引文 | 关键证据 |
|---|------|------|----------|
| 1 | A | [APA格式引文] | 摘要/结论中直接支持的原句摘要 |
| 2 | B | [APA格式引文] | 相关但非核心结论的描述 |

每条文献附完整信息：
- DOI: https://doi.org/xxx
- URL: xxx（可点击链接）
- 引用数: xx

**争议/反驳文献**（如有）:

| # | 级别 | 引文 | 反驳要点 |
|---|------|------|----------|
| 1 | A/B | [APA格式引文] | 反驳的核心论据 |

---

### 论点 2: ...

---

## 证据分级说明

| 级别 | 标准 | 说明 |
|------|------|------|
| **A级** | 摘要明确验证论点，且为论文核心贡献 | 论文的主要发现直接支持/反驳该论点 |
| **B级** | 论文涉及该方向，但非主要结论 | 研究主题相关，部分结果支持，但论点非论文核心 |
| **C级** | 主题相关，但无直接证据 | 仅在背景/引言中提及，无实验或分析数据支撑 |

**判定规则**:
- 每个论点至少需要 1 篇 A 级或 2 篇 B 级证据，否则标记为「❌ 缺乏直接支持」
- A级证据优先列出；同级别按引用数降序排列
- 预印本标注 ⚡「此为预印本，建议核查正式发表版本」
```

## 搜索策略指南

| 学科 | 优先数据源 |
|------|-----------|
| 通用/默认 | `paper-search_search_semantic` → `paper-search` |
| 计算机科学 | `paper-search_search_semantic` → `paper-search` |
| 生物医学 | `paper-search_search_semantic` (PubMed 索引) → `paper-search` |
| 交叉学科 | `paper-search`（多源搜索） |

## 注意事项

- `paper-search` 是多源聚合工具，内部已做去重和错误处理，推荐优先使用
- Semantic Scholar 建议配置 `S2_API_KEY` 环境变量以避免 rate limit
- 预印本（arXiv/bioRxiv/medRxiv）需标注「此为预印本，建议核查正式发表版本」
- 论点数量用户可指定（1-5），默认 3 个
- 所有搜索关键词应使用**英文**，以获得最佳结果