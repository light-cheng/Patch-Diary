import { useCallback, useEffect, useRef, useState } from 'react'
import ClickSpark from '../components/reactbits/ClickSpark/ClickSpark'
import GradientText from '../components/reactbits/GradientText/GradientText'
import ShinyText from '../components/reactbits/ShinyText/ShinyText'
import SplitText from '../components/reactbits/SplitText/SplitText'
import SpotlightCard from '../components/reactbits/SpotlightCard/SpotlightCard'
import PatchCard from '../PatchCard'
import { ApiError, generatePatchNotes, saveEntry } from '../api'
import { baseVersion, type PatchData } from '../schema'
import { patchToText } from '../lib/text'
import { todayDateStr, todayLocalDate } from '../lib/dates'
import { copyTextToClipboard, saveCardAsImage } from '../lib/browser'

const DRAFT_KEY = 'lpn_draft'

const LOADING_LINES = [
  '正在编译更新日志…',
  '正在重新平衡人生数值…',
  '正在回滚昨天的 bug…',
  '正在生成本次更新的借口…',
  '正在与服务器同步你的崩溃…',
]

export default function TodayView() {
  const [events, setEvents] = useState(() => localStorage.getItem(DRAFT_KEY) ?? '')
  const [phase, setPhase] = useState<'input' | 'loading' | 'card'>('input')
  const [data, setData] = useState<PatchData | null>(null)
  const [version, setVersion] = useState(baseVersion())
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [sarcasmLv, setSarcasmLv] = useState(0)
  const [gameLv, setGameLv] = useState(0)
  const [loadingLine, setLoadingLine] = useState(LOADING_LINES[0])
  const [copied, setCopied] = useState(false)
  const [saveTip, setSaveTip] = useState('')

  const genCount = useRef(0)
  const cardRef = useRef<HTMLDivElement>(null)
  const eventsRef = useRef(events)
  eventsRef.current = events

  useEffect(() => {
    localStorage.setItem(DRAFT_KEY, events)
  }, [events])

  useEffect(() => {
    if (phase !== 'loading') return
    let i = 0
    setLoadingLine(LOADING_LINES[0])
    const t = setInterval(() => {
      i = (i + 1) % LOADING_LINES.length
      setLoadingLine(LOADING_LINES[i])
    }, 2200)
    return () => clearInterval(t)
  }, [phase])

  const doGenerate = useCallback(
    async (sarLv: number, gmLv: number) => {
      const text = eventsRef.current.trim()
      if (text.length < 2 || busy) return
      setBusy(true)
      setError('')
      setSaveTip('')
      setPhase('loading')
      try {
        const d = await generatePatchNotes(text, sarLv, gmLv)
        const v =
          genCount.current === 0 ? baseVersion() : `${baseVersion()}.${genCount.current}`
        genCount.current += 1
        setData(d)
        setVersion(v)
        setPhase('card')
        window.scrollTo({ top: 0 })
        try {
          await saveEntry(todayLocalDate(), text, d, v)
          setSaveTip('已存入日记 ✓')
        } catch (e) {
          setSaveTip(`自动存档失败：${e instanceof ApiError ? e.message : '未知错误'}`)
        }
        setTimeout(() => setSaveTip(''), 3000)
      } catch (e) {
        setError(e instanceof Error ? e.message : '出错了，再试一次')
        setPhase('input')
      } finally {
        setBusy(false)
      }
    },
    [busy],
  )

  async function onSaveImage() {
    if (!cardRef.current || busy) return
    setBusy(true)
    try {
      await saveCardAsImage(cardRef.current, `Life-${version}-patch-notes.png`)
    } catch {
      setError('截图失败了…长按卡片手动截也行')
    } finally {
      setBusy(false)
    }
  }

  async function onCopyText() {
    if (!data || busy) return
    await copyTextToClipboard(patchToText(data, version, todayDateStr()))
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  function backToInput(clearDraft: boolean) {
    if (clearDraft) {
      setEvents('')
      setSarcasmLv(0)
      setGameLv(0)
      genCount.current = 0
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
            <PatchCard ref={cardRef} data={data} version={version} dateStr={todayDateStr()} />
          </SpotlightCard>
        </div>

        {saveTip && (
          <div className={`mt-3 text-xs ${saveTip.includes('失败') ? 'text-red-400' : 'text-steam-green'}`}>
            {saveTip}
          </div>
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
            更毒舌{lvSuffix(sarcasmLv)}
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
            更像游戏{lvSuffix(gameLv)}
          </button>
          <button
            onClick={onSaveImage}
            disabled={busy}
            className="rounded bg-steam-green px-2 py-2.5 text-sm font-bold text-steam-dark transition hover:brightness-110 disabled:opacity-40"
          >
            {busy ? '截图生成中…' : '保存图片'}
          </button>
          <button
            onClick={onCopyText}
            disabled={busy}
            className="rounded border border-slate-600 bg-transparent px-2 py-2.5 text-sm font-bold text-slate-300 transition hover:bg-white/5 disabled:opacity-40"
          >
            {copied ? '已复制 ✓' : '复制文本'}
          </button>
        </div>

        {error && <div className="mt-3 text-center text-sm text-red-400">{error}</div>}

        <div className="mt-4 flex gap-6 text-xs text-slate-500">
          <button onClick={() => backToInput(false)} className="hover:text-slate-300">
            ← 改一改今天的输入
          </button>
          <button onClick={() => backToInput(true)} className="hover:text-slate-300">
            新的一天 →
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
        <p className="mt-2 text-sm text-slate-400">
          把你今天发生的事，写成一份游戏版本更新公告。生成后自动存入本地日记。
        </p>
      </div>
      <textarea
        value={events}
        onChange={(e) => setEvents(e.target.value)}
        rows={7}
        placeholder={'剪头发了\n下午喝了两杯咖啡\n和朋友吵了一架\n晚上跑了 5 公里'}
        className="w-full resize-y rounded-lg border border-white/10 bg-steam-panel/80 p-4 leading-relaxed text-slate-200 outline-none backdrop-blur placeholder:text-slate-600 focus:border-steam-blue"
      />
      <div className="mt-4 flex items-center justify-between gap-4">
        <span className="text-xs text-slate-600">草稿自动保存在本机</span>
        <ClickSpark sparkColor="#a4d007">
          <button
            onClick={() => doGenerate(sarcasmLv, gameLv)}
            disabled={busy || events.trim().length < 2}
            className="rounded bg-steam-green px-6 py-3 font-bold text-steam-dark transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Generate Patch Notes
          </button>
        </ClickSpark>
      </div>
      {error && <div className="mt-3 text-right text-sm text-red-400">{error}</div>}
    </div>
  )
}
