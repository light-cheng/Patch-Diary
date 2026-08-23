import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import PatchCard from '../PatchCard'
import { ApiError, deleteEntry, fetchEntries, fetchEntry, type EntryMeta, type FullEntry } from '../api'
import type { PatchData } from '../schema'
import { patchToText } from '../lib/text'
import { formatDateCN } from '../lib/dates'
import { copyTextToClipboard, saveCardAsImage } from '../lib/browser'
import { useI18n } from '../i18n'

function groupByMonth(entries: EntryMeta[]): Array<[string, EntryMeta[]]> {
  const map = new Map<string, EntryMeta[]>()
  for (const e of entries) {
    const ym = e.date.slice(0, 7)
    const list = map.get(ym)
    if (list) list.push(e)
    else map.set(ym, [e])
  }
  return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]))
}

const WEEKDAYS_ZH = ['日', '一', '二', '三', '四', '五', '六']
const WEEKDAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function weekdayOf(date: string, locale: string): string {
  const d = new Date(`${date}T12:00:00`)
  if (Number.isNaN(d.getTime())) return ''
  if (locale === 'en') return WEEKDAYS_EN[d.getDay()]
  return `周${WEEKDAYS_ZH[d.getDay()]}`
}

function formatDateLocale(date: string, locale: string): string {
  if (locale === 'en') {
    const d = new Date(`${date}T12:00:00`)
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  }
  return formatDateCN(date)
}

export default function HistoryView() {
  const { t, locale } = useI18n()
  const [entries, setEntries] = useState<EntryMeta[] | null>(null)
  const [selected, setSelected] = useState<FullEntry | null>(null)
  const [error, setError] = useState('')
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchEntries()
      .then(setEntries)
      .catch((e) => setError(e instanceof Error ? e.message : t('history.loadFailed')))
  }, [t])

  const groups = useMemo(() => (entries ? groupByMonth(entries) : []), [entries])

  const onDelete = useCallback(async () => {
    if (!selected) return
    if (!window.confirm(t('history.deleteConfirm', { date: selected.date }))) return
    try {
      await deleteEntry(selected.date)
      setEntries(await fetchEntries())
      setSelected(null)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('history.deleteFailed'))
    }
  }, [selected, t])

  async function onSaveImage() {
    if (!cardRef.current || !selected?.patch) return
    try {
      await saveCardAsImage(cardRef.current, `Life-${selected.version}-patch-notes.png`)
    } catch {
      setError(t('common.screenshotFailed'))
    }
  }

  function onCopyText() {
    if (!selected?.patch) return
    void copyTextToClipboard(patchToText(selected.patch as PatchData, selected.version, formatDateLocale(selected.date, locale)))
  }

  if (error && !entries) {
    return <div className="mx-auto max-w-xl px-4 py-16 text-center text-sm text-red-400">{error}</div>
  }

  if (selected) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-center px-3 py-6 sm:py-10">
        <div className="mb-3 flex w-full max-w-xl items-baseline justify-between">
          <h2 className="text-lg font-bold text-white">
            {selected.date} <span className="text-slate-500">{weekdayOf(selected.date, locale)}</span>
          </h2>
          <button onClick={() => setSelected(null)} className="text-xs text-slate-500 hover:text-slate-300">
            {t('history.backToList')}
          </button>
        </div>

        {selected.patch ? (
          <div className="w-full max-w-xl">
            <PatchCard
              ref={cardRef}
              data={selected.patch}
              version={selected.version}
              dateStr={formatDateLocale(selected.date, locale)}
            />
          </div>
        ) : (
          <div className="text-sm text-red-400">{t('history.corrupted')}</div>
        )}

        <div className="mt-4 flex gap-2">
          <button onClick={onSaveImage} className="rounded bg-steam-green px-4 py-2 text-xs font-bold text-steam-dark hover:brightness-110">
            {t('history.saveImage')}
          </button>
          <button onClick={onCopyText} className="rounded border border-slate-600 px-4 py-2 text-xs font-bold text-slate-300 hover:bg-white/5">
            {t('history.copyText')}
          </button>
          <button onClick={onDelete} className="rounded border border-red-500/50 px-4 py-2 text-xs font-bold text-red-400 hover:bg-red-500/10">
            {t('history.delete')}
          </button>
        </div>
        {error && <div className="mt-3 text-xs text-red-400">{error}</div>}
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <h2 className="mb-6 text-xl font-bold text-white">{t('history.title')}</h2>

      {entries === null && <div className="text-sm text-slate-500">{t('common.loading')}</div>}

      {entries !== null && entries.length === 0 && (
        <div className="rounded-lg border border-dashed border-white/10 p-10 text-center text-sm text-slate-500">
          {t('history.empty')}
        </div>
      )}

      {groups.map(([ym, list]) => (
        <div key={ym} className="mb-8">
          <div className="mb-2 flex items-baseline gap-2 border-b border-white/10 pb-1.5">
            <span className="font-mono text-sm font-bold text-steam-blue">{ym}</span>
            <span className="text-xs text-slate-500">
              {list.length} {t('common.days')}
            </span>
          </div>
          <ul>
            {list.map((e) => (
              <li key={e.date}>
                <button
                  onClick={async () => {
                    setError('')
                    const full = await fetchEntry(e.date)
                    if (full) setSelected(full)
                    else setError(t('history.loadFailed'))
                  }}
                  className="flex w-full items-center gap-3 rounded px-2 py-2.5 text-left transition hover:bg-white/5"
                >
                  <span className="w-14 shrink-0 text-sm tabular-nums text-slate-300">{e.date.slice(5)}</span>
                  <span className="w-8 shrink-0 text-[11px] text-slate-600">{weekdayOf(e.date, locale)}</span>
                  <span className="w-20 shrink-0 truncate font-mono text-xs text-steam-green">{e.version}</span>
                  <span className="flex-1 truncate text-xs text-slate-500">{e.preview}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}

      {error && entries !== null && <div className="text-xs text-red-400">{error}</div>}
    </div>
  )
}
