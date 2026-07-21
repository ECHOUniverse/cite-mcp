# 中山大学朱升财论文查询报告 & cite-mcp 运行检查报告

- 查询日期：2026-07-21
- 查询工具：cite-mcp（本仓库 MCP server，9 工具）
- 诊断手段：cite-mcp 工具调用 + 三大学术 API 直连对照（curl）

---

## 第一部分：论文查询报告

### 1.1 作者画像（来自 `author_search`，OpenAlex 数据源）

| 项目 | 内容 |
|---|---|
| 姓名 | Shengcai Zhu（朱升财） |
| 机构 | Sun Yat-sen University（中山大学） |
| OpenAlex ID | [A5086183426](https://openalex.org/A5086183426) |
| 论文数 | 72 |
| 总被引 | 1608 |
| h 指数 | 20 |
| 研究方向（据论文主题归纳） | 计算材料学 / 第一性原理（DFT）：钙钛矿太阳能电池、高压相变与金刚石合成、锂电/燃料电池材料、光催化 TiO₂ 异相结、晶体结构预测 |

### 1.2 代表论文（按被引排序，Top 10）

由 `citation` 工具（Elsevier 风格，报告模式）生成，三段式输出如下：

#### 正文引用

[1], [2], [3], [4], [5], [6], [7], [8], [9], [10]

#### 参考文献

[1] Li, Y., Zhu, S., and Liu, Z.-P., Reaction Network of Layer-to-Tunnel Transition of MnO2, Journal of the American Chemical Society, vol. 138, no. 16, 2016. https://doi.org/10.1021/jacs.6b01768

[2] Tang, M., Yang, J., Chen, N., Zhu, S., Wang, X., Wang, T., Zhang, C., and Xia, Y., Overall structural modification of a layered Ni-rich cathode for enhanced cycling stability and rate capability at high voltage, Journal of Materials Chemistry A, vol. 7, no. 11, 2019. https://doi.org/10.1039/c8ta12494a

[3] Zhu, S., Xie, S., and Liu, Z.-P., Nature of Rutile Nuclei in Anatase-to-Rutile Phase Transition, Journal of the American Chemical Society, vol. 137, no. 35, 2015. https://doi.org/10.1021/jacs.5b07734

[4] Chen, T., Xie, J., Wen, B., Yin, Q., Lin, R., Zhu, S., and Gao, P., Inhibition of defect-induced α-to-δ phase transition for efficient and stable formamidinium perovskite solar cells, Nature Communications, vol. 14, no. 1, 2023. https://doi.org/10.1038/s41467-023-41853-y

[5] Zhao, W., Zhu, S., Li, Y., and Liu, Z.-P., Three-phase junction for modulating electron–hole migration in anatase–rutile photocatalysts, Chemical Science, vol. 6, no. 6, 2015. https://doi.org/10.1039/c5sc00621j

[6] Zhu, S., Yan, X., Liu, J., Oganov, A.R., and Zhu, Q., A Revisited Mechanism of the Graphite-to-Diamond Transition at High Temperature, Matter, vol. 3, no. 3, 2020. https://doi.org/10.1016/j.matt.2020.05.013

[7] Tan, M., Shtukenberg, A.G., Zhu, S., Xu, W., Dooryhée, E., Nichols, S.M., Ward, M.D., Kahr, B., and Zhu, Q., ROY revisited, again: the eighth solved structure, Faraday Discussions, vol. 211, no. 0, 2018. https://doi.org/10.1039/c8fd00039e

[8] Zhou, X., Liu, L., Zhen, J., Zhu, S., Li, B., Sun, K., and Wang, P., Ionic conductivity, sintering and thermal expansion behaviors of mixed ion conductor BaZr0.1Ce0.7Y0.1Yb0.1O3−δ prepared by ethylene diamine tetraacetic acid assisted glycine nitrate process, Journal of Power Sources, vol. 196, no. 11, 2011. https://doi.org/10.1016/j.jpowsour.2011.01.092

[9] Zuo, S., Zhu, S., Wang, J., Liu, W., and Wang, J., Boosting Fenton-like reaction efficiency by co-construction of the adsorption and reactive sites on N/O co-doped carbon, Applied Catalysis B: Environmental, vol. 301, 2021. https://doi.org/10.1016/j.apcatb.2021.120783

[10] Le, S., Zhu, S., Zhu, X., and Sun, K., Densification of Sm0.2Ce0.8O1.9 with the addition of lithium oxide as sintering aid, Journal of Power Sources, vol. 222, 2012. https://doi.org/10.1016/j.jpowsour.2012.08.020

#### 引文说明

| 引文序号 | 标题 | 网址 | 引文说明内容 |
|----------|------|------|--------------|
| [1] | Reaction Network of Layer-to-Tunnel Transition of MnO2 | https://doi.org/10.1021/jacs.6b01768 | 被引165次，MnO₂层状-隧道结构转变反应网络（计算材料学代表作） |
| [2] | Overall structural modification of a layered Ni-rich cathode… | https://doi.org/10.1039/c8ta12494a | 被引153次，富镍层状正极整体结构改性 |
| [3] | Nature of Rutile Nuclei in Anatase-to-Rutile Phase Transition | https://doi.org/10.1021/jacs.5b07734 | 被引128次，锐钛矿-金红石相变成核本质（第一作者） |
| [4] | Inhibition of defect-induced α-to-δ phase transition… | https://doi.org/10.1038/s41467-023-41853-y | 被引97次，甲脒钙钛矿太阳能电池，效率25.39%（认证24.92%） |
| [5] | Three-phase junction for modulating electron–hole migration… | https://doi.org/10.1039/c5sc00621j | 被引95次，三相结调控光催化载流子迁移 |
| [6] | A Revisited Mechanism of the Graphite-to-Diamond Transition… | https://doi.org/10.1016/j.matt.2020.05.013 | 被引88次，石墨-金刚石高温转变机理（第一作者） |
| [7] | ROY revisited, again: the eighth solved structure | https://doi.org/10.1039/c8fd00039e | 被引72次，ROY 晶体第八个结构解析 |
| [8] | Ionic conductivity, sintering and thermal expansion… | https://doi.org/10.1016/j.jpowsour.2011.01.092 | 被引62次，混合离子导体（固体氧化物燃料电池电解质） |
| [9] | Boosting Fenton-like reaction efficiency… | https://doi.org/10.1016/j.apcatb.2021.120783 | 被引51次，N/O 共掺杂碳类芬顿催化 |
| [10] | Densification of Sm0.2Ce0.8O1.9… | https://doi.org/10.1016/j.jpowsour.2012.08.020 | 被引50次，氧化锂助烧致密化 |

### 1.3 单篇详情抽查（`paper_detail`，DOI: 10.1038/s41467-023-41853-y）

- 题名、作者、年份、期刊、DOI/URL 均完整；引用数 99（Crossref 口径，OpenAlex 为 97，属正常的源间差异）。
- 摘要完整（但残留 JATS 标签，见问题 P5）。
- 参考文献区块完整返回前 10 条（含 DOI）。
- "其他数据源补充信息"区块为空（因 S2 通道故障，见问题 P1）。

---

## 第二部分：cite-mcp 运行检查报告

### 2.1 测试矩阵

| # | 工具调用 | 耗时 | 结果 | 状态 |
|---|---|---|---|---|
| 1 | `author_search` "Shengcai Zhu" (source=all) | 29.4 s | 3 条，第 1 条即目标作者（全部来自 OpenAlex） | ✅ 可用（S2 静默缺席） |
| 2 | `paper_search` "Shengcai Zhu" + context (source=all, limit=20) | 75.6 s | 20 条仅 1 条相关 | ⚠️ 相关性差 |
| 3 | `paper_search` "Shengcai Zhu perovskite" (source=s2) | ≈45.6 s（与 #4 并行） | "未找到相关论文" | ❌ S2 通道故障 |
| 4 | `paper_detail` DOI=10.1038/s41467-023-41853-y | 同上 | 详情+参考文献完整 | ✅ 可用 |
| 5 | `paper_search` "perovskite solar cells" (source=s2) | ≈152.4 s（与 #6 并行） | "未找到相关论文"（热门词同样无结果） | ❌ 确认 S2 通道整体故障 |
| 6 | `paper_search` "Shengcai Zhu" (source=openalex, limit=10) | 同上 | 10 条仅 1 条相关 | ⚠️ 相关性差 |
| 7 | `citation` 报告模式（10 篇 papers） | 58.0 s | 三段式报告完整生成 | ✅ 可用（页码缺失，见 P6） |
| — | S2 API 直连（无 key） | 1.1 s | HTTP 429 Too Many Requests | 共享池限流 |
| — | S2 API 直连（用 .env 中的 key） | 0.9 s | HTTP 403 Forbidden | **key 无效** |
| — | OpenAlex / Crossref 直连 | 2.0 / 6.9 s | HTTP 200 | 正常 |

### 2.2 确认的问题（按严重度排序）

- **P0 — S2 通道整体不可用，根因是 API key 无效。** `.env` 中 `S2_API_KEY` 已配置（40 位），但带 key 请求返回 403 Forbidden（key 失效/错误）；无 key 走共享池则 429 限流。影响范围：所有 S2 参与的功能——`paper_search`(s2/all)、`cite_text`（S2-first 策略失效，只能走 OA/CR 兜底）、`paper_recommendations`（纯 S2 引擎，预期完全不可用）、`author_search`/`paper_detail` 的 S2 补充数据。
- **P1 — 故障被静默吞掉，输出具有误导性。** 指定 `source=s2` 搜索时，S2 请求失败被降级为"未找到相关论文"，用户无法区分"真的没有"和"通道坏了"；`source=all` 时结果中也没有任何"S2 缺席"提示。这违反项目自身的约束 4（"Invalid input returns isError: true, never silent failure"）之精神——输入有效但上游故障时同样不应静默。
- **P1 — `paper_search` 无法按作者查论文。** 按作者名搜索相关性极差（命中 1/20、1/10），大量无关结果混入。工具未暴露 OpenAlex 的 `author.id` 过滤参数，"查某作者的论文"这一常见需求只能靠 `author_search` 拿到作者 ID 后绕开 MCP 直连 API 补全（本次查询即如此）。
- **P2 — 响应普遍偏慢（29–152 s）。** S2 故障时的 2 次重试+指数退避进一步拉长延迟（#5/#6 批次 152 s）。Crossref 直连本身也需 ~7 s。
- **P2 — `paper_detail` 的"其他数据源补充信息"区块为空。** 源间补充（S2 tldr 等）因 P0 失败，输出保留了一个空标题区块，应省略或标注原因。
- **P3 — `citation` 参考文献缺页码。** 传入的 `first_page`/`last_page` 未被采用（工具只认 `pages` 字段），Elsevier 条目缺 "pp. xxxx–xxxx"。
- **P3 — Crossref 摘要残留 JATS 标签。** `<jats:p>`、`<jats:title>` 原样出现在输出中（`paper_detail`、部分 `paper_search` 条目），未做标签清洗。

### 2.3 运行良好项

- **DOI/URL 强制输出约束 100% 遵守**：所有工具的每条论文结果均含 DOI 与 URL（设计约束 1）。
- **降级路径基本可用**：S2 故障时 `author_search`（OpenAlex）、`paper_detail`（Crossref）、`citation`（内部格式化）均正常返回。
- **三段式报告结构正确**（设计约束 2）：正文引用 → 参考文献 → 引文说明，完整无合并。
- **作者消歧可用**：`author_search` 第 1 条即命中目标作者，并给出 OpenAlex ID，可据此做精确对照（本次以 OpenAlex 作者 ID 直下 72 篇论文作为召回基准验证）。
- 错误信息未见泄露 API key 或本地路径（脱敏约束 8 在本次会话中未触发异常样本）。

### 2.4 修复建议（按优先级）

1. 更换/重新申请有效的 `S2_API_KEY`（https://www.semanticscholar.org/product/api#api-key-form），或暂时在配置缺失/失效时于 server 启动日志中给出醒目告警。
2. `paper_search` 在指定源请求失败时返回 `isError: true` + 明确错误信息（如 "Semantic Scholar 请求失败：403"），不要降级为"未找到相关论文"；`source=all` 时在结果末尾附加源可用性说明。
3. `paper_search`（或新工具）支持 OpenAlex `author.id` 过滤，打通"查作者论文"路径。
4. 清洗 Crossref 摘要中的 JATS 标签；`paper_detail` 补充区块为空时省略标题。
5. `citation` 支持 `first_page`/`last_page` 或文档中明确只接受 `pages`。
6. 考虑对 S2 的 429/403 减少重试次数（该类错误重试无益），降低故障时的延迟放大。
