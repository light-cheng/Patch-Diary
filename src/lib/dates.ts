export function baseVersion(d: Date = new Date()): string {
  const yy = String(d.getFullYear() % 100).padStart(2, '0')
  return `v${yy}.${d.getMonth() + 1}.${d.getDate()}`
}

export function todayLocalDate(d: Date = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

/** '2026-08-22' -> '2026年8月22日' */
export function formatDateCN(isoDate: string): string {
  return `${Number(isoDate.slice(0, 4))}年${Number(isoDate.slice(5, 7))}月${Number(isoDate.slice(8, 10))}日`
}

export function todayDateStr(d: Date = new Date()): string {
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
}

export function monthOf(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function monthLabel(ym: string): string {
  const [y, m] = ym.split('-')
  return `${y} 年 ${Number(m)} 月`
}

/** '2026-08' -> 'v26.8'（与每日版 v26.8.22 同一纪元风格） */
export function shortMonthVersion(ym: string): string {
  const [y, m] = ym.split('-')
  return `v${y.slice(2)}.${Number(m)}`
}

export function parseVersionSuffix(version: string, base: string): number | null {
  if (version === base) return 0
  if (!version.startsWith(`${base}.`)) return null
  const suffix = version.slice(base.length + 1)
  if (!/^\d+$/.test(suffix)) return null
  return Number(suffix)
}

export function nextVersion(existingVersion: string | null | undefined, today: Date = new Date()): string {
  const base = baseVersion(today)
  if (!existingVersion) return base
  const suffix = parseVersionSuffix(existingVersion, base)
  if (suffix === null) return base
  return suffix === 0 ? `${base}.1` : `${base}.${suffix + 1}`
}
