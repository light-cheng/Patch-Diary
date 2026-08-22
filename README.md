# Life Patch Diary

把你每天随手写的几句话，变成一份游戏版本更新公告——**本地私人日记版**。

数据全部存在你自己的电脑里（SQLite 文件），没有账号、没有服务器、没有口令。
只有「生成」那一刻需要联网调用 LLM，其余一切都在 localhost。

---

## 快速开始

前置：安装 [Node.js](https://nodejs.org/) ≥ 20（Windows / macOS / Linux 均可）。

```bash
# 1. 安装依赖（国内网络可加 --registry=https://registry.npmmirror.com）
npm install
#    若 npm 提示 install scripts 被拦截，执行一次：
#    npm install-scripts approve esbuild workerd && npm rebuild esbuild workerd

# 2. 初始化本地数据库（只需一次）
npx wrangler d1 execute DB --local --file schema.sql

# 3. 构建 + 启动
npm run build
npm run dev:full
```

打开 **http://localhost:8787** ，第一次去「设置」页配置 API Key（见下文），然后就能用了。

> 开发模式热更新：另开一个终端跑 `npm run dev`（Vite :5173，已代理 `/api` 到 8787）。

## 首次配置 API Key

**key 只由你本人写入**，两种方式任选：

- **推荐**：启动后进入「设置」页，粘贴 key → 点「保存设置」→ 点「测试连接」确认绿灯。key 存在本机数据库里，页面永远只显示打码版（如 `sk-or-v1…1042`）。
- 或者手动编辑项目根目录的 `.dev.vars` 写一行 `OPENROUTER_KEY=sk-你的key`（此文件已在 .gitignore 中，不会被提交）。

默认走 OpenRouter + `stealth/ox-alpha`（免费模型）。想换 DeepSeek / DashScope 等 OpenAI 兼容服务商，在设置页改 Base URL、模型、key 三项即可，无需动代码。

## 五个页面

| 页面 | 干什么 |
|---|---|
| **今日** | 写下今天 3–10 句事 → 生成 Steam 风更新公告卡。[更毒舌][更像游戏] 可叠层重 roll；生成成功自动存入日记 |
| **历史** | 按月分组的所有日记，点开看原卡，可重新截图/复制/删除 |
| **月报** | 选月份 → 自动聚合（活跃天数、六维均值、高频 Buff/Nerf 来源）→ 一键生成当月 Major Release 大卡 |
| **备份** | 全部记录导出为 JSON / 从 JSON 导入（相同日期会覆盖，导入前有确认） |
| **设置** | API 配置 + 测试连接 |

每天只保留一条记录：同一天内反复生成会覆盖当天那篇，版本号会带上重 roll 计数（`v26.8.22.3`）。

## 数据在哪 & 怎么迁移

- 本地数据库文件：`.wrangler/state/v3/d1/…/db.sqlite`（普通 SQLite，重启不丢）
- **换电脑 / 换系统（Windows ↔ macOS）**：
  - 方式一：「备份」页导出 JSON → 新机器导入
  - 方式二：直接把整个 `.wrangler/state` 目录拷到新机器同位置
- 浏览器里的输入草稿存在 localStorage，与数据库无关

## ⚠️ 红线

**这个项目永远不要 `wrangler deploy` 或以任何形式暴露到公网**：

- 没有任何访问口令，公网上任何人都能烧你的 API key
- API key 明文存在本地 D1 里，这只在「本机自用」前提下是安全的

package.json 已刻意移除 deploy 脚本。想在别的设备用，走上面的迁移流程，不走网络。

## 技术栈与测试

Vite · React · TypeScript · Tailwind v4 · React Bits 动效 · Cloudflare Worker（仅作本地运行时）· D1(SQLite)

```bash
npm test        # vitest 单元测试（worker 工具函数 / 月度聚合 / schema 解析）
npm run build   # 类型检查 + 生产构建
```

## 常见问题

- **生成很慢或失败**：ox-alpha 是推理模型，正常 10–30 秒。失败点「再试一次」即可；若提示 temperature 相关错误，程序已自动降级重试（部分模型不接受 >1 的温度）。
- **端口被占**：`npx wrangler dev --port 其他端口`，同时把 `vite.config.ts` 里代理目标端口改成一致的。
- **想在手机上用**：默认仅监听本机是有意为之。确要局域网访问需自行承担风险（无口令）：`npx wrangler dev --ip 0.0.0.0`。
- **wrangler 命令卡住不退出**：本机已知怪癖，命令实际已成功，Ctrl+C 结束即可看输出确认结果。
