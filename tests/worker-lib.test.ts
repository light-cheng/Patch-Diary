import { describe, expect, it } from 'vitest'
import {
  buildChatBody,
  extractJson,
  maskKey,
  resolveConfig,
  sanitizeLooseJson,
  validateSettingsInput,
  type LlmConfig,
} from '../worker/lib'

describe('sanitizeLooseJson', () => {
  it('removes plus signs before numbers after : , [', () => {
    expect(sanitizeLooseJson('{"a": +6}')).toBe('{"a": 6}')
    expect(sanitizeLooseJson('{"a":-1,"b": +12}')).toBe('{"a":-1,"b": 12}')
    expect(sanitizeLooseJson('[ +3, -4 ]')).toBe('[ 3, -4 ]')
    expect(sanitizeLooseJson('{"HEALTH": +6 }')).toBe('{"HEALTH": 6 }')
  })
  it('strips trailing commas', () => {
    expect(sanitizeLooseJson('{"a":[1,2,]}')).toBe('{"a":[1,2]}')
  })
  it('leaves strings untouched', () => {
    expect(sanitizeLooseJson('{"t":"收入 +100 元"}')).toBe('{"t":"收入 +100 元"}')
  })
})

describe('extractJson', () => {
  it('returns raw json object text', () => {
    expect(extractJson('{"a":1}')).toBe('{"a":1}')
  })
  it('slices out object wrapped in prose and fences', () => {
    const s = '```json\n{"ok": true}\n```\n以上是结果'
    expect(extractJson(s)).toBe('{"ok": true}')
  })
  it('throws when no braces', () => {
    expect(() => extractJson('nope')).toThrow()
  })
})

describe('maskKey', () => {
  it('shows head and tail for long keys', () => {
    expect(maskKey('sk-or-v1-aabbccddeeff0099')).toBe('sk-or-v1…0099')
  })
  it('masks short keys completely', () => {
    expect(maskKey('abc')).toBe('***')
  })
  it('returns null for empty', () => {
    expect(maskKey(null)).toBeNull()
    expect(maskKey('')).toBeNull()
    expect(maskKey(undefined)).toBeNull()
  })
})

const DEFAULTS: LlmConfig = {
  baseUrl: 'https://openrouter.ai/api/v1',
  apiKey: 'k-test',
  model: 'stealth/ox-alpha',
  temperature: 1,
  reasoning: true,
  extra: null,
}

function makeConfig(overrides: Partial<LlmConfig>): LlmConfig {
  return { ...DEFAULTS, ...overrides }
}

describe('resolveConfig', () => {
  const env = { OPENROUTER_KEY: 'env-key', ACCESS_CODE: 'x' }

  it('uses defaults and env key when db empty', () => {
    const c = resolveConfig(env, {})
    expect(c.baseUrl).toBe('https://openrouter.ai/api/v1')
    expect(c.model).toBe('stealth/ox-alpha')
    expect(c.temperature).toBe(1)
    expect(c.reasoning).toBe(true)
    expect(c.apiKey).toBe('env-key')
  })

  it('db settings override env and defaults', () => {
    const c = resolveConfig(
      { OPENROUTER_KEY: 'env-key' },
      { baseUrl: 'https://api.deepseek.com/v1', apiKey: 'db-key', model: 'deepseek-chat', temperature: '0.7', reasoning: 'false' },
    )
    expect(c.baseUrl).toBe('https://api.deepseek.com/v1')
    expect(c.apiKey).toBe('db-key')
    expect(c.model).toBe('deepseek-chat')
    expect(c.temperature).toBe(0.7)
    expect(c.reasoning).toBe(false)
  })

  it('parses extra as object or null', () => {
    expect(resolveConfig({}, { extra: '{"max_tokens":100}' }).extra).toEqual({ max_tokens: 100 })
    expect(resolveConfig({}, { extra: 'not-json' }).extra).toBeNull()
  })
})

describe('validateSettingsInput', () => {
  it('accepts valid partial input', () => {
    const r = validateSettingsInput({
      baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1 ',
      model: ' qwen-max ',
      temperature: 1.5,
      reasoning: true,
      apiKey: ' sk-abc ',
    })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value.baseUrl).toBe('https://dashscope.aliyuncs.com/compatible-mode/v1')
      expect(r.value.model).toBe('qwen-max')
      expect(r.value.apiKey).toBe('sk-abc')
    }
  })
  it('rejects non-https public base url', () => {
    const r = validateSettingsInput({ baseUrl: 'ftp://x' })
    expect(r.ok).toBe(false)
  })
  it('allows http localhost base url', () => {
    expect(validateSettingsInput({ baseUrl: 'http://127.0.0.1:8000/v1' }).ok).toBe(true)
  })
  it('clamps temperature into 0..2', () => {
    const r = validateSettingsInput({ temperature: 99 })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.temperature).toBe(2)
  })
  it('rejects non-object extra', () => {
    expect(validateSettingsInput({ extra: [1, 2] }).ok).toBe(false)
    expect(validateSettingsInput({ extra: 'x' }).ok).toBe(false)
  })
})

describe('buildChatBody', () => {
  const SYSTEM = 'sys'
  const USER = 'user msg'

  it('includes json mode and low reasoning when enabled', () => {
    const body = buildChatBody(makeConfig({}), SYSTEM, USER)
    expect(body.model).toBe('stealth/ox-alpha')
    expect(body.temperature).toBe(1)
    expect(body.response_format).toEqual({ type: 'json_object' })
    expect(body.reasoning).toEqual({ effort: 'low' })
    const messages = body.messages as unknown[]
    expect(messages[0]).toEqual({ role: 'system', content: SYSTEM })
    expect(messages[1]).toEqual({ role: 'user', content: USER })
  })

  it('omits reasoning when disabled', () => {
    const body = buildChatBody(makeConfig({ reasoning: false }), SYSTEM, USER)
    expect(body.reasoning).toBeUndefined()
  })

  it('merges extra params but protects core fields', () => {
    const body = buildChatBody(
      makeConfig({ extra: { max_tokens: 500, temperature: 99, model: 'evil', messages: [] } }),
      SYSTEM,
      USER,
    ) as Record<string, unknown>
    expect(body.max_tokens).toBe(500)
    expect(body.temperature).toBe(1)
    expect(body.model).toBe('stealth/ox-alpha')
    expect(Array.isArray(body.messages)).toBe(true)
  })

  it('strips reasoning field for non-openrouter providers when disabled via flag', () => {
    const body = buildChatBody(makeConfig({ reasoning: false }), SYSTEM, USER, { stripUnsupportedJsonMode: true })
    expect(body.response_format).toBeUndefined()
  })

  it('can strip temperature when provider rejects it', () => {
    const body = buildChatBody(makeConfig({ temperature: 1.1 }), SYSTEM, USER, { stripTemperature: true })
    expect(body.temperature).toBeUndefined()
  })
})
