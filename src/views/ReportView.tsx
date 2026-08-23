import { useCallback, useEffect, useRef, useState } from 'react'
import CountUp from '../components/reactbits/CountUp/CountUp'
import PatchCard from '../PatchCard'
import StatBar from '../StatBar'
import { ApiError, fetchMonth, generateReport, type MonthRow } from '../api'
import { aggregateMonth, type MonthAggregate } from '../lib/monthly'
import { monthLabel, monthOf, shortMonthVersion, todayLocalDate } from '../lib/dates'
import { patchToText } from '../lib/text'
import { copyTextToClipboard, saveCardAsImage } from '../lib/browser'
import { SECTION_ZH, SECTION_EN, type PatchData, type SectionType } from '../schema'
import { useI18n } from '../i18n'

export default function ReportView() {
  const { t, locale } = useI18n()
  const [ym, setYm] = useState(monthOf())
  const [agg, setAgg] = useState<MonthAggregate | null>(null)
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [report, setReport] = useState<PatchData | null>(null)
  const [error, setError] = useState('')
  const cardRef = useRef<HTMLDivElement>(null)

  const formatMonthLabel = (ymStr: string) => {
    if (locale === 'en') {
      const [y, m] = ymStr.split('-').map(Number)
      const d = new Date(y, m - 1, 1)
      return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
    }
    return monthLabel(ymStr)
  }

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setReport(null)
    setError('')
    fetchMonth(ym)
      .then((rows: MonthRow[]) => {
        if (cancelled) return
        const valid = rows.filter(
          (r): r is MonthRow & { patch: PatchData } => r.patch !== null && typeof r.patch === 'object',
        )
        setAgg(
          aggregateMonth(
            valid.map((r) => ({ date: r.date, events_text: r.events_text, patch: r.patch })),
          ),
        )
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : t('report.generateFailed')))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [ym, t])

  const onGenerate = useCallback(async () => {
    if (!agg || agg.daysActive === 0 || generating) return
    setGenerating(true)
    setError('')
    try {
      const data = await generateReport(agg.digest, {
        daysActive: agg.daysActive,
        counts: agg.counts,
        buffs: agg.buffs.slice(0, 3),
        nerfs: agg.nerfs.slice(0, 3),
        avgStats: agg.avgStats,
      })
      setReport(data)
      window.scrollTo({ top: 0 })
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('report.generateFailed'))
    } finally {
      setGenerating(false)
    }
  }, [agg, generating, t])

  async function onSaveImage() {
    if (!cardRef.current) return
    try {
      await saveCardAsImage(cardRef.current, `Life-${shortMonthVersion(ym)}-major-release.png`)
    } catch {
      setError(t('report.screenshotFailed'))
    }
  }

  function onCopyText() {
    if (!report) return
    void copyTextToClipboard(patchToText(report, shortMonthVersion(ym), `${formatMonthLabel(ym)} · Major Release`))
  }

  const reportVersion = shortMonthVersion(ym)
  const sectionLabel = (k: SectionType) => (locale === 'en' ? SECTION_EN[k] : SECTION_ZH[k])

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <div className="mb-6 flex items-center gap-3">
        <h2 className="text-xl font-bold text-white">{t('report.title')}</h2>
        <input
          type="month"
          value={ym}
          onChange={(e) => setYm(e.target.value)}
          max={todayLocalDate().slice(0, 7)}
          className="rounded border border-white/10 bg-steam-panel px-2 py-1 text-sm text-slate-200 outline-none focus:border-steam-blue"
        />
      </div>

      {loading && <div className="text-sm text-slate-500">{t('report.loading')}</div>}

      {!loading && agg && agg.daysActive === 0 && (
        <div className="rounded-lg border border-dashed border-white/10 p-10 text-center text-sm text-slate-500">
          {t('report.empty', { month: formatMonthLabel(ym) })}
        </div>
      )}

      {!loading && agg && agg.daysActive > 0 && (
        <>
          <div className="mb-4 grid grid-cols-4 gap-2">
            <MetricChip label={t('report.activeDays')} value={agg.daysActive} />
            {(Object.keys(agg.counts) as SectionType[]).map((k) => (
              <MetricChip key={k} label={sectionLabel(k)} value={agg.counts[k]} />
            ))}
          </div>

          <div className="mb-4 rounded-lg border border-white/5 bg-black/20 p-4">
            <div className="mb-3 text-[11px] font-bold tracking-widest text-slate-500">{t('report.monthlyAvg')}</div>
            <StatBar stats={agg.avgStats} />
          </div>

          <div className="mb-6 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <SourceList title={t('report.topBuff')} items={agg.buffs} good tNoData={t('report.noData')} />
            <SourceList title={t('report.topNerf')} items={agg.nerfs} tNoData={t('report.noData')} />
          </div>

          <button
            onClick={onGenerate}
            disabled={generating}
            className="w-full rounded bg-steam-green py-3 font-bold text-steam-dark transition hover:brightness-110 disabled:opacity-40"
          >
            {generating ? t('report.merging') : t('report.generate', { version: reportVersion })}
          </button>
          {error && !report && <div className="mt-3 text-center text-sm text-red-400">{error}</div>}
        </>
      )}

      {report && (
        <div className="mt-8">
          <PatchCard ref={cardRef} data={report} version={reportVersion} dateStr={`${formatMonthLabel(ym)} · Major Release`} />
          <div className="mt-4 flex justify-center gap-2">
            <button onClick={onSaveImage} className="rounded bg-steam-green px-4 py-2 text-xs font-bold text-steam-dark hover:brightness-110">
              {t('report.saveImage')}
            </button>
            <button onClick={onCopyText} className="rounded border border-slate-600 px-4 py-2 text-xs font-bold text-slate-300 hover:bg-white/5">
              {t('report.copyText')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function MetricChip({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-white/5 bg-black/20 p-3 text-center">
      <CountUp to={value} duration={0.9} className="font-mono text-2xl font-bold text-steam-green" />
      <div className="mt-1 text-[11px] text-slate-500">{label}</div>
    </div>
  )
}

function SourceList({ title, items, good, tNoData }: { title: string; items: Array<{ stat: string; total: number }>; good?: boolean; tNoData: string }) {
  return (
    <div className="rounded-lg border border-white/5 bg-black/20 p-3">
      <div className={`mb-2 text-[11px] font-bold tracking-widest ${good ? 'text-steam-green' : 'text-red-400'}`}>{title}</div>
      {items.length === 0 ? (
        <div className="text-xs text-slate-600">{tNoData}</div>
      ) : (
        <ul className="space-y-1">
          {items.slice(0, 3).map(({ stat, total }) => (
            <li key={stat} className="flex items-baseline justify-between text-xs">
              <span className="text-slate-300">{stat}</span>
              <span className={`font-mono tabular-nums ${good ? 'text-steam-green' : 'text-red-400'}`}>
                {total > 0 ? '+' : ''}
                {total}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
