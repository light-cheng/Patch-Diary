import { describe, expect, it } from 'vitest'
import { aggregateMonth, type DayEntry } from '../src/lib/monthly'
import type { PatchData } from '../src/schema'

function day(date: string, patch: PatchData, events = '事件'): DayEntry {
  return { date, events_text: events, patch }
}

const FIXTURES: DayEntry[] = [
  day('2026-08-01', {
    sections: [
      {
        type: 'added',
        zh: '新增',
        items: [{ text: 'x' }, { text: 'y', stat_delta: { HEALTH: 8 } }],
      },
      { type: 'bugfix', zh: 'Bug 修复', items: [{ text: 'a' }] },
    ],
    stats: { ENERGY: 60, MONEY: 50, SOCIAL: 50, HEALTH: 70, CURIOSITY: 50 },
  }),
  day(
    '2026-08-02',
    {
      sections: [
        {
          type: 'balance',
          zh: '平衡性调整',
          items: [{ text: 'b', stat_delta: { ENERGY: -10, SANITY: -5 } }],
        },
      ],
      stats: { ENERGY: 40, MONEY: 50, SOCIAL: 50, HEALTH: 60, CURIOSITY: 50 },
    },
    '熬夜到三点，一个非常长的描述超过截断限制的句子应该被截断处理掉'.repeat(3),
  ),
]

describe('aggregateMonth', () => {
  const agg = aggregateMonth(FIXTURES)

  it('counts active days', () => {
    expect(agg.daysActive).toBe(2)
  })

  it('averages stats excluding SANITY nulls', () => {
    expect(agg.avgStats.ENERGY).toBe(50)
    expect(agg.avgStats.HEALTH).toBe(65)
    expect(agg.avgStats.SANITY).toBeUndefined()
  })

  it('sums section item counts by type', () => {
    expect(agg.counts.added).toBe(2)
    expect(agg.counts.balance).toBe(1)
    expect(agg.counts.bugfix).toBe(1)
    expect(agg.counts.known_issues).toBe(0)
  })

  it('separates buffs and nerfs from stat deltas', () => {
    expect(agg.buffs).toEqual([{ stat: 'HEALTH', total: 8 }])
    expect(agg.nerfs).toEqual([
      { stat: 'ENERGY', total: -10 },
      { stat: 'SANITY', total: -5 },
    ])
  })

  it('builds digest with truncated events', () => {
    expect(agg.digest).toHaveLength(2)
    expect(agg.digest[0].date).toBe('2026-08-01')
    expect(agg.digest[1].events.length).toBeLessThanOrEqual(80)
  })

  it('handles empty month and skips malformed patches', () => {
    expect(aggregateMonth([]).daysActive).toBe(0)
    const withGarbage = aggregateMonth([day('2026-08-03', null as unknown as PatchData)])
    expect(withGarbage.daysActive).toBe(0)
  })
})
