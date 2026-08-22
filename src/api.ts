import { parsePatchData, type PatchData } from './schema'

export class ApiError extends Error {
  constructor(message: string) {
    super(message)
  }
}

export interface EntryMeta {
  date: string
  version: string
  preview: string
  updated_at: string
}

export interface FullEntry {
  date: string
  events_text: string
  version: string
  updated_at: string
  patch: PatchData | null
}

export interface MonthRow {
  date: string
  events_text: string
  version: string
  patch: unknown
}

export interface SettingsData {
  baseUrl: string
  model: string
  temperature: number
  reasoning: boolean
  extra: Record<string, unknown> | null
  apiKeyMasked: string
  hasEnvKey: boolean
  keySource: 'db' | 'env' | 'none'
}

export type TestResult =
  | { ok: true; model: string; latencyMs: number }
  | { ok: false; error: string; model?: string }

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(url, init)
  } catch {
    throw new ApiError('网络出错了，检查一下服务是否在跑')
  }
  const body = (await res.json().catch(() => null)) as (T & { ok?: boolean; error?: string }) | null
  if (!res.ok || !body?.ok) {
    throw new ApiError(body?.error ?? `请求失败（${res.status}）`)
  }
  return body
}

function post<T>(url: string, data: unknown): Promise<T> {
  return request<T>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

export interface StyleLevels {
  sarcasm: number
  game: number
}

export async function generatePatchNotes(
  events: string,
  levels: StyleLevels,
): Promise<PatchData> {
  const body = await post<{ data?: unknown }>('/api/generate', { events, sarcasmLv: levels.sarcasm, gameLv: levels.game })
  const data = parsePatchData(body.data)
  if (!data) throw new ApiError('生成结果解析失败，点「再试一次」')
  return data
}

export async function saveEntry(
  date: string,
  events: string,
  patch: PatchData,
  version: string,
): Promise<void> {
  await request<{ ok: boolean }>('/api/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date, events, patch, version }),
  })
}

export async function fetchEntries(): Promise<EntryMeta[]> {
  const body = await request<{ entries?: EntryMeta[] }>('/api/entries')
  return body.entries ?? []
}

export async function fetchEntry(date: string): Promise<FullEntry | null> {
  try {
    const body = await request<{ entry?: FullEntry }>(`/api/entry/${date}`)
    return body.entry ?? null
  } catch {
    return null
  }
}

export async function deleteEntry(date: string): Promise<void> {
  await request<{ ok: boolean }>(`/api/entry/${date}`, { method: 'DELETE' })
}

export async function fetchMonth(ym: string): Promise<MonthRow[]> {
  const body = await request<{ entries?: MonthRow[] }>(`/api/month/${ym}`)
  return body.entries ?? []
}

export async function exportAll(): Promise<{ entries: unknown[] }> {
  return request<{ entries: unknown[] }>('/api/export')
}

export async function importEntries(entries: unknown[]): Promise<{ imported: number; skipped: number }> {
  return post<{ imported: number; skipped: number }>('/api/import', { entries })
}

export async function getSettings(): Promise<SettingsData> {
  return request<SettingsData>('/api/settings')
}

export async function putSettings(payload: Record<string, unknown>): Promise<SettingsData> {
  return request<SettingsData>('/api/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export async function testConnection(): Promise<TestResult> {
  try {
    return await post<TestResult>('/api/settings/test', {})
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '连接失败' }
  }
}

export async function generateReport(
  digest: unknown,
  aggregate: unknown,
): Promise<PatchData> {
  const body = await post<{ data?: unknown }>('/api/report', { digest, aggregate })
  const data = parsePatchData(body.data)
  if (!data) throw new ApiError('月报解析失败，再试一次')
  return data
}
