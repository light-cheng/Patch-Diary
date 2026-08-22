export const STAT_KEYS = [
  'ENERGY',
  'MONEY',
  'SOCIAL',
  'HEALTH',
  'CURIOSITY',
  'SANITY',
] as const

export type StatKey = (typeof STAT_KEYS)[number]

export type SectionType = 'added' | 'balance' | 'bugfix' | 'known_issues'

export interface PatchItem {
  text: string
  stat_delta?: Partial<Record<StatKey, number>>
}

export interface PatchSection {
  type: SectionType
  zh: string
  items: PatchItem[]
}

export type PatchStats = Partial<Record<StatKey, number>>

export interface PatchData {
  sections: PatchSection[]
  stats: PatchStats
}

export const SECTION_ZH: Record<SectionType, string> = {
  added: '新增',
  balance: '平衡性调整',
  bugfix: 'Bug 修复',
  known_issues: '已知问题',
}

export const SECTION_EN: Record<SectionType, string> = {
  added: "What's New",
  balance: 'Balance Changes',
  bugfix: 'Bug Fixes',
  known_issues: 'Known Issues',
}

const SECTION_TYPES = Object.keys(SECTION_ZH) as SectionType[]

function isStatKey(v: unknown): v is StatKey {
  return typeof v === 'string' && (STAT_KEYS as readonly string[]).includes(v)
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

export function parsePatchData(raw: unknown): PatchData | null {
  if (raw === null || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>

  if (!Array.isArray(obj.sections)) return null

  const sections: PatchSection[] = []
  for (const s of obj.sections) {
    if (s === null || typeof s !== 'object') continue
    const so = s as Record<string, unknown>
    if (!SECTION_TYPES.includes(so.type as SectionType)) continue
    if (!Array.isArray(so.items)) continue

    const items: PatchItem[] = []
    for (const it of so.items) {
      if (it === null || typeof it !== 'object') continue
      const io = it as Record<string, unknown>
      if (typeof io.text !== 'string' || io.text.trim() === '') continue

      let stat_delta: PatchItem['stat_delta'] | undefined
      if (io.stat_delta !== null && typeof io.stat_delta === 'object') {
        const d: Partial<Record<StatKey, number>> = {}
        for (const [k, v] of Object.entries(
          io.stat_delta as Record<string, unknown>,
        )) {
          if (isStatKey(k) && typeof v === 'number' && Number.isFinite(v)) {
            d[k] = clamp(Math.round(v), -99, 99)
          }
        }
        if (Object.keys(d).length > 0) stat_delta = d
      }

      items.push({ text: io.text.trim(), ...(stat_delta ? { stat_delta } : {}) })
    }
    if (items.length === 0) continue

    sections.push({
      type: so.type as SectionType,
      zh: SECTION_ZH[so.type as SectionType],
      items,
    })
  }

  if (sections.length === 0) return null

  const stats: PatchStats = {}
  if (obj.stats !== null && typeof obj.stats === 'object') {
    for (const [k, v] of Object.entries(obj.stats as Record<string, unknown>)) {
      if (!isStatKey(k)) continue
      if (k === 'SANITY') continue
      if (typeof v === 'number' && Number.isFinite(v)) {
        stats[k] = clamp(Math.round(v), 0, 100)
      }
    }
  }
  for (const k of STAT_KEYS) {
    if (k !== 'SANITY' && stats[k] === undefined) stats[k] = 50
  }

  const order = SECTION_TYPES
  sections.sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type))

  return { sections, stats }
}

export { baseVersion } from './lib/dates'
