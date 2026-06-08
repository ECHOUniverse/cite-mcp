# GitHub Actions 自动发布 npm 工作流计划

## 概述

创建 GitHub Actions 工作流，实现推送 tag 时自动构建、测试并发布到 npm registry。

## 当前状态分析

- **项目结构**: `package.json` 在 `mcp-server/` 子目录下，仓库根目录无 `package.json`
- **无现有 CI/CD**: `.github/workflows/` 目录不存在
- **`prepublishOnly` 已配置**: 发布前自动执行 `npm run build`
- **发布文件范围**: `"files": ["dist/", "bin/"]` 已在 `package.json` 中定义
- **`.npmrc` 已 gitignore**: 不能将 npm token 写入文件，需用 GitHub Secrets 环境变量注入
- **Node.js 要求**: `>= 18.0.0`
- **测试命令**: `node --import tsx --test src/__tests__/*.test.ts`
- **仓库**: `ECHOUniverse/cite-mcp`

## 设计方案

### 触发条件

推送以 `v` 开头的 tag（如 `v2.3.0`）时触发。

### 工作流步骤

1. Checkout 代码
2. 设置 Node.js (版本 >= 18，使用 LTS)
3. 在 `mcp-server/` 目录安装依赖 (`npm ci`)
4. 运行测试 (`npm test`)
5. 发布到 npm (`npm publish`)，通过 `NODE_AUTH_TOKEN` 环境变量注入 GitHub Secret 中的 npm token

### 需要用户准备的事项

- 在 npm 官网生成 Automation Token（用于 CI/CD 自动发布，不需要 2FA）
- 在 GitHub 仓库 Settings → Secrets and variables → Actions 中添加 `NPM_TOKEN`

## 文件变更

### 新建: `.github/workflows/publish.yml`

```yaml
name: Publish to npm

on:
  push:
    tags:
      - 'v*'

jobs:
  publish:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: mcp-server
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          registry-url: 'https://registry.npmjs.org'
      - run: npm ci
      - run: npm test
      - run: npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### 工作流说明

| 关键设计 | 理由 |
|---|---|
| `defaults.run.working-directory: mcp-server` | 所有 `run` 步骤自动在 `mcp-server/` 执行，无需 `cd` |
| `node-version: '22'` | GitHub Actions 当前支持的最新稳定版本，满足 `>= 18` 要求 |
| `npm ci` 而非 `npm install` | 严格按 `package-lock.json` 安装，CI 环境标准做法 |
| `npm publish` 依赖 `prepublishOnly` | `prepublishOnly` 已配置 `npm run build`，无需手动调 `tsc` |
| `NODE_AUTH_TOKEN` 环境变量 | `setup-node` 会自动配置 `.npmrc` 读取此变量 |
| tag 触发 | 推 tag 语义明确，避免每次 push main 都发布新版本 |

## 假设与决定

1. **发布触发方式**: 使用 tag 触发（`v*`），而非 push main 自动发布。这样开发者可以控制何时发布新版本
2. **npm token 类型**: 使用 Automation Token（不需要 2FA），适合 CI/CD 场景
3. **测试必须通过**: 测试失败则阻止发布，确保只发布通过测试的代码
4. **无需额外 `.npmrc`**: `setup-node` action 的 `registry-url` 参数会自动生成临时 `.npmrc`
5. **运行环境**: `ubuntu-latest`（标准选择，最快启动）

## 验证步骤

1. 工作流文件创建后，确认 `.github/workflows/publish.yml` 存在
2. 在 GitHub 仓库设置中添加 `NPM_TOKEN` secret
3. 推送一个 tag（如 `v2.3.0`）触发工作流
4. 在 GitHub Actions 页面观察工作流执行结果
5. 确认 npm 上包版本已更新
