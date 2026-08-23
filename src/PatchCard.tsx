import { forwardRef } from 'react'
import { SECTION_EN, SECTION_ZH } from './schema'
import type { PatchData } from './schema'
import StatBar from './StatBar'
import { useI18n } from './i18n'

function DeltaChip({ k, v }: { k: string; v: number }) {
  const good = v >= 0
  return (
    <span
      className={`inline-block rounded px-1.5 py-px text-[11px] font-bold tabular-nums ${
        good ? 'bg-steam-green/15 text-steam-green' : 'bg-red-500/15 text-red-400'
      }`}
    >
      {k} {good ? '+' : ''}
      {v}
    </span>
  )
}

const PatchCard = forwardRef<HTMLDivElement, { data: PatchData; version: string; dateStr: string }>(
  function PatchCard({ data, version, dateStr }, ref) {
    const { t, locale } = useI18n()
    const sectionEn = SECTION_EN
    const sectionZh = SECTION_ZH
    return (
      <div
        ref={ref}
        className="w-full max-w-xl overflow-hidden rounded-lg border border-steam-line bg-steam-panel text-left shadow-2xl"
      >
        <div className="flex items-stretch bg-black/30">
          <div className="flex items-center bg-steam-green px-4 py-3">
            <span className="text-xl font-black tracking-tight text-black">LIFE</span>
          </div>
          <div className="flex flex-1 flex-col justify-center px-4 py-2">
            <span className="text-sm font-bold text-white">{t('patchCard.headerTitle')}</span>
            <span className="text-[10px] uppercase tracking-widest text-slate-400">{t('patchCard.headerSub')}</span>
          </div>
          <div className="flex flex-col items-end justify-center pr-4 text-right">
            <span className="font-mono text-base font-bold text-steam-green">{version}</span>
            <span className="text-[10px] text-slate-500">{dateStr}</span>
          </div>
        </div>

        <div className="px-5 pb-6 pt-5 sm:px-7">
          {data.sections.map((s) => (
            <div key={s.type} className="mb-5 last:mb-0">
              <div className="mb-2 flex items-baseline gap-2 border-b border-steam-line pb-1.5">
                <span className="text-sm font-bold uppercase tracking-wide text-steam-blue">
                  {locale === 'zh' ? sectionZh[s.type] : sectionEn[s.type]}
                </span>
                <span className="text-xs text-slate-400">{locale === 'zh' ? sectionEn[s.type] : sectionZh[s.type]}</span>
              </div>
              <ul className="space-y-1.5">
                {s.items.map((it, i) => (
                  <li key={i} className="flex gap-2 text-[13.5px] leading-relaxed text-slate-200">
                    <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-slate-500" />
                    <span>
                      {it.text}
                      {it.stat_delta && (
                        <span className="ml-2 inline-flex translate-y-[-1px] gap-1 align-middle">
                          {Object.entries(it.stat_delta).map(([k, v]) => (
                            <DeltaChip key={k} k={k} v={v as number} />
                          ))}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <StatBar stats={data.stats} />
        </div>

        <div className="flex items-center justify-between bg-black/30 px-5 py-2 text-[10px] text-slate-600 sm:px-7">
          <span>{t('patchCard.footerLeft')}</span>
          <span>{t('patchCard.footerRight')}</span>
        </div>
      </div>
    )
  },
)

export default PatchCard
