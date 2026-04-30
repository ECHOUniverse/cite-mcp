<p align="center">
  <h1 align="center">cite-mcp 📄</h1>
  <p align="center"><b>学术论文研究 MCP 服务器</b></p>
  <p align="center"><a href="README.md">🇬🇧 English</a></p>
</p>

<p align="center">
  <a href="#-什么是-mcp">什么是 MCP？</a> •
  <a href="#-功能特色">功能特色</a> •
  <a href="#-快速开始">快速开始</a> •
  <a href="#-配置说明">配置说明</a> •
  <a href="#-客户端配置">客户端配置</a> •
  <a href="#-工具列表">工具列表</a> •
  <a href="#-常见问题">常见问题</a>
</p>

---

## 🤔 什么是 MCP？

**MCP（Model Context Protocol，模型上下文协议）** 是 Anthropic 提出的开放协议，用于将 AI 助手（如 Claude）与外部工具和数据源连接起来。

可以把它理解为 **AI 的 USB-C 接口** —— 一套标准接口，让任何兼容 MCP 的 AI 客户端都能接入你的工具：

```
┌──────────────────┐       ┌───────────────────────┐
│   AI 助手         │ ◄─MCP─►  本 MCP 服务器        │
│  (Claude 等)      │       │  (cite-mcp)          │
└──────────────────┘       └───────────────────────┘
                                     │
                    ┌────────────────┼────────────────┐
                    ▼                ▼                ▼
             Semantic Scholar   OpenAlex          Crossref
             (2亿+ 论文)        (2.5亿+ 学术作品)   (1.5亿+ DOI 记录)
```

这个服务器提供 **学术论文研究能力** —— 跨数据库搜索论文、获取详细论文信息、发现相关论文、格式化引文 —— 全部通过自然语言对话完成。

---

## ✨ 功能特色

| 功能 | 数据源 | 说明 |
|------|--------|------|
| 🔍 **多源搜索** | Semantic Scholar + OpenAlex + Crossref | 聚合搜索，自动去重 |
| 📖 **论文详情** | 合并 3 个数据源 | 标题、作者、摘要、参考文献、引用数 |
| 🎯 **论文推荐** | Semantic Scholar | 基于已知论文发现相关文献 |
| 📊 **文献分析** | Semantic Scholar + OpenAlex + Crossref | 横向对比概览表 + 每篇文献总结和数据表 |
| 📝 **引文格式化** | — | APA 7th / MLA 9th / GB/T 7714-2015 / BibTeX |

---

## 🚀 快速开始

### 方式一：npx（推荐 — 无需安装）

```bash
npx cite-mcp
```

首次运行时 npm 会自动下载并缓存。然后在 MCP 客户端中配置：

```json
{
  "mcpServers": {
    "cite-mcp": {
      "command": "npx",
      "args": ["cite-mcp"]
    }
  }
}
```

