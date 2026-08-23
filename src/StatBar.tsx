import { STAT_KEYS, type PatchStats } from './schema'
import { useI18n } from './i18n'

const STAT_COLORS: Record<string, string> = {
  ENERGY: '#e0a93e',
  MONEY: '#a4d007',
  SOCIAL: '#66c0f4',
  HEALTH: '#e05f5f',
  CURIOSITY: '#b07ae0',
  SANITY: '#5a6b7d',
}

export default function StatBar({ stats }: { stats: PatchStats }) {
  const { t } = useI18n()
  return (
    <div className="mt-6 border-t border-steam-line pt-4">
      <div className="mb-3 text-[11px] font-bold tracking-widest text-slate-500">{t('statBar.title')}</div>
      <div className="grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2">
        {STAT_KEYS.map((k) => {
          const v = stats[k]
          const unknown = typeof v !== 'number'
          const color = STAT_COLORS[k] ?? '#888'
          return (
            <div key={k} className="flex items-center gap-2">
              <span
                className={`w-[74px] shrink-0 text-[11px] font-bold tracking-wider ${
                  unknown ? 'text-slate-600' : 'text-slate-300'
                }`}
              >
                {k}
              </span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-black/40">
                {unknown ? (
                  <div
                    className="h-full w-full opacity-30"
                    style={{
                      backgroundImage: `repeating-linear-gradient(45deg, ${color} 0 4px, transparent 4px 8px)`,
                    }}
                  />
                ) : (
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${v}%`, backgroundColor: color }}
                  />
                )}
              </div>
              <span
                className={`w-14 shrink-0 text-right text-[11px] tabular-nums ${
                  unknown ? 'text-slate-600' : 'text-slate-400'
                }`}
              >
                {unknown ? '??/100' : `${v}/100`}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
