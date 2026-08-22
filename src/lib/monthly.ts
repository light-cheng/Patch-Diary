import { STAT_KEYS, type PatchData, type PatchStats, type SectionType } from '../schema'

export interface DayEntry {
  date: string
  events_text: string
  patch: PatchData
}

export interface StatTotal {
  stat: string
  total: number
}

export interface DigestDay {
  date: string
  events: string
  stats: PatchStats
}

export interface MonthAggregate {
  daysActive: number
  avgStats: PatchStats
  counts: Record<SectionType, number>
  buffs: StatTotal[]
  nerfs: StatTotal[]
  digest: DigestDay[]
}

const EVENTS_TRUNCATE = 80

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

export function aggregateMonth(entries: DayEntry[]): MonthAggregate {
  const counts: Record<SectionType, number> = {
    added: 0,
    balance: 0,
    bugfix: 0,
    known_issues: 0,
  }
  const statSums = new Map<string, number>()
  const statCounts = new Map<string, number>()
  const buffSums = new Map<string, number>()
  const nerfSums = new Map<string, number>()
  const digest: DigestDay[] = []

  for (const entry of entries) {
    if (!entry || !entry.patch || !Array.isArray(entry.patch.sections)) continue

    let valid = false
    for (const section of entry.patch.sections) {
      if (!section || !Array.isArray(section.items)) continue
      if (!(section.type in counts)) continue
      valid = true
      counts[section.type] += section.items.length

      for (const item of section.items) {
        if (!item.stat_delta) continue
        for (const [stat, delta] of Object.entries(item.stat_delta)) {
          if (typeof delta !== 'number') continue
          if (delta > 0) buffSums.set(stat, (buffSums.get(stat) ?? 0) + delta)
          else if (delta < 0) nerfSums.set(stat, (nerfSums.get(stat) ?? 0) + delta)
        }
      }
    }

    const stats = entry.patch.stats ?? {}
    for (const key of STAT_KEYS) {
      const v = stats[key]
      if (typeof v === 'number' && Number.isFinite(v)) {
        statSums.set(key, (statSums.get(key) ?? 0) + v)
        statCounts.set(key, (statCounts.get(key) ?? 0) + 1)
      }
    }

    if (!valid) continue
    digest.push({
      date: entry.date,
      events: (entry.events_text ?? '').slice(0, EVENTS_TRUNCATE),
      stats: { ...stats },
    })
  }

  const avgStats: PatchStats = {}
  for (const [key, sum] of statSums) {
    avgStats[key as keyof PatchStats] = clamp(Math.round(sum / statCounts.get(key)!), 0, 100)
  }

  const toSorted = (m: Map<string, number>, desc: boolean): StatTotal[] =>
    [...m.entries()]
      .map(([stat, total]) => ({ stat, total }))
      .sort((a, b) => (desc ? b.total - a.total : a.total - b.total))

  return {
    daysActive: digest.length,
    avgStats,
    counts,
    buffs: toSorted(buffSums, true),
    nerfs: toSorted(nerfSums, false),
    digest,
  }
}
