import { describe, expect, it } from 'vitest'
import { baseVersion, parsePatchData } from '../src/schema'

const VALID = {
  sections: [
    {
      type: 'added',
      items: [
        { text: '新发型上线', stat_delta: { SOCIAL: 5, HACK: 1 } },
        { text: '', stat_delta: {} },
      ],
    },
    { type: 'known_issues', items: [{ text: '晚睡' }] },
    { type: 'balance', items: [{ text: '咖啡 +1' }] },
  ],
  stats: { ENERGY: 64, SANITY: 88, MONEY: 999, SOCIAL: -3, CURIO: 5 },
}

describe('parsePatchData', () => {
  it('parses valid payload, orders sections canonically', () => {
    const d = parsePatchData(VALID)
    expect(d).not.toBeNull()
    expect(d!.sections.map((s) => s.type)).toEqual(['added', 'balance', 'known_issues'])
    expect(d!.sections[0].zh).toBe('新增')
    expect(d!.sections[0].items[0].stat_delta).toEqual({ SOCIAL: 5 })
  })

  it('drops items with empty text and unknown delta keys', () => {
    const d = parsePatchData(VALID)!
    expect(d!.sections[0].items).toHaveLength(1)
  })

  it('clamps stats and forces SANITY null and fills defaults', () => {
    const d = parsePatchData(VALID)!
    expect(d!.stats.ENERGY).toBe(64)
    expect(d!.stats.MONEY).toBe(100)
    expect(d!.stats.SOCIAL).toBe(0)
    expect(d!.stats.SANITY).toBeUndefined()
    expect(d!.stats.CURIOSITY).toBe(50)
    expect(d!.stats.HEALTH).toBe(50)
  })

  it('returns null on garbage input', () => {
    expect(parsePatchData(null)).toBeNull()
    expect(parsePatchData('x')).toBeNull()
    expect(parsePatchData({})).toBeNull()
    expect(parsePatchData({ sections: [] })).toBeNull()
  })
})

describe('baseVersion', () => {
  it('formats as vYY.M.D', () => {
    const v = baseVersion(new Date(2026, 7, 22))
    expect(v).toMatch(/^v26\.8\.22$/)
  })
})
