# cite-mcp env 加载优先级改进

## 目标

调整 `config.ts` 中 `.env` 文件的查找策略，使其支持全局 env + 项目 env 的级联加载，同时保证 MCP 配置中的 `env` 字段始终为最高优先级。

## 现状分析

### 当前 `loadEnv()` 逻辑 (`mcp-server/src/config.ts`)

```typescript
function loadEnv() {
  const candidates = [
    resolve(dirname(__dirname), ".env"),   // 项目根目录 .env
    resolve(process.cwd(), ".env"),         // cwd .env
  ]
  for (const envPath of candidates) {
    if (existsSync(envPath)) {
      // ... 逐行解析 .env，写入 process.env（不覆盖已有值）
      break  // ⚠️ 找到第一个就停止，不会继续查找后续候选
    }
  }
}
```

### 关键机制

- 第 22 行 `process.env[key] === undefined` — 只设置尚未定义的变量，**已存在的 process.env 不会被覆盖**。这意味着 MCP 配置中通过 `env` 字段注入的变量天然具有最高优先级。
- `break` — 找到第一个存在的文件就停止，导致无法同时加载全局和项目 .env。

### 问题

1. **没有全局 .env**：用户无法在 `~/.cite-mcp.env` 中配置一次 API key 供所有项目使用
2. **`break` 阻止级联加载**：找到项目 .env 后就不再搜索全局 .env，反之亦然

## 修改方案

### 单一文件修改：`mcp-server/src/config.ts`

#### 改动 1：添加 `os.homedir()` 的全局 .env 路径

在 candidates 数组**最前面**加入 `~/.cite-mcp.env`：

```typescript
import { homedir } from "os"

const candidates = [
  resolve(homedir(), ".cite-mcp.env"),      // 全局（用户级，新增）
  resolve(dirname(__dirname), ".env"),       // 项目根目录 .env
  resolve(process.cwd(), ".env"),            // cwd .env
]
```

优先级：**MCP config env > ~/.cite-mcp.env > 项目 .env > cwd .env**

> 因为 `process.env[key] === undefined` 保证先被设置的不会被后覆盖，所以全局放在最前面，项目的放在后面仅补充缺失的变量。

#### 改动 2：移除 `break`

将 `break` 删除，让循环遍历所有候选人。每个文件独立 `process.env` 注入，不存在的键才写入，所以多个 .env 文件不会互相覆盖。

修改后的 `loadEnv()` 函数：

```typescript
function loadEnv() {
  const candidates = [
    resolve(homedir(), ".cite-mcp.env"),
    resolve(dirname(__dirname), ".env"),
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
      // 不再 break，继续加载后续候选文件以补充缺失变量
    }
  }
}
```

同时需要新增 `import { homedir } from "os"`。

### 不修改的文件

- `.env.example` — 无需改动
- `index.ts` — 无需改动（只是 `import "./config.js"`）
- `package.json` — 无需改动

## 优先级总览

以 `S2_API_KEY` 为例：

| 优先级 | 来源 | 示例 |
|--------|------|------|
| 1 (最高) | MCP 配置 `env` 字段 | Trae IDE MCP config 中注入 |
| 2 | `~/.cite-mcp.env` | 用户全局配置 |
| 3 | `mcp-server/.env` | 项目根目录 |
| 4 (最低) | `cwd/.env` | 启动工作目录 |

## 验证

1. `npm run build` — 编译通过
2. 创建 `~/.cite-mcp.env` 写入 `S2_API_KEY=test_global`，确认 `process.env.S2_API_KEY` 被正确读取
3. 在 MCP 配置中通过 `env` 注入不同的值，确认不会被 .env 覆盖
4. `npm test` — 已有测试全部通过（不涉及 config.ts 的纯函数单元测试）
