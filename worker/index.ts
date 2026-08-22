import { parsePatchData, type PatchData } from '../src/schema'
import {
  buildChatBody,
  extractJson,
  maskKey,
  resolveConfig,
  validateSettingsInput,
} from './lib'

interface Env {
  OPENROUTER_KEY?: string
  DB: D1Database
}

const SYSTEM_PROMPT = `你是一台把普通人的一天改写成游戏版本更新公告的文案机器。文风：冷面毒舌、满嘴游戏行业黑话、一本正经地胡说八道。

【输出格式】
只输出一个 JSON 对象，不要 markdown 代码块，不要任何解释。结构：
{
  "sections": [
    { "type": "added", "items": [ { "text": "条目内容", "stat_delta": { "ENERGY": -4 } } ] }
  ],
  "stats": { "ENERGY": 64, "MONEY": 42, "SOCIAL": 31, "HEALTH": 78, "CURIOSITY": 96, "SANITY": null }
}

【规则】
1. sections 固定顺序：added（新增）→ balance（平衡性调整）→ bugfix（Bug 修复）→ known_issues（已知问题）。type 只能取这四个值。某类实在没有内容就省略该 section，但 known_issues 必须保留。
2. 数量：added 2-4 条；balance 1-3 条；bugfix 1-3 条；known_issues 1-2 条。
3. 条目全部用中文，可夹英文游戏术语：buff / nerf / 碰撞体积 / 掉落率 / 隐藏关卡 / 成就解锁 / 回滚 / 热修复 / 副本 / NPC。
4. 每条必须带一个编造但看起来很严谨的具体数字：如 -27%、+18%、4%、0.3 秒、Lv.3。这是笑点的骨架。
5. bugfix 可以写嘴硬的「已修复」声明，也可以诚实备注「尚未完全修复」。
6. known_issues 要写出开发者摆烂的语气：「预计不会在下个版本解决」「与预期行为一致，不予修复」。
7. stat_delta：键只能是 ENERGY / MONEY / SOCIAL / HEALTH / CURIOSITY / SANITY，值是 -30 到 +30 的整数，符合因果直觉（熬夜掉 ENERGY 涨 CURIOSITY）。
8. stats：根据今天发生的事给六维打分，0-100 整数。SANITY 永远是 null，永远不许给它数值。
9. 毒舌但有爱：嘲讽的是生活本身，不是用户人格；不下流、不残忍、不碰敏感话题。
10. 用户输入可能很短很无聊——你的工作是把无聊的一天写得像一次大型版本更新。宁可信口开河，不可平淡如实。
11. sarcasm_level 越高文案越刻薄（但仍要好笑）；game_jargon_level 越高游戏术语密度越大，最高时连标点都像掉落物。`

const REPORT_SYSTEM_PROMPT = `你是一台把一整月的每日游戏更新日志合并成「月度大版本更新公告」的文案机器。文风：冷面毒舌、满嘴游戏行业黑话、一本正经地胡说八道。

【输出格式】
只输出一个 JSON 对象，结构与每日版相同：
{
  "sections": [
    { "type": "added", "items": [ { "text": "条目内容", "stat_delta": { "ENERGY": 12 } } ] }
  ],
  "stats": { "ENERGY": 64, "MONEY": 42, "SOCIAL": 31, "HEALTH": 78, "CURIOSITY": 96, "SANITY": null }
}

【规则】
1. 输入是逐日摘要（日期、当天事件、当天六维）和统计（活跃天数、各类条目计数、增益/减益来源排行、六维月均值）。
2. sections 固定顺序与四类 type 同每日版。数量：added 3-6 条；balance 2-4 条；bugfix 2-5 条；known_issues 1-3 条。
3. 你的核心工作是跨天找规律、下判断：「连续 N 天出现 X」「本月高频 Buff 是散步」「社交电量是本月最大 Nerf」「每逢周日晚睡」。把一个月的日子写出因果链。
4. stats 必须原样采用提供的六维月均值（已取整），不许自行编造。SANITY 永远是 null。
5. stat_delta 可省略；给的话范围放大到 -50..+50，体现月度幅度。
6. 中英混排规则同每日版：条目中文夹英文术语，数字必须具体。
7. 毒舌但有爱，不下流不残忍。`

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}

