import { useState } from 'react'
import FaultyTerminal from './components/reactbits/FaultyTerminal/FaultyTerminal'
import TodayView from './views/TodayView'
import HistoryView from './views/HistoryView'
import ReportView from './views/ReportView'
import BackupView from './views/BackupView'
import SettingsView from './views/SettingsView'

const TABS = [
  { id: 'today', label: '今日' },
  { id: 'history', label: '历史' },
  { id: 'report', label: '月报' },
  { id: 'backup', label: '备份' },
  { id: 'settings', label: '设置' },
] as const

type TabId = (typeof TABS)[number]['id']

export default function App() {
  const [tab, setTab] = useState<TabId>('today')

  return (
    <div className="relative min-h-dvh">
      <div className="pointer-events-none fixed inset-0 z-0 opacity-60">
        <FaultyTerminal
          mouseReact={false}
          tint="#66c0f4"
          brightness={0.5}
          scanlineIntensity={0.2}
          glitchAmount={0.8}
          flickerAmount={0.6}
          digitSize={1.8}
          timeScale={0.25}
          dither={1}
          curvature={0.12}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-steam-darkest/30 via-steam-darkest/70 to-steam-darkest" />
      </div>

      <div className="relative z-10">
        <nav className="sticky top-0 z-20 border-b border-white/5 bg-steam-darkest/60 backdrop-blur">
          <div className="mx-auto flex max-w-xl items-center justify-center gap-1.5 px-3 py-2.5">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`rounded-full border px-3.5 py-1.5 text-xs transition sm:text-sm ${
                  tab === t.id
                    ? 'border-transparent bg-steam-green font-bold text-black'
                    : 'border-white/10 text-slate-400 hover:bg-white/5 hover:text-slate-200'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </nav>

        {tab === 'today' && <TodayView />}
        {tab === 'history' && <HistoryView />}
        {tab === 'report' && <ReportView />}
        {tab === 'backup' && <BackupView />}
        {tab === 'settings' && <SettingsView />}
      </div>
    </div>
  )
}