> 💡 **API 密钥**: 如需更高调用频率，可设置环境变量 `S2_API_KEY`、`OPENALEX_MAILTO`、`CROSSREF_MAILTO`。详见 [配置说明](#-配置说明)。

### 方式二：全局安装

```bash
npm install -g cite-mcp
cite-mcp
```

MCP 客户端配置：

```json
{
  "mcpServers": {
    "cite-mcp": {
      "command": "cite-mcp",
      "args": []
    }
  }
}
```

### 方式三：从源码构建

<details>
<summary>点击展开 — 克隆仓库本地编译</summary>

### 环境要求

- **Node.js** ≥ 18（推荐 22+）
  - 检查版本：`node --version`
  - 下载地址：[nodejs.org](https://nodejs.org/)
- **npm**（安装 Node.js 时会自动附带）
  - 检查版本：`npm --version`

### 第一步：克隆 & 安装

```bash
# 克隆仓库
git clone https://github.com/ECHOUniverse/cite-mcp.git
cd cite-mcp

# 进入 MCP 服务器目录并安装依赖
cd mcp-server
npm install

# 编译 TypeScript 源码
npm run build
```

> ✅ **验证**: 编译后确认 `dist/index.js` 已生成。

### 第二步：配置环境变量（可选）

复制示例环境变量文件：

```bash
cp .env.example .env
```

编辑 `.env` 填入你的 API Key：

| 变量 | 必须？ | 作用 |
|------|--------|------|
| `S2_API_KEY` | 否 | 提升 Semantic Scholar 调用频率（见 [API Keys](#-api-keys)） |
| `OPENALEX_MAILTO` | 否 | 启用 OpenAlex 礼貌池（更高频率限制） |
| `CROSSREF_MAILTO` | 否 | 启用 Crossref 礼貌池（更高频率限制） |

**不配置任何 Key 也能正常使用**，默认频率限制对日常使用已经足够。

### 第三步：注册到 MCP 客户端

项目根目录提供了配置文件模板（`.mcp.json.example`），各客户端配置方式如下：

</details>

### MCP 客户端配置

<details>
<summary><b>Claude Code（命令行）</b></summary>

推荐使用 npx：

```json
{
  "mcpServers": {
    "cite-mcp": {
      "command": "npx",
      "args": ["cite-mcp"]
    }
  }
}
```

或全局安装：
```json
{
  "mcpServers": {
    "cite-mcp": {
      "command": "cite-mcp",
      "args": []
    }
  }
}
```

或本地构建：
```bash
cp .mcp.json.example .mcp.json
# 编辑 .mcp.json，将路径替换为你机器上的实际路径
```
</details>

<details>
<summary><b>Claude Desktop 桌面版</b></summary>

编辑 `claude_desktop_config.json`（通过 Claude Desktop → 设置 → 开发者 打开）：

```json
{
  "mcpServers": {
    "cite-mcp": {
      "command": "npx",
      "args": ["cite-mcp"]
    }
  }
}
```
</details>

<details>
<summary><b>Cursor / Windsurf / 其他 MCP 客户端</b></summary>

| 字段 | 值 |
|------|-----|
| 命令 (Command) | `npx` |
| 参数 (Arguments) | `["cite-mcp"]` |
</details>

<details>
<summary><b>VS Code（GitHub Copilot + MCP）</b></summary>

需要 VS Code Insiders。在 VS Code 设置 (`settings.json`) 中配置：

```json
{
  "github.copilot.advanced": {
    "mcpServers": {
      "cite-mcp": {
        "command": "npx",
        "args": ["cite-mcp"]
      }
    }
  }
}
```
</details>

### 第四步：试试看！

配置完成后，直接对你的 AI 助手说：

> *"帮我搜索 transformer attention mechanism 相关的论文"*
> *"查看 DOI 为 10.1000/xyz123 的论文详情"*
> *"推荐与这篇论文相关的研究"*
> *"用 APA 格式格式化这篇论文的引用"*

---

## 🔧 配置说明

### API Keys

API Keys **完全可选**。不配置也能正常使用，只是频率限制较低。

| 服务 | 环境变量 | 获取方式 | 好处 |
|------|---------|---------|------|
| **Semantic Scholar** | `S2_API_KEY` | [申请地址](https://www.semanticscholar.org/product/api) | 100 请求/秒（无 Key 仅 1 请求/秒） |
| **OpenAlex** | `OPENALEX_MAILTO` | 填写你的邮箱即可 | 礼貌池，约快 10 倍 |
| **Crossref** | `CROSSREF_MAILTO` | 填写你的邮箱即可 | 礼貌池，约快 10 倍 |

配置方式：

```bash
# 方式 A：写入 .env 文件（服务器自动加载）
echo "S2_API_KEY=你的密钥" >> .env
echo "OPENALEX_MAILTO=你的@邮箱.com" >> .env
echo "CROSSREF_MAILTO=你的@邮箱.com" >> .env

# 方式 B：导出为环境变量
export S2_API_KEY="你的密钥"
export OPENALEX_MAILTO="你的@邮箱.com"
export CROSSREF_MAILTO="你的@邮箱.com"
```

### `.env` 文件加载机制

服务器会按以下顺序自动搜索 `.env` 文件：
1. `mcp-server/` 目录（项目内部）
2. 当前工作目录

将 `.env` 放在任一位置即可。该文件已在 `.gitignore` 中，不会误提交你的密钥。

---

## 🛠️ 工具列表

### 搜索工具

| 工具 | 推荐场景 | 数据源 | 数量限制 |
|------|---------|--------|---------|
| `paper_search` | **大多数用户的首选** | S2 → OA → CR（自动回退） | 默认 10 |
| `search_semantic_scholar` | 计算机/AI/NLP 论文；高级查询语法 | 仅 S2 | 最大 100 |
| `search_openalex` | 跨学科广泛搜索 | 仅 OA | 最大 50 |
| `search_crossref` | 查找 DOI 元数据 | 仅 CR | 最大 50 |

**Semantic Scholar 高级查询语法：**

| 语法 | 示例 | 效果 |
|------|------|------|
| `AND` | `transformer AND attention` | 两个词都必须出现 |
| `OR` | `climate OR warming` | 任一词语即可 |
| `NOT` | `GPT NOT chatgpt` | 排除某个词 |
| `"..."` | `"attention mechanism"` | 精确短语匹配 |
| `neuro*` | `neuro*` | 前缀匹配（neural, neuroscience...） |
| `title:` | `title:transformer` | 仅在标题中搜索 |

### 分析工具

| 工具 | 说明 |
|------|------|
| `paper_analysis` | 搜索指定数量的文献，返回横向对比概览表 + 每篇文献的总结和数据性能表。适合快速文献综述。 |

### 详情工具

| 工具 | 输入 | 输出 |
|------|------|------|
| `paper_detail` | DOI | 合并 3 个数据源的详情 + 参考文献 |
| `get_by_s2id` | S2 Paper ID | Semantic Scholar 详情 |
| `get_by_s2ids_batch` | S2 Paper ID 数组 | 批量详情（最多 500 个） |

### 推荐 & 引文工具

| 工具 | 说明 |
|------|------|
| `paper_recommendations` | 通过 S2 推荐引擎发现相关论文 |
| `citation` | 格式化：APA / MLA / GB/T 7714-2015 / BibTeX |

---

## ❓ 常见问题

<details>
<summary><b>不配置 API Key 能用吗？</b></summary>
<b>完全可以。</b>三个 API（Semantic Scholar、OpenAlex、Crossref）都有免费额度。无 Key 时频率较低，但日常使用完全足够。
</details>

<details>
<summary><b>"node" 命令找不到怎么办？</b></summary>
确保 Node.js 已安装并在 PATH 中：

```bash
# 查找 node 安装位置
which node
# 如果未找到，从 https://nodejs.org/ 安装或使用 nvm：
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.4/install.sh | bash
nvm install 22
```
</details>

<details>
<summary><b>如何参与贡献？</b></summary>
欢迎提交 PR！重大变更请先提 issue 讨论。
</details>

<details>
<summary><b>工具在我的 AI 客户端中不显示</b></summary>
请尝试以下步骤：
1. 完全重启你的 AI 客户端
2. 确认服务器路径使用的是**绝对路径**且正确无误
3. 直接运行 `node /绝对路径/mcp-server/dist/index.js` 检查是否有报错
4. 确认 `npm run build` 已成功执行
</details>

<details>
<summary><b>如何更新？</b></summary>

**npm 更新**（推荐 — npx 或全局安装用户）：
```bash
npm install -g cite-mcp@latest
```

**Git 拉取**（本地构建用户）：
```bash
git pull
cd mcp-server
npm install
npm run build
```
然后重启你的 AI 客户端。
</details>

---

## 📄 许可证

MIT
