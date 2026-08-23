import { useRef, useState } from 'react'
import { exportAll, importEntries } from '../api'
import { downloadJson } from '../lib/browser'
import { useI18n } from '../i18n'

export default function BackupView() {
  const { t } = useI18n()
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function onExport() {
    if (busy) return
    setBusy(true)
    setMessage('')
    try {
      const data = await exportAll()
      const today = new Date().toISOString().slice(0, 10)
      downloadJson(data, `life-diary-backup-${today}.json`)
      setMessage(t('backup.exported', { count: data.entries.length }))
    } catch (e) {
      setMessage(e instanceof Error ? e.message : t('backup.exportFailed'))
    } finally {
      setBusy(false)
    }
  }

  async function onFilePicked(file: File) {
    if (busy) return
    setBusy(true)
    setMessage('')
    try {
      const parsed = JSON.parse(await file.text()) as { entries?: unknown[] }
      if (!parsed || !Array.isArray(parsed.entries)) {
        throw new Error(t('backup.invalidFile'))
      }
      if (!window.confirm(t('backup.importConfirm', { count: parsed.entries.length }))) {
        return
      }
      const r = await importEntries(parsed.entries)
      setMessage(t('backup.importDone', { imported: r.imported, skipped: r.skipped }))
    } catch (e) {
      setMessage(e instanceof Error ? e.message : t('backup.importFailed'))
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <h2 className="mb-2 text-xl font-bold text-white">{t('backup.title')}</h2>
      <p className="mb-6 text-xs text-slate-500">{t('backup.desc')}</p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <button
          onClick={onExport}
          disabled={busy}
          className="rounded bg-steam-green py-3 font-bold text-steam-dark transition hover:brightness-110 disabled:opacity-40"
        >
          {t('backup.export')}
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="rounded border border-slate-600 py-3 font-bold text-slate-300 transition hover:bg-white/5 disabled:opacity-40"
        >
          {t('backup.import')}
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void onFilePicked(f)
        }}
      />

      {busy && <div className="mt-4 text-sm text-slate-500">{t('backup.processing')}</div>}
      {!busy && message && <div className="mt-4 text-sm text-steam-green">{message}</div>}
    </div>
  )
}
