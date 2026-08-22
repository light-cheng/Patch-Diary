import { useRef, useState } from 'react'
import { exportAll, importEntries } from '../api'

export default function BackupView() {
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function onExport() {
    if (busy) return
    setBusy(true)
    setMessage('')
    try {
      const data = await exportAll()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const today = new Date().toISOString().slice(0, 10)
      a.download = `life-diary-backup-${today}.json`
      a.click()
      URL.revokeObjectURL(url)
      setMessage(`已导出 ${data.entries.length} 天的记录`)
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '导出失败')
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
        throw new Error('文件格式不对：缺少 entries 数组')
      }
      if (!window.confirm(`将导入 ${parsed.entries.length} 条记录，相同日期会被覆盖。继续？`)) {
        return
      }
      const r = await importEntries(parsed.entries)
      setMessage(`导入完成：成功 ${r.imported} 条，跳过 ${r.skipped} 条（日期或内容非法）`)
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '导入失败')
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <h2 className="mb-2 text-xl font-bold text-white">备份与恢复</h2>
      <p className="mb-6 text-xs text-slate-500">
        数据库是本机的 SQLite 文件（.wrangler/state/ 下），这个 JSON 是跨机器迁移用的保险。
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <button
          onClick={onExport}
          disabled={busy}
          className="rounded bg-steam-green py-3 font-bold text-steam-dark transition hover:brightness-110 disabled:opacity-40"
        >
          导出全部 JSON
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="rounded border border-slate-600 py-3 font-bold text-slate-300 transition hover:bg-white/5 disabled:opacity-40"
        >
          导入 JSON 文件
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

      {busy && <div className="mt-4 text-sm text-slate-500">处理中…</div>}
      {!busy && message && <div className="mt-4 text-sm text-steam-green">{message}</div>}
    </div>
  )
}
