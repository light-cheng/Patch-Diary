import { useEffect, useState } from 'react'
import { getSettings, putSettings, testConnection, type SettingsData, type TestResult } from '../api'
import { useI18n } from '../i18n'

export default function SettingsView() {
  const { t, locale, setLocale } = useI18n()
  const [loaded, setLoaded] = useState<SettingsData | null>(null)
  const [baseUrl, setBaseUrl] = useState('')
  const [model, setModel] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [temperature, setTemperature] = useState(1)
  const [reasoning, setReasoning] = useState(true)
  const [extra, setExtra] = useState('')
  const [message, setMessage] = useState('')
  const [messageOk, setMessageOk] = useState(false)
  const [test, setTest] = useState<TestResult | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    getSettings()
      .then((s) => {
        setLoaded(s)
        setBaseUrl(s.baseUrl)
        setModel(s.model)
        setTemperature(s.temperature)
        setReasoning(s.reasoning)
        setExtra(s.extra ? JSON.stringify(s.extra) : '')
      })
      .catch((e) => {
        setMessage(e instanceof Error ? e.message : t('settings.loadFailed'))
        setMessageOk(false)
      })
  }, [t])

  async function onSave() {
    if (busy) return
    let extraValue: Record<string, unknown> | undefined
    if (extra.trim() !== '') {
      try {
        extraValue = JSON.parse(extra)
        if (extraValue === null || typeof extraValue !== 'object' || Array.isArray(extraValue)) {
          throw new Error('must be object')
        }
      } catch (err) {
        setMessage(t('settings.extraInvalid', { msg: err instanceof Error ? err.message : '' }))
        setMessageOk(false)
        return
      }
    }

    setBusy(true)
    setMessage('')
    try {
      const payload: Record<string, unknown> = {
        baseUrl,
        model,
        temperature,
        reasoning,
      }
      if (apiKey.trim() !== '') payload.apiKey = apiKey.trim()
      if (extraValue !== undefined) payload.extra = extraValue
      const s = await putSettings(payload)
      setLoaded(s)
      setApiKey('')
      setMessage(t('settings.saved'))
      setMessageOk(true)
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Save failed')
      setMessageOk(false)
    } finally {
      setBusy(false)
    }
  }

  async function onTest() {
    if (busy) return
    setBusy(true)
    setTest(null)
    try {
      const r = await testConnection()
      setTest(r)
    } finally {
      setBusy(false)
    }
  }

  if (!loaded && !message) return <div className="px-4 py-8 text-sm text-slate-500">{t('settings.loading')}</div>

  const keyPlaceholder =
    loaded?.apiKeyMasked !== ''
      ? t('settings.apiKeyPlaceholderConfigured', { masked: loaded?.apiKeyMasked ?? '' })
      : t('settings.apiKeyPlaceholderEmpty')

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <h2 className="mb-1 text-xl font-bold text-white">{t('settings.title')}</h2>
      <p className="mb-6 text-xs text-slate-500">
        {t('settings.desc')}
        {loaded?.keySource === 'env' ? t('settings.envHint') : ''}
      </p>

      <div className="space-y-4">
        <Field label={t('settings.baseUrl')} hint={t('settings.baseUrlHint')}>
          <input
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://openrouter.ai/api/v1"
            className={inputCls}
          />
        </Field>

        <Field label={t('settings.apiKey')} hint={t('settings.apiKeyHint')}>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={keyPlaceholder}
            autoComplete="off"
            className={inputCls}
          />
        </Field>

        <Field label={t('settings.model')}>
          <input
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="stealth/ox-alpha"
            className={inputCls}
          />
        </Field>

        <div>
          <div className="mb-1.5 flex items-baseline justify-between">
            <span className="text-xs font-bold text-slate-400">{t('settings.temperature')}</span>
            <span className="font-mono text-xs text-steam-green">{temperature.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min={0}
            max={2}
            step={0.05}
            value={temperature}
            onChange={(e) => setTemperature(Number(e.target.value))}
            className="w-full accent-[#a4d007]"
          />
          <div className="mt-0.5 flex justify-between text-[10px] text-slate-600">
            <span>{t('settings.tempPrecise')}</span>
            <span>{t('settings.tempBalanced')}</span>
            <span>{t('settings.tempWild')}</span>
          </div>
        </div>

        <label className="flex cursor-pointer items-center gap-3 rounded border border-white/5 bg-black/20 p-3">
          <input
            type="checkbox"
            checked={reasoning}
            onChange={(e) => setReasoning(e.target.checked)}
            className="h-4 w-4 accent-[#a4d007]"
          />
          <span>
            <span className="text-sm font-bold text-slate-300">{t('settings.reasoning')}</span>
            <span className="ml-2 text-xs text-slate-500">{t('settings.reasoningHint')}</span>
          </span>
        </label>

        <Field label={t('settings.extra')} hint={t('settings.extraHint')}>
          <textarea
            value={extra}
            onChange={(e) => setExtra(e.target.value)}
            rows={3}
            placeholder='{"max_tokens": 2000}'
            className={`${inputCls} resize-y font-mono text-xs`}
          />
        </Field>

        {/* Language */}
        <Field label={locale === 'zh' ? '界面语言 / Language' : 'Language / 界面语言'}>
          <div className="flex gap-2">
            <button
              onClick={() => setLocale('en')}
              className={`flex-1 rounded border px-3 py-2 text-sm font-bold transition ${locale === 'en' ? 'border-steam-green bg-steam-green/15 text-steam-green' : 'border-white/10 text-slate-400 hover:bg-white/5'}`}
            >
              English
            </button>
            <button
              onClick={() => setLocale('zh')}
              className={`flex-1 rounded border px-3 py-2 text-sm font-bold transition ${locale === 'zh' ? 'border-steam-green bg-steam-green/15 text-steam-green' : 'border-white/10 text-slate-400 hover:bg-white/5'}`}
            >
              中文
            </button>
          </div>
        </Field>
      </div>

      <div className="mt-6 flex gap-2">
        <button
          onClick={onSave}
          disabled={busy}
          className="rounded bg-steam-green px-6 py-2.5 font-bold text-steam-dark transition hover:brightness-110 disabled:opacity-40"
        >
          {t('settings.save')}
        </button>
        <button
          onClick={onTest}
          disabled={busy}
          className="rounded border border-slate-600 px-6 py-2.5 font-bold text-slate-300 transition hover:bg-white/5 disabled:opacity-40"
        >
          {t('settings.test')}
        </button>
      </div>

      {message && <div className={`mt-4 text-sm ${messageOk ? 'text-steam-green' : 'text-red-400'}`}>{message}</div>}

      {test && (
        <div
          className={`mt-3 rounded border p-3 font-mono text-xs ${test.ok ? 'border-steam-green/30 bg-steam-green/5 text-steam-green' : 'border-red-500/30 bg-red-500/5 text-red-400'}`}
        >
          {test.ok ? <>{t('settings.testSuccess', { model: test.model, ms: test.latencyMs })}</> : <>{t('settings.testFailed', { error: test.error })}</>}
        </div>
      )}
    </div>
  )
}

const inputCls =
  'w-full rounded border border-white/10 bg-steam-panel/80 px-3 py-2 text-sm text-slate-200 outline-none backdrop-blur placeholder:text-slate-600 focus:border-steam-blue'

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5">
        <span className="text-xs font-bold text-slate-400">{label}</span>
        {hint && <span className="ml-2 text-[11px] text-slate-600">{hint}</span>}
      </div>
      {children}
    </div>
  )
}
