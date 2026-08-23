# Life Patch Diary — Turn Your Day into Patch Notes

> [中文](README.zh-CN.md) | English

> Turn your daily scribbles into Steam-style patch notes. **Local, private, offline-first** — no accounts, no servers, data lives only on your machine. It goes online only at the moment you hit “Generate” to call the LLM.

[![Vite](https://img.shields.io/badge/Vite-7.x-646CFF?logo=vite)](https://vitejs.dev)
[![React](https://img.shields.io/badge/React-19-149ECA?logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript)](https://www.typescriptlang.org)
[![Tailwind](https://img.shields.io/badge/Tailwind-4.x-38BDF8?logo=tailwindcss)](https://tailwindcss.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

## ✨ Preview

| Today · Input & Generate | Result · Patch Notes Card |
|---|---|
| ![Main Interface](Assets/Main%20Interface.png) | ![Result Demo](Assets/Result%20Demo.png) |

> Left: Today — draft input + one-click generate. Right: Steam-style patch notes card with stackable “More savage / More game-ish” re-rolls, screenshot & copy.

---

## Features

- **Today** — Write 3–10 lines about your day → Steam-style card. Stackable `[More savage] / [More game-ish]` re-rolls; auto-saved per day
- **History** — Grouped by month, newest first. Open any day to view the original card, screenshot / copy / delete
- **Reports** — Pick a month → auto-aggregate (active days · section counts · 6-stat avg · top Buff/Nerf) → generate `Major Release`
- **Backup** — Export / import full JSON for cross-device migration. Same date overwrites, confirmation before import
- **Settings** — OpenAI-compatible (OpenRouter / DashScope / DeepSeek / Moonshot) Base URL / Key / Model / Temperature 0–2 / Reasoning toggle / Extra params + connection test
- **i18n** — Full bilingual UI (EN / 中文), default `EN`, toggle in header or Settings. Preference persisted to `localStorage:lpn_lang`

Details: one entry per day, version `vYY.M.D[.N]` auto-increments; draft `localStorage:lpn_draft` auto-saved; zero animation inside the card for stable screenshots.

## Quick Start

**Requirements** Node.js ≥ 20

```bash
# 1. Install (China mirror if needed --registry=https://registry.npmmirror.com)
npm install
# if install scripts are blocked
npm install-scripts approve esbuild workerd && npm rebuild esbuild workerd

# 2. Init local DB (once)
npx wrangler d1 execute DB --local --file schema.sql

# 3. Build + start
npm run build
npm run dev:full   # wrangler dev :8787
```

Open **http://localhost:8787**, then go to **Settings** to configure your API Key.

> HMR dev: in another terminal `npm run dev` (Vite :5173 proxies `/api` → 8787)

## Configuration

**You own the key.** Two ways:

- **Recommended**: Settings → paste Key → Save → Test connection (green). Key is stored in local D1, UI only shows masked `sk-or-v1…1042`
- Manual: write `OPENROUTER_KEY=sk-xxxx` in `.dev.vars` at repo root (already in `.gitignore`)

Default: `OpenRouter · stealth/ox-alpha` (free). To switch provider just change Base URL / Model / Key in Settings — no code change needed.

## Pages at a Glance

| Page | What it does |
|---|---|
| Today | Input today’s events → generate card, stack savage/game-ish, re-roll overwrites the day |
| History | By month, view original card, screenshot, copy, delete |
| Reports | Aggregate by month + generate Major Release |
| Backup | Full JSON export / import |
| Settings | All OpenAI-compatible settings + language + connectivity test |

## Language

Default `EN`. Toggle via the `EN / 中文` button in the top nav or **Settings → Language**. Stored in `localStorage`. Patch content language follows the model’s output (prompts are bilingual-ready).

## Data & Migration

- Local DB: `.wrangler/state/v3/d1/.../db.sqlite` (SQLite, survives restarts)
- Migrate to another machine:
  - Option 1: Backup → Export JSON → Import on new machine
  - Option 2: Copy the whole `.wrangler/state` folder to the same path on the new machine
- Draft: `localStorage:lpn_draft` (separate from DB)

## Security — Red Line

**Never `wrangler deploy` or expose this project to the public internet:**

- No auth — anyone on the internet could burn your API Key
- Key is stored plaintext in local D1, safe only on `localhost`

`package.json` has no deploy script on purpose; do not add one in CI. `/.dev.vars` is in `.gitignore` — rotate immediately if leaked.

## Tech Stack

Vite · React 19 · TypeScript 5 · Tailwind 4 · React Bits (FaultyTerminal / SplitText / ClickSpark / ShinyText / SpotlightCard / CountUp) · Cloudflare Worker (local runtime only) · D1 SQLite · `html2canvas-pro` · Custom i18n (EN/zh persisted)

```bash
npm test        # vitest (schema / monthly / text / dates / worker-lib)
npm run build   # tsc --noEmit + vite build
```

## FAQ

- **Slow / failed generation**: ox-alpha is a reasoning model, 10–30s is normal. Hit retry on failure. Temperature-related 400s are auto-retried (strip temperature → strip json_mode)
- **Port in use**: `npx wrangler dev --port <other>` and update `vite.config.ts` proxy target
- **Use on phone / LAN**: Only localhost is intentional. To open to LAN at your own risk: `npx wrangler dev --ip 0.0.0.0` (no auth)
- **wrangler hangs and won’t exit**: Known local quirk — the command already succeeded, just `Ctrl+C`

## Contributing

Issues / PRs welcome. Please read `AGENTS.md` first (agent skills entry, directory & testing conventions, branch & commit spec).

## License

MIT — see [LICENSE](LICENSE).

---

<p align="center"><sub>All rights reserved by your life · generated by Life Patch Diary</sub></p>
