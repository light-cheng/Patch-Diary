import type { PatchData } from '../schema'

export function patchToText(
  data: PatchData,
  version: string,
  dateStr: string,
): string {
  const lines: string[] = [`Life ${version} 更新公告`, dateStr, '']
  for (const s of data.sections) {
    lines.push(`■ ${s.zh} / ${s.type}`)
    for (const it of s.items) {
      const delta = it.stat_delta
        ? Object.entries(it.stat_delta)
            .map(([k, v]) => `${k} ${v >= 0 ? '+' : '-'}${Math.abs(v)}`)
            .join(' ')
        : ''
      lines.push(`· ${it.text}${delta ? `　[${delta}]` : ''}`)
    }
    lines.push('')
  }
  const statLine = Object.entries(data.stats)
    .map(([k, v]) => `${k} ${typeof v === 'number' ? `${v}/100` : '??/100'}`)
    .join(' · ')
  lines.push('──────', statLine)
  return lines.join('\n')
}
