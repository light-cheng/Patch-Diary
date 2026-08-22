export interface LlmConfig {
  baseUrl: string
  apiKey: string
  model: string
  temperature: number
  reasoning: boolean
  extra: Record<string, unknown> | null
}

export const DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1'
export const DEFAULT_MODEL = 'stealth/ox-alpha'

const PROTECTED_BODY_KEYS = new Set(['model', 'messages', 'response_format', 'reasoning', 'temperature'])

export function extractJson(text: string): string {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end <= start) throw new Error('no json object in response')
  return sanitizeLooseJson(text.slice(start, end + 1))
}

/**
 * LLM 经常产出"近似 JSON"：数字带 + 号、尾逗号。严格 JSON.parse 会炸，
 * 这里在不碰字符串字面量的前提下修掉这两类问题。
 */
export function sanitizeLooseJson(text: string): string {
  let out = ''
  let inString = false
  let escaped = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inString) {
      out += ch
      if (escaped) escaped = false
      else if (ch === '\\') escaped = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') {
      inString = true
      out += ch
      continue
    }
    if (ch === '+') {
      const next = text.slice(i + 1).match(/^\s*-?\d/)
      const prevSignificant = out.trimEnd().slice(-1)
      if (next && ':,[ '.includes(prevSignificant) || (next && prevSignificant === '')) {
        continue
      }
    }
    out += ch
  }
  return out.replace(/,\s*([}\]])/g, '$1')
}

export function maskKey(key?: string | null): string | null {
  if (!key) return null
  if (key.length < 16) return '***'
  return `${key.slice(0, 8)}…${key.slice(-4)}`
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

export function resolveConfig(
  env: { OPENROUTER_KEY?: string },
  settings: Record<string, string>,
): LlmConfig {
  const config: LlmConfig = {
    baseUrl: DEFAULT_BASE_URL,
    apiKey: env.OPENROUTER_KEY ?? '',
    model: DEFAULT_MODEL,
    temperature: 1,
    reasoning: true,
    extra: null,
  }

  if (settings.baseUrl) config.baseUrl = settings.baseUrl
  if (settings.apiKey) config.apiKey = settings.apiKey
  if (settings.model) config.model = settings.model

  if (settings.temperature !== undefined && settings.temperature !== '') {
    const t = Number.parseFloat(settings.temperature)
    if (Number.isFinite(t)) config.temperature = clamp(t, 0, 2)
  }
  if (settings.reasoning === 'true') config.reasoning = true
  else if (settings.reasoning === 'false') config.reasoning = false

  if (settings.extra) {
    try {
      const parsed = JSON.parse(settings.extra)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        config.extra = parsed as Record<string, unknown>
      }
    } catch {
      config.extra = null
    }
  }

  return config
}

type ValidationResult =
  | {
      ok: true
      value: {
        baseUrl?: string
        apiKey?: string
        model?: string
        temperature?: number
        reasoning?: boolean
        extra?: Record<string, unknown>
      }
    }
  | { ok: false; error: string }

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}

function validBaseUrl(url: string): boolean {
  try {
    const u = new URL(url)
    if (u.protocol === 'https:') return true
    if (u.protocol === 'http:' && (u.hostname === 'localhost' || u.hostname === '127.0.0.1')) {
      return true
    }
    return false
  } catch {
    return false
  }
}

export function validateSettingsInput(body: unknown): ValidationResult {
  if (!isPlainObject(body)) return { ok: false, error: 'body must be an object' }
  const value: NonNullable<Extract<ValidationResult, { ok: true }>['value']> = {}

  if (body.baseUrl !== undefined) {
    if (typeof body.baseUrl !== 'string') return { ok: false, error: 'baseUrl must be a string' }
    const b = body.baseUrl.trim()
    if (b !== '' && !validBaseUrl(b)) return { ok: false, error: 'baseUrl 必须是 https:// 开头（本地可用 http://localhost）' }
    if (b !== '') value.baseUrl = b
  }

  if (body.apiKey !== undefined) {
    if (typeof body.apiKey !== 'string') return { ok: false, error: 'apiKey must be a string' }
    const k = body.apiKey.trim()
    if (k.length > 300) return { ok: false, error: 'apiKey 太长了' }
    if (k !== '') value.apiKey = k
  }

  if (body.model !== undefined) {
    if (typeof body.model !== 'string') return { ok: false, error: 'model must be a string' }
    const m = body.model.trim()
    if (m.length > 160) return { ok: false, error: 'model 太长了' }
    if (m !== '') value.model = m
  }

  if (body.temperature !== undefined) {
    const t = typeof body.temperature === 'number' ? body.temperature : NaN
    if (!Number.isFinite(t)) return { ok: false, error: 'temperature must be a number' }
    value.temperature = clamp(t, 0, 2)
  }

  if (body.reasoning !== undefined) {
    if (typeof body.reasoning !== 'boolean') return { ok: false, error: 'reasoning must be boolean' }
    value.reasoning = body.reasoning
  }

  if (body.extra !== undefined) {
    if (body.extra === null) {
      value.extra = {}
    } else if (isPlainObject(body.extra)) {
      value.extra = body.extra
    } else {
      return { ok: false, error: 'extra 必须是 JSON 对象' }
    }
  }

  return { ok: true, value }
}

export function buildChatBody(
  config: LlmConfig,
  systemPrompt: string,
  userMsg: string,
  opts?: { stripUnsupportedJsonMode?: boolean; stripTemperature?: boolean },
): Record<string, unknown> {
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMsg },
  ]

  const body: Record<string, unknown> = {
    model: config.model,
    messages,
    response_format: { type: 'json_object' },
  }

  if (!opts?.stripTemperature) {
    body.temperature = config.temperature
  }

  if (config.reasoning) {
    body.reasoning = { effort: 'low' }
  }

  if (opts?.stripUnsupportedJsonMode) {
    delete body.response_format
  }

  if (config.extra) {
    for (const [k, v] of Object.entries(config.extra)) {
      if (!PROTECTED_BODY_KEYS.has(k)) body[k] = v
    }
  }

  return body
}
