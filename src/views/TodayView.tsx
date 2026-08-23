import { useCallback, useEffect, useRef, useState } from 'react'
import ClickSpark from '../components/reactbits/ClickSpark/ClickSpark'
import GradientText from '../components/reactbits/GradientText/GradientText'
import ShinyText from '../components/reactbits/ShinyText/ShinyText'
import SplitText from '../components/reactbits/SplitText/SplitText'
import SpotlightCard from '../components/reactbits/SpotlightCard/SpotlightCard'
import PatchCard from '../PatchCard'
import { ApiError, fetchEntry, generatePatchNotes, saveEntry } from '../api'
import type { PatchData } from '../schema'
import { patchToText } from '../lib/text'
import { baseVersion, nextVersion, todayDateStr, todayLocalDate } from '../lib/dates'
import { copyTextToClipboard, saveCardAsImage } from '../lib/browser'
import { useI18n } from '../i18n'

const DRAFT_KEY = 'lpn_draft'

export default function TodayView() {
  const { t, tArray, locale } = useI18n()
  const LOADING_LINES = tArray('today.loadingLines')
  const [events, setEvents] = useState(() => localStorage.getItem(DRAFT_KEY) ?? '')
  const [phase, setPhase] = useState<'input' | 'loading' | 'card'>('input')
  const [data, setData] = useState<PatchData | null>(null)
  const [version, setVersion] = useState(baseVersion())
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [sarcasmLv, setSarcasmLv] = useState(0)
  const [gameLv, setGameLv] = useState(0)
  const [loadingLine, setLoadingLine] = useState(LOADING_LINES[0] ?? '')
  const [copied, setCopied] = useState(false)
  const [saveTip, setSaveTip] = useState('')
  const [saveTipOk, setSaveTipOk] = useState(true)

  const cardRef = useRef<HTMLDivElement>(null)
  const eventsRef = useRef(events)
  eventsRef.current = events

  useEffect(() => {
    localStorage.setItem(DRAFT_KEY, events)
  }, [events])

  useEffect(() => {
    if (LOADING_LINES.length > 0) setLoadingLine(LOADING_LINES[0])
  }, [locale])

  // Hydrate version from already-saved entry so refresh doesn't reset suffix
  useEffect(() => {
    let cancelled = false
    fetchEntry(todayLocalDate())
      .then((e) => {
        if (!cancelled && e?.version) setVersion(e.version)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (phase !== 'loading') return
    let i = 0
    setLoadingLine(LOADING_LINES[0] ?? '')
    const t = setInterval(() => {
      i = (i + 1) % LOADING_LINES.length
      setLoadingLine(LOADING_LINES[i])
    }, 2200)
    return () => clearInterval(t)
  }, [phase, LOADING_LINES])

  const formatToday = useCallback(() => {
    if (locale === 'en') {
      return new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    }
    return todayDateStr()
  }, [locale])

  const doGenerate = useCallback(
    async (sarLv: number, gmLv: number) => {
      const text = eventsRef.current.trim()
      if (text.length < 2 || busy) return
      setBusy(true)
      setError('')
      setSaveTip('')
      setPhase('loading')
      try {
        const [d, existing] = await Promise.all([
          generatePatchNotes(text, { sarcasm: sarLv, game: gmLv }),
          fetchEntry(todayLocalDate()).catch(() => null),
        ])
        const v = nextVersion(existing?.version, new Date())
        setData(d)
        setVersion(v)
        setPhase('card')
        window.scrollTo({ top: 0 })
        try {
          await saveEntry(todayLocalDate(), text, d, v)
          setSaveTip(t('today.saved'))
          setSaveTipOk(true)
        } catch (e) {
          setSaveTip(t('today.autoSaveFailed', { msg: e instanceof ApiError ? e.message : 'unknown' }))
          setSaveTipOk(false)
        }
        setTimeout(() => setSaveTip(''), 3000)
      } catch (e) {
        setError(e instanceof Error ? e.message : t('today.errorGeneric'))
        setPhase('input')
      } finally {
        setBusy(false)
      }
    },
    [busy, t],
  )

  async function onSaveImage() {
    if (!cardRef.current || busy) return
    setBusy(true)
    try {
      await saveCardAsImage(cardRef.current, `Life-${version}-patch-notes.png`)
    } catch {
      setError(t('common.screenshotFailedLong'))
    } finally {
      setBusy(false)
    }
  }

  async function onCopyText() {
    if (!data || busy) return
    await copyTextToClipboard(patchToText(data, version, formatToday()))
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  function backToInput(clearDraft: boolean) {
    if (clearDraft) {
      setEvents('')
      setSarcasmLv(0)
      setGameLv(0)
    }
    setData(null)
    setError('')
    setPhase('input')
  }

  if (phase === 'loading') {
    return (
      <div className="flex min-h-[70dvh] flex-col items-center justify-center px-4">
        <div className="mb-6 font-mono text-2xl font-bold text-steam-green">{baseVersion()}</div>
        <ShinyText text={loadingLine} speed={2} className="text-lg" />
        <div className="mt-6 h-1 w-56 overflow-hidden rounded-full bg-black/50">
          <div className="progress-slide h-full w-1/3 rounded-full bg-steam-green" />
        </div>
      </div>
    )
  }

  if (phase === 'card' && data) {
    const lvSuffix = (lv: number) => (lv > 0 ? ` Lv.${lv}` : '')
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-center px-3 py-6 sm:py-10">
        <div className="w-full max-w-xl">
          <SpotlightCard
            className="rounded-xl border border-white/5 bg-black/20 p-2 shadow-2xl"
            spotlightColor="rgba(102, 192, 244, 0.15)"
          >
            <PatchCard ref={cardRef} data={data} version={version} dateStr={formatToday()} />
          </SpotlightCard>
        </div>

        {saveTip && (
          <div className={`mt-3 text-xs ${saveTipOk ? 'text-steam-green' : 'text-red-400'}`}>{saveTip}</div>
        )}

        <div className="mt-5 grid w-full max-w-xl grid-cols-2 gap-2 sm:grid-cols-4">
          <button
            onClick={() => {
              const n = sarcasmLv + 1
              setSarcasmLv(n)
              doGenerate(n, gameLv)
            }}
            disabled={busy}
            className="rounded border border-red-500/60 bg-red-500/10 px-2 py-2.5 text-sm font-bold text-red-300 transition hover:bg-red-500/20 disabled:opacity-40"
          >
            {t('today.moreSavage')}
            {lvSuffix(sarcasmLv)}
          </button>
          <button
            onClick={() => {
              const n = gameLv + 1
              setGameLv(n)
              doGenerate(sarcasmLv, n)
            }}
            disabled={busy}
            className="rounded border border-steam-blue/60 bg-steam-blue/10 px-2 py-2.5 text-sm font-bold text-steam-blue transition hover:bg-steam-blue/20 disabled:opacity-40"
          >
            {t('today.moreGame')}
            {lvSuffix(gameLv)}
          </button>
          <button
            onClick={onSaveImage}
            disabled={busy}
            className="rounded bg-steam-green px-2 py-2.5 text-sm font-bold text-steam-dark transition hover:brightness-110 disabled:opacity-40"
          >
            {busy ? t('common.capturing') : t('today.saveImage')}
          </button>
          <button
            onClick={onCopyText}
            disabled={busy}
            className="rounded border border-slate-600 bg-transparent px-2 py-2.5 text-sm font-bold text-slate-300 transition hover:bg-white/5 disabled:opacity-40"
          >
            {copied ? t('common.copied') : t('common.copyText')}
          </button>
        </div>

        {error && <div className="mt-3 text-center text-sm text-red-400">{error}</div>}

        <div className="mt-4 flex gap-6 text-xs text-slate-500">
          <button onClick={() => backToInput(false)} className="hover:text-slate-300">
            {t('today.editInput')}
          </button>
          <button onClick={() => backToInput(true)} className="hover:text-slate-300">
            {t('today.newDay')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto flex min-h-[70dvh] max-w-xl flex-col justify-center px-4 py-10">
      <SplitText
        text={`Life ${baseVersion()}`}
        tag="h1"
        className="font-mono text-3xl font-black tracking-tight sm:text-4xl"
        delay={40}
        duration={0.7}
        splitType="chars"
        from={{ opacity: 0, y: 24 }}
        to={{ opacity: 1, y: 0 }}
      />
      <div className="mb-6 mt-2">
        <GradientText
          colors={['#66c0f4', '#a4d007', '#66c0f4']}
          animationSpeed={6}
          className="text-xs font-bold tracking-[0.3em]"
        >
          DAILY LIFE · PATCH NOTES
        </GradientText>
        <p className="mt-2 text-sm text-slate-400">{t('today.subtitle')}</p>
      </div>
      <textarea
        value={events}
        onChange={(e) => setEvents(e.target.value)}
        rows={7}
        placeholder={t('today.placeholder')}
        className="w-full resize-y rounded-lg border border-white/10 bg-steam-panel/80 p-4 leading-relaxed text-slate-200 outline-none backdrop-blur placeholder:text-slate-600 focus:border-steam-blue"
      />
      <div className="mt-4 flex items-center justify-between gap-4">
        <span className="text-xs text-slate-600">{t('today.draftHint')}</span>
        <ClickSpark sparkColor="#a4d007">
          <button
            onClick={() => doGenerate(sarcasmLv, gameLv)}
            disabled={busy || events.trim().length < 2}
            className="rounded bg-steam-green px-6 py-3 font-bold text-steam-dark transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {t('today.generate')}
          </button>
        </ClickSpark>
      </div>
      {error && <div className="mt-3 text-right text-sm text-red-400">{error}</div>}
    </div>
  )
}
