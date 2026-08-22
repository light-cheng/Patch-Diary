import { useEffect, useState } from 'react'
import {
  getSettings,
  putSettings,
  testConnection,
  type SettingsData,
  type TestResult,
} from '../api'

export default function SettingsView() {
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
        setMessage(e instanceof Error ? e.message : '加载设置失败')
        setMessageOk(false)
      })
  }, [])

  async function onSave() {
    if (busy) return
    let extraValue: Record<string, unknown> | undefined
    if (extra.trim() !== '') {
      try {
        extraValue = JSON.parse(extra)
        if (extraValue === null || typeof extraValue !== 'object' || Array.isArray(extraValue)) {
          throw new Error('必须是 JSON 对象')
        }
      } catch (err) {
        setMessage(`额外参数不是合法 JSON 对象：${err instanceof Error ? err.message : ''}`)
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
      setMessage('已保存，之后所有生成都走这套配置')
      setMessageOk(true)
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '保存失败')
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

  if (!loaded && !message) return <div className="px-4 py-8 text-sm text-slate-500">加载中…</div>

  const keyPlaceholder =
    loaded?.apiKeyMasked !== ''
      ? `已配置（${loaded?.apiKeyMasked}），留空则不修改`
      : '填入 API Key'

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <h2 className="mb-1 text-xl font-bold text-white">API 设置</h2>
      <p className="mb-6 text-xs text-slate-500">
        兼容 OpenAI 接口格式的服务商都能用：OpenRouter / DashScope / DeepSeek / Moonshot…改完点保存即可切换。
        {loaded?.keySource === 'env' && ' 当前 key 来自 .dev.vars 文件。'}
      </p>

      <div className="space-y-4">
        <Field label="Base URL" hint="OpenAI 兼容的 completions 根地址">
          <input
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://openrouter.ai/api/v1"
            className={inputCls}
          />
        </Field>

        <Field label="API Key" hint="只存在本机数据库里，页面上永远只显示打码版本">
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={keyPlaceholder}
            autoComplete="off"
            className={inputCls}
          />
        </Field>

        <Field label="模型 ID">
          <input
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="stealth/ox-alpha"
            className={inputCls}
          />
        </Field>

        <div>
          <div className="mb-1.5 flex items-baseline justify-between">
            <span className="text-xs font-bold text-slate-400">温度 temperature</span>
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
            <span>0 · 一本正经</span>
            <span>1 · 常用</span>
            <span>2 · 放飞</span>
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
            <span className="text-sm font-bold text-slate-300">推理模式</span>
            <span className="ml-2 text-xs text-slate-500">ox-alpha 等 reasoning 模型需要开启；普通模型关掉更快</span>
          </span>
        </label>

        <Field label="额外请求参数 JSON" hint={'可选。如 {"max_tokens":2000}，核心字段不可覆盖'}>
          <textarea
            value={extra}
            onChange={(e) => setExtra(e.target.value)}
            rows={3}
            placeholder='{"max_tokens": 2000}'
            className={`${inputCls} resize-y font-mono text-xs`}
          />
        </Field>
      </div>

      <div className="mt-6 flex gap-2">
        <button
          onClick={onSave}
          disabled={busy}
          className="rounded bg-steam-green px-6 py-2.5 font-bold text-steam-dark transition hover:brightness-110 disabled:opacity-40"
        >
          保存设置
        </button>
        <button
          onClick={onTest}
          disabled={busy}
          className="rounded border border-slate-600 px-6 py-2.5 font-bold text-slate-300 transition hover:bg-white/5 disabled:opacity-40"
        >
          测试连接
        </button>
      </div>

      {message && (
        <div className={`mt-4 text-sm ${messageOk ? 'text-steam-green' : 'text-red-400'}`}>{message}</div>
      )}

      {test && (
        <div
          className={`mt-3 rounded border p-3 font-mono text-xs ${
            test.ok ? 'border-steam-green/30 bg-steam-green/5 text-steam-green' : 'border-red-500/30 bg-red-500/5 text-red-400'
          }`}
        >
          {test.ok ? (
            <>
              ✓ 连接成功 · {test.model} · {test.latencyMs}ms
            </>
          ) : (
            <>✗ {test.error}</>
          )}
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