function clampInt(v: unknown, min: number, max: number): number {
  const n = typeof v === 'number' ? Math.round(v) : NaN
  if (Number.isNaN(n)) return min
  return Math.min(max, Math.max(min, n))
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function baseVersionForDateStr(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const yy = String(y % 100).padStart(2, '0')
  return `v${yy}.${m}.${d}`
}

function parseVersionSuffixForWorker(version: string, base: string): number | null {
  if (version === base) return 0
  if (!version.startsWith(`${base}.`)) return null
  const suffix = version.slice(base.length + 1)
  if (!/^\d+$/.test(suffix)) return null
  return Number(suffix)
}

function nextVersionForDate(existingVersion: string | null | undefined, dateStr: string): string {
  const base = baseVersionForDateStr(dateStr)
  if (!existingVersion) return base
  const suffix = parseVersionSuffixForWorker(existingVersion, base)
  if (suffix === null) return base
  return suffix === 0 ? `${base}.1` : `${base}.${suffix + 1}`
}

async function getSettingsRows(env: Env): Promise<Record<string, string>> {
  try {
    const { results } = await env.DB.prepare('SELECT key, value FROM settings').all<{
      key: string
      value: string
    }>()
    const rows: Record<string, string> = {}
    for (const r of results ?? []) rows[r.key] = r.value
    return rows
  } catch {
    return {}
  }
}

async function upsertSettings(env: Env, kv: Record<string, string>): Promise<void> {
  const keys = Object.keys(kv)
  if (keys.length === 0) return
  const stmts = keys.map((k) =>
    env.DB.prepare(
      'INSERT INTO settings (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    ).bind(k, kv[k]),
  )
  await env.DB.batch(stmts)
}

async function callLlm(env: Env, systemPrompt: string, userMsg: string): Promise<unknown> {
  const cfg = resolveConfig(env, await getSettingsRows(env))
  if (!cfg.apiKey) throw new Error('未配置 API Key，请到设置页填写')

  const url = `${cfg.baseUrl.replace(/\/+$/, '')}/chat/completions`
  const doFetch = async (stripJsonMode: boolean, stripTemp: boolean): Promise<Response> =>
    fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:8787',
        'X-Title': 'Life Patch Diary',
      },
      body: JSON.stringify(
        buildChatBody(cfg, systemPrompt, userMsg, {
          stripUnsupportedJsonMode: stripJsonMode,
          stripTemperature: stripTemp,
        }),
      ),
    })

  let stripJsonMode = false
  let stripTemp = false
  let lastErrorText = ''
  let res = await doFetch(stripJsonMode, stripTemp)

  // 确定性降级梯子：部分渠道（如 OpenRouter stealth）对 400 只回 "ERROR" 不说原因，
  // 所以失败时按固定顺序重试：去掉温度 → 再去掉 JSON 模式。
  for (let attempt = 0; attempt < 3; attempt++) {
    if (res.status !== 400 && res.status !== 422) break
    lastErrorText = await res.text()
    if (!stripTemp) {
      stripTemp = true
    } else if (!stripJsonMode) {
      stripJsonMode = true
    } else {
      break
    }
    res = await doFetch(stripJsonMode, stripTemp)
  }

  if (res.status === 400 || res.status === 422) {
    throw new Error(`provider ${res.status}: ${lastErrorText.slice(0, 300)}`)
  }

  if (!res.ok) {
    const t = await res.text()
    throw new Error(`provider ${res.status}: ${t.slice(0, 300)}`)
  }

  const j = (await res.json()) as {
    choices?: Array<{
      message?: { content?: string | null; reasoning?: string | { content?: string } | null }
    }>
  }
  const msg = j.choices?.[0]?.message
  let content = typeof msg?.content === 'string' ? msg.content : ''
  if (content.trim() === '' && msg?.reasoning) {
    // 部分推理渠道在 content 截断时把正文留在 reasoning 里
    if (typeof msg.reasoning === 'string') content = msg.reasoning
    else if (typeof msg.reasoning.content === 'string') content = msg.reasoning.content
  }
  if (content.trim() === '') {
    throw new Error('empty content from model')
  }
  return JSON.parse(extractJson(content))
}

