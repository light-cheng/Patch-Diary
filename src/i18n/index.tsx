import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import en from './locales/en'
import zh from './locales/zh'

export type Locale = 'en' | 'zh'
type Messages = typeof en

const locales: Record<Locale, Messages> = { en, zh: zh as unknown as Messages }
const STORAGE_KEY = 'lpn_lang'

function getInitialLocale(): Locale {
  try {
    const saved = localStorage.getItem(STORAGE_KEY) as Locale | null
    if (saved === 'en' || saved === 'zh') return saved
  } catch {}
  // default English per product requirement
  return 'en'
}

function getByPath(obj: unknown, path: string): string | undefined {
  const parts = path.split('.')
  let cur: unknown = obj
  for (const p of parts) {
    if (cur && typeof cur === 'object' && p in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[p]
    } else return undefined
  }
  return typeof cur === 'string' ? cur : undefined
}

function interpolate(str: string, params?: Record<string, string | number>): string {
  if (!params) return str
  return str.replace(/\{\{(\w+)\}\}/g, (_, k) => String(params[k] ?? `{{${k}}}`))
}

interface I18nContextValue {
  locale: Locale
  setLocale: (l: Locale) => void
  t: (key: string, params?: Record<string, string | number>) => string
  // for array values like loadingLines
  tArray: (key: string) => string[]
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => getInitialLocale())

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l)
    try {
      localStorage.setItem(STORAGE_KEY, l)
    } catch {}
    document.documentElement.lang = l === 'zh' ? 'zh-CN' : 'en'
  }, [])

  useEffect(() => {
    document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en'
  }, [locale])

  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      const msg = getByPath(locales[locale], key) ?? getByPath(locales.en, key) ?? key
      return interpolate(msg, params)
    },
    [locale],
  )

  const tArray = useCallback(
    (key: string): string[] => {
      const parts = key.split('.')
      let cur: unknown = locales[locale]
      for (const p of parts) {
        if (cur && typeof cur === 'object' && p in (cur as Record<string, unknown>)) cur = (cur as Record<string, unknown>)[p]
        else return []
      }
      return Array.isArray(cur) ? (cur as string[]) : []
    },
    [locale],
  )

  const value = useMemo(() => ({ locale, setLocale, t, tArray }), [locale, setLocale, t, tArray])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within I18nProvider')
  return ctx
}

export function useT() {
  return useContext(I18nContext)!.t
}
