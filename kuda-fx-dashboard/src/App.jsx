import React, { useState, useEffect } from 'react'
import PasswordGate     from './components/PasswordGate.jsx'
import Header           from './components/Header.jsx'
import UploadPanel      from './components/UploadPanel.jsx'
import FacilityLimits   from './components/FacilityLimits.jsx'
import CSAMonitor       from './components/CSAMonitor.jsx'
import MTMBridge        from './components/MTMBridge.jsx'
import ScenarioAnalysis from './components/ScenarioAnalysis.jsx'
import TopClientsTable  from './components/TopClientsTable.jsx'
import MaturityProfile     from './components/MaturityProfile.jsx'
import FacilityProjection from './components/FacilityProjection.jsx'
import SettledTrades      from './components/SettledTrades.jsx'
import HistoryChart     from './components/HistoryChart.jsx'
import { LoaderIcon }   from 'lucide-react'

/** Cache key is date-scoped so it auto-expires at midnight */
const TODAY_KEY = () => `kuda_fx_dash_${new Date().toISOString().slice(0, 10)}`

export default function App() {
  return (
    <PasswordGate>
      <Dashboard />
    </PasswordGate>
  )
}

function Dashboard() {
  const [dashData, setDashData] = useState(null)
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    // ── Step 1: try localStorage (instant, no network) ──────────────────────
    try {
      const cached = localStorage.getItem(TODAY_KEY())
      if (cached) {
        setDashData(JSON.parse(cached))
        setLoading(false)
        return
      }
    } catch (_) {}

    // ── Step 2: ask the API if anyone has already uploaded today ─────────────
    // This is what makes the dashboard shared — one upload, everyone sees it.
    fetch('/api/today')
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (data && data.meta) {
          setDashData(data)
          // Cache locally so subsequent visits in same browser skip the API call
          try { localStorage.setItem(TODAY_KEY(), JSON.stringify(data)) } catch (_) {}
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  /** Called after a successful upload */
  const handleData = (data) => {
    setDashData(data)
    try { localStorage.setItem(TODAY_KEY(), JSON.stringify(data)) } catch (_) {}
  }

  /** "New upload" clears local cache so the upload screen appears */
  const handleReset = () => {
    setDashData(null)
    try { localStorage.removeItem(TODAY_KEY()) } catch (_) {}
  }

  // ── Loading splash (checking blob storage) ───────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-kuda-navy flex items-center justify-center gap-3 text-slate-400">
        <LoaderIcon size={18} className="animate-spin" />
        <span className="text-sm font-mono">Loading today's dashboard…</span>
      </div>
    )
  }

  // ── No data yet today — show upload screen ───────────────────────────────
  if (!dashData) {
    return <UploadPanel onData={handleData} />
  }

  // ── Dashboard ─────────────────────────────────────────────────────────────
  const { meta, facility_limits, csa_monitor, mtm_bridge,
          scenario_analysis, top_clients, maturity_profile,
          facility_projection, settled_today } = dashData

  const statusColor = {
    safe:    'bg-kuda-teal',
    watch:   'bg-yellow-400',
    warning: 'bg-amber-500',
    breach:  'bg-red-500',
  }[csa_monitor?.status] || 'bg-slate-600'

  return (
    <div className="min-h-screen bg-kuda-navy">
      {/* Header bar */}
      <Header meta={meta} onReset={handleReset} />

      {/* CSA alert banner (only when not safe) */}
      {csa_monitor?.status && csa_monitor.status !== 'safe' && (
        <div className={`no-print flex items-center justify-center gap-3 py-2 text-xs font-semibold text-kuda-navy ${statusColor}`}>
          {csa_monitor.status === 'breach'
            ? `⚠ CSA BREACH — Kuda MTM ${zarMSimple(csa_monitor.current_mtm_kuda_zar)} is below the −R15M threshold. Collateral call required.`
            : csa_monitor.status === 'warning'
            ? `⚠ CSA WARNING — Kuda MTM ${zarMSimple(csa_monitor.current_mtm_kuda_zar)} approaching threshold. Trigger at ${csa_monitor.trigger_rate}`
            : `ℹ CSA WATCH — MTM ${zarMSimple(csa_monitor.current_mtm_kuda_zar)} — monitor closely. Trigger at USD/ZAR ${csa_monitor.trigger_rate}`
          }
        </div>
      )}

      {/* Dashboard body */}
      <main className="max-w-screen-2xl mx-auto px-4 md:px-6 py-6 space-y-8">
        <FacilityLimits  data={facility_limits}  />
        <CSAMonitor      data={csa_monitor}       />
        <MTMBridge       data={mtm_bridge}        />
        <ScenarioAnalysis data={scenario_analysis} />
        <TopClientsTable data={top_clients}       />
        <MaturityProfile     data={maturity_profile}   />
        <FacilityProjection  data={facility_projection} />
        <SettledTrades       data={settled_today}       />
        <HistoryChart />
      </main>

      {/* Footer */}
      <footer className="border-t border-kuda-border mt-8 py-4 px-6 text-center text-xs text-slate-600">
        CBC Kuda Foreign Exchange (Pty) Ltd · Investec Bank Facility FYN005836 ·
        Data sourced from FXFlow · Generated {new Date(meta.generated_at).toLocaleString('en-ZA')}
      </footer>
    </div>
  )
}

/** Inline micro-formatter for the banner (avoid import issues). */
function zarMSimple(n) {
  if (n == null) return '—'
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : '+'
  if (abs >= 1_000_000) return `${sign}R${(abs / 1_000_000).toFixed(1)}M`
  return `${sign}R${Math.round(abs / 1_000)}K`
}
