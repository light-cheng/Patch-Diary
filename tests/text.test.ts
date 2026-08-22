import { describe, expect, it } from 'vitest'
import { patchToText } from '../src/lib/text'
import type { PatchData } from '../src/schema'

const DATA: PatchData = {
  sections: [
    {
      type: 'added',
      zh: '新增',
      items: [
        { text: '新发型上线', stat_delta: { SOCIAL: 5 } },
        { text: '夜跑路线解锁' },
      ],
    },
    { type: 'known_issues', zh: '已知问题', items: [{ text: '晚睡' }] },
  ],
  stats: { ENERGY: 64, SOCIAL: 31, SANITY: undefined as unknown as number },
}

describe('patchToText', () => {
  it('renders plain text with sections, deltas and stat line', () => {
    const t = patchToText(DATA, 'v26.8.22', '2026年8月22日')
    expect(t).toContain('Life v26.8.22 更新公告')
    expect(t).toContain('2026年8月22日')
    expect(t).toContain('■ 新增 / added')
    expect(t).toContain('· 新发型上线　[SOCIAL +5]')
    expect(t).toContain('· 夜跑路线解锁')
    expect(t).toContain('ENERGY 64/100')
    expect(t).toContain('SANITY ??/100')
  })
})