async function handleTest(env: Env): Promise<Response> {
  const cfg = resolveConfig(env, await getSettingsRows(env))
  if (!cfg.apiKey) return json({ ok: false, error: '没有可用的 API Key（设置页或 .dev.vars）' }, 400)

  const started = Date.now()
  try {
    const data = await callLlm(env, '只输出 JSON：{"pong":true}', 'ping')
    return json({ ok: true, model: cfg.model, latencyMs: Date.now() - started, sample: data })
  } catch (e) {
    return json(
      { ok: false, error: e instanceof Error ? e.message : '连接失败', model: cfg.model },
      502,
    )
  }
}

interface SaveEntryInput {
  date: string
  events_text: string
  patch_json: string
  version: string
}

function normalizeEntry(raw: unknown): SaveEntryInput | null {
  if (raw === null || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (typeof o.date !== 'string' || !DATE_RE.test(o.date)) return null

  let events = ''
  if (typeof o.events_text === 'string') events = o.events_text.slice(0, 2000)
  else if (typeof o.events === 'string') events = o.events.slice(0, 2000)

  const patchRaw = o.patch ?? o.patch_json
  const patch: PatchData | null =
    typeof patchRaw === 'string'
      ? (() => {
          try {
            return parsePatchData(JSON.parse(patchRaw))
          } catch {
            return null
          }
        })()
      : parsePatchData(patchRaw)
  if (!patch) return null

  const version = typeof o.version === 'string' && o.version.trim() !== '' ? o.version.trim().slice(0, 40) : 'v0'
  return {
    date: o.date,
    events_text: events,
    patch_json: JSON.stringify(patch),
    version,
  }
}

function parsePatchJson(s: string): unknown {
  try {
    return JSON.parse(s)
  } catch {
    return null
  }
}

function upsertEntryStmt(env: Env, entry: SaveEntryInput, now: string): D1PreparedStatement {
  return env.DB.prepare(
    `INSERT INTO entries (date, events_text, patch_json, version, created_at, updated_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?5)
     ON CONFLICT(date) DO UPDATE SET
       events_text = excluded.events_text,
       patch_json = excluded.patch_json,
       version = excluded.version,
       updated_at = excluded.updated_at`,
  ).bind(entry.date, entry.events_text, entry.patch_json, entry.version, now)
}

function settingsView(cfg: ReturnType<typeof resolveConfig>, rows: Record<string, string>, env: Env) {
  return {
    ok: true as const,
    baseUrl: cfg.baseUrl,
    model: cfg.model,
    temperature: cfg.temperature,
    reasoning: cfg.reasoning,
    extra: cfg.extra,
    apiKeyMasked: maskKey(cfg.apiKey) ?? '',
    hasEnvKey: Boolean(env.OPENROUTER_KEY),
    keySource: rows.apiKey ? ('db' as const) : env.OPENROUTER_KEY ? ('env' as const) : ('none' as const),
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const path = url.pathname

    // ---------- settings ----------
    if (path === '/api/settings' && request.method === 'GET') {
      const rows = await getSettingsRows(env)
      return json(settingsView(resolveConfig(env, rows), rows, env))
    }

    if (path === '/api/settings' && request.method === 'PUT') {
      let body: unknown
      try {
        body = await request.json()
      } catch {
        return json({ ok: false, error: 'bad request body' }, 400)
      }
      const v = validateSettingsInput(body)
      if (!v.ok) return json({ ok: false, error: v.error }, 400)
      const kv: Record<string, string> = {}
      if (v.value.baseUrl !== undefined) kv.baseUrl = v.value.baseUrl
      if (v.value.apiKey !== undefined) kv.apiKey = v.value.apiKey
      if (v.value.model !== undefined) kv.model = v.value.model
      if (v.value.temperature !== undefined) kv.temperature = String(v.value.temperature)
      if (v.value.reasoning !== undefined) kv.reasoning = String(v.value.reasoning)
      if (v.value.extra !== undefined) kv.extra = JSON.stringify(v.value.extra)
      await upsertSettings(env, kv)
      const rows = await getSettingsRows(env)
      return json(settingsView(resolveConfig(env, rows), rows, env))
    }

    if (path === '/api/settings/test' && request.method === 'POST') {
      return handleTest(env)
    }

    // ---------- generate ----------
    if (path === '/api/generate' && request.method === 'POST') {
      let body: { events?: unknown; sarcasmLv?: unknown; gameLv?: unknown }
      try {
        body = await request.json()
      } catch {
        return json({ ok: false, error: 'bad request body' }, 400)
      }
      const events =
        typeof body.events === 'string' ? body.events.trim().slice(0, 2000) : ''
      if (events.length < 2) return json({ ok: false, error: 'events too short' }, 400)
      const sarcasmLv = clampInt(body.sarcasmLv, 0, 5)
      const gameLv = clampInt(body.gameLv, 0, 5)
      const userMsg = `【今日事件】\n${events}\n\n【风格参数】\nsarcasm_level: ${sarcasmLv}\ngame_jargon_level: ${gameLv}`

      try {
        const data = await callLlm(env, SYSTEM_PROMPT, userMsg)
        return json({ ok: true, data })
      } catch (e) {
        console.error('generate failed:', e instanceof Error ? e.message : e)
        return json(
          {
            ok: false,
            error:
              e instanceof Error && e.message.startsWith('未配置')
                ? e.message
                : '生成失败，稍后再试',
          },
          502,
        )
      }
    }

    // ---------- monthly report ----------
    if (path === '/api/report' && request.method === 'POST') {
      let body: { digest?: unknown; aggregate?: unknown }
      try {
        body = await request.json()
      } catch {
        return json({ ok: false, error: 'bad request body' }, 400)
      }
      if (!Array.isArray(body.digest) || body.digest.length === 0) {
        return json({ ok: false, error: 'digest is empty' }, 400)
      }
      const userMsg = `【本月逐日摘要】\n${JSON.stringify(body.digest)}\n\n【统计】\n${JSON.stringify(body.aggregate ?? {})}`
      try {
        const data = await callLlm(env, REPORT_SYSTEM_PROMPT, userMsg)
        return json({ ok: true, data })
      } catch (e) {
        console.error('report failed:', e instanceof Error ? e.message : e)
        return json({ ok: false, error: '月报生成失败，稍后再试' }, 502)
      }
    }

    // ---------- entries ----------
    if (path === '/api/save' && request.method === 'POST') {
      let body: unknown
      try {
        body = await request.json()
      } catch {
        return json({ ok: false, error: 'bad request body' }, 400)
      }
      const entry = normalizeEntry(body)
      if (!entry) return json({ ok: false, error: 'invalid entry' }, 400)
      // Server-side authority: if date already exists, derive expected version from DB
      // to avoid client refresh losing suffix. If client version mismatches, correct it.
      const existing = await env.DB.prepare('SELECT version FROM entries WHERE date = ?1')
        .bind(entry.date)
        .first<{ version: string }>()
      if (existing?.version) {
        const expected = nextVersionForDate(existing.version, entry.date)
        // If client sent base or stale version, upgrade to expected; if client already equals expected, keep it.
        // Also handle case where client sent same as existing (no suffix bump yet) -> bump.
        if (entry.version !== expected && entry.version !== existing.version) {
          // client version diverged; still enforce monotonic bump
          // keep client if it is correctly incremented beyond existing, else correct
          const clientSuffix = parseVersionSuffixForWorker(entry.version, baseVersionForDateStr(entry.date))
          const existingSuffix = parseVersionSuffixForWorker(existing.version, baseVersionForDateStr(entry.date))
          if (clientSuffix === null || existingSuffix === null || clientSuffix <= existingSuffix) {
            entry.version = expected
          }
        } else if (entry.version === existing.version) {
          entry.version = expected
        }
      } else {
        // first save for this date: force canonical base version
        entry.version = baseVersionForDateStr(entry.date)
      }
      await upsertEntryStmt(env, entry, new Date().toISOString()).run()
      return json({ ok: true, version: entry.version })
    }

    if (path === '/api/entries' && request.method === 'GET') {
      const limit = clampInt(Number.parseInt(url.searchParams.get('limit') ?? '500', 10) || 500, 1, 1000)
      const { results } = await env.DB.prepare(
        `SELECT date, version, substr(events_text, 1, 80) AS preview, updated_at
         FROM entries ORDER BY date DESC LIMIT ?1`,
      )
        .bind(limit)
        .all<{ date: string; version: string; preview: string; updated_at: string }>()
      return json({ ok: true, entries: results ?? [] })
    }

    const entryMatch = path.match(/^\/api\/entry\/(\d{4}-\d{2}-\d{2})$/)
    if (entryMatch) {
      const date = entryMatch[1]
      if (request.method === 'GET') {
        const row = await env.DB.prepare('SELECT * FROM entries WHERE date = ?1')
          .bind(date)
          .first<{ date: string; events_text: string; patch_json: string; version: string; updated_at: string }>()
        if (!row) return json({ ok: false, error: 'not found' }, 404)
        return json({ ok: true, entry: { ...row, patch: parsePatchJson(row.patch_json) } })
      }
      if (request.method === 'DELETE') {
        await env.DB.prepare('DELETE FROM entries WHERE date = ?1').bind(date).run()
        return json({ ok: true })
      }
    }

    const monthMatch = path.match(/^\/api\/month\/(\d{4}-\d{2})$/)
    if (monthMatch && request.method === 'GET') {
      const ym = monthMatch[1]
      const { results } = await env.DB.prepare(
        'SELECT date, events_text, patch_json, version FROM entries WHERE date LIKE ?1 ORDER BY date ASC',
      )
        .bind(`${ym}-%`)
        .all<{ date: string; events_text: string; patch_json: string; version: string }>()
      const entries = (results ?? []).map((r) => ({
        date: r.date,
        events_text: r.events_text,
        version: r.version,
        patch: parsePatchJson(r.patch_json),
      }))
      return json({ ok: true, entries })
    }

    // ---------- backup ----------
    if (path === '/api/export' && request.method === 'GET') {
      const { results } = await env.DB.prepare(
        'SELECT date, events_text, patch_json, version, created_at, updated_at FROM entries ORDER BY date ASC',
      ).all()
      return json({ ok: true, exported_at: new Date().toISOString(), entries: results ?? [] })
    }

    if (path === '/api/import' && request.method === 'POST') {
      let body: { entries?: unknown }
      try {
        body = await request.json()
      } catch {
        return json({ ok: false, error: 'bad request body' }, 400)
      }
      if (!Array.isArray(body.entries)) return json({ ok: false, error: 'entries must be an array' }, 400)
      if (body.entries.length > 2000) return json({ ok: false, error: 'too many entries' }, 400)

      const stmts: D1PreparedStatement[] = []
      const now = new Date().toISOString()
      for (const raw of body.entries) {
        const entry = normalizeEntry(raw)
        if (!entry) continue
        stmts.push(upsertEntryStmt(env, entry, now))
      }
      if (stmts.length > 0) await env.DB.batch(stmts)
      return json({ ok: true, imported: stmts.length, skipped: body.entries.length - stmts.length })
    }

    return new Response('Not Found', { status: 404 })
  },
}
