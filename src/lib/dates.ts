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
