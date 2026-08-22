# AGENTS.md

> 本文件是 AI 代理与人类协作者的统一入口。所有自动化技能（spec/triage/tickets/wayfinder 等）均以此为准。

## Agent skills

### Issue tracker

Issues and specs live as local markdown under `.scratch/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Five canonical roles mapped to `needs-triage / needs-info / ready-for-agent / ready-for-human / wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout. See `docs/agents/domain.md`. Glossary: `CONTEXT.md` (待建)；ADRs: `docs/adr/`。

## 项目速览

Life Patch Diary — 本地私人日记。把每天 3-10 句随手记生成 Steam 风格版本更新公告卡。**数据仅存本机**（`wrangler D1` 本地 SQLite + `localStorage` 草稿），仅生成时联网调 LLM。

五页：今日（生成+重 roll）/ 历史（按月分组）/ 月报（Major Release 聚合）/ 备份（JSON 导入导出）/ 设置（OpenAI 兼容 Base URL/key/模型/温度/推理开关/extra）。

## 红线（必读）

- **永远不要 `wrangler deploy` 或以任何形式暴露到公网** — 无口令，任何人可烧你的 API Key；Key 明文存本地 D1 仅在 localhost 前提下安全。`package.json` 已移除 deploy 脚本，CI 也不得添加。
- `/.dev.vars`（含 `OPENROUTER_KEY`）已在 `.gitignore`，禁止提交；本地 Key 泄露需立即轮换。
- 同天覆盖语义：同 `date` 仅保留一条，版本号 `vYY.M.D[.N]` 递增（见 `src/lib/dates.ts` / `worker/index.ts`）。

## 本地运行

```bash
npm install
# 若提示 optionalDependencies 权限/缺包：rm -rf node_modules package-lock.json && npm install
npx wrangler d1 execute DB --local --file schema.sql
npm run build        # tsc --noEmit + vite build
npm run dev:full     # wrangler dev :8787
npm run dev          # 另终端 vite :5173 已代理 /api -> 8787
npm test             # vitest run
```

数据库文件：`.wrangler/state/v3/d1/.../db.sqlite`；浏览器草稿：`localStorage:lpn_draft`。

## 目录约定

- `worker/` — Cloudflare Worker（仅本地运行时）+ `worker/lib.ts`（LLM 配置/清洗/校验）
- `src/schema.ts` — PatchData/SectionType/StatKey 单一真源
- `src/lib/{monthly,dates,text,browser}` — 纯函数域逻辑
- `src/views/` — 页面级容器；`src/components/reactbits/` — 动效（卡内零动效保截图）
- `.scratch/<feature>/` — spec 与 tickets（本地 issue tracker）

## 测试与校验

- 优先缝：`worker fetch` HTTP 缝（`POST /api/*`）+ 纯函数缝 `parsePatchData/aggregateMonth/resolveConfig/sanitizeLooseJson`。详见各 spec 的 Testing Decisions。
- 提交前必跑：`npm test` 与 `npm run build` 均绿；截图导出需手动验证 `html2canvas-pro` 不跨域。
- 新增域逻辑必须补单测，只测外部行为不测实现细节。

## 分支与提交

- 单 feature 一分支，`git diff <base>...HEAD` 为审查基准；spec/ticket 均落 `.scratch/`。
- 提交信息引用 ticket（如 `Closes #01`），中英皆可但保持“做了什么+为什么”。
