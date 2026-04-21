import React, { useState, useEffect, Component } from 'react'
import PasswordGate       from './components/PasswordGate.jsx'
import Header             from './components/Header.jsx'
import UploadPanel        from './components/UploadPanel.jsx'
import FacilityLimits     from './components/FacilityLimits.jsx'
import CSAMonitor         from './components/CSAMonitor.jsx'
import MTMBridge          from './components/MTMBridge.jsx'
import ScenarioAnalysis   from './components/ScenarioAnalysis.jsx'
import TopClientsTable    from './components/TopClientsTable.jsx'
import MaturityProfile    from './components/MaturityProfile.jsx'
import FacilityProjection from './components/FacilityProjection.jsx'
import SettledTrades      from './components/SettledTrades.jsx'
import HistoryChart       from './components/HistoryChart.jsx'
import ClientBook         from './components/ClientBook.jsx'
import { LoaderIcon, LayoutDashboardIcon, UsersIcon } from 'lucide-react'

/** Cache key is date-scoped so it auto-expires at midnight */
const TODAY_KEY = () => `kuda_fx_dash_${new Date().toISOString().slice(0, 10)}`

/** Catches render crashes so the whole screen doesn't go blank */
class ErrorBoundary extends Component {
  state = { error: null }
  static getDerivedStateFromError(e) { return { error: e } }
  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-kuda-navy flex flex-col items-center justify-center gap-4 px-6 text-center">
          <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
            <span className="text-red-400 text-xl">!</span>
          </div>
          <div>
            <p className="text-white font-semibold mb-1">Something went wrong</p>
            <p className="text-slate-400 text-sm max-w-sm">{this.state.error?.message}</p>
          </div>
          <button
            onClick={() => { localStorage.clear(); window.location.reload() }}
            className="btn-primary text-sm mt-2"
          >
            Clear cache &amp; reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <PasswordGate>
        <Dashboard />
      </PasswordGate>
    </ErrorBoundary>
  )
}

function Dashboard() {
  const [dashData, setDashData] = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [tab,      setTab]      = useState('dashboard') // 'dashboard' | 'clients'

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
    fetch('/api/today')
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (data && data.meta) {
          setDashData(data)
          try { localStorage.setItem(TODAY_KEY(), JSON.stringify(data)) } catch (_) {}
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleData = (data) => {
    setDashData(data)
    try { localStorage.setItem(TODAY_KEY(), JSON.stringify(data)) } catch (_) {}
  }

  const handleReset = () => {
    setDashData(null)
    try { localStorage.removeItem(TODAY_KEY()) } catch (_) {}
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-kuda-navy flex items-center justify-center gap-3 text-slate-400">
        <LoaderIcon size={18} className="animate-spin" />
        <span className="text-sm font-mono">Loading today's dashboard…</span>
      </div>
    )
  }

  if (!dashData) {
    return <UploadPanel onData={handleData} />
  }

  const {
    meta, facility_limits, csa_monitor, mtm_bridge,
    scenario_analysis, top_clients, maturity_profile,
    facility_projection, settled_today, client_book,
  } = dashData

  const statusColor = {
    safe:    'bg-kuda-teal',
    watch:   'bg-kuda-blue',
    warning: 'bg-orange-500',
    breach:  'bg-red-500',
  }[csa_monitor?.status] || 'bg-slate-600'

  return (
    <div className="min-h-screen bg-kuda-navy">
      {/* Header bar */}
      <Header meta={meta} onReset={handleReset} />

      {/* CSA alert banner (only when not safe) */}
      {csa_monitor?.status && csa_monitor.status !== 'safe' && (
        <div className={`no-print flex items-center justify-center gap-3 py-2 text-xs font-semibold text-white ${statusColor}`}>
          {csa_monitor.status === 'breach'
            ? `⚠ CSA BREACH — Kuda MTM ${zarMSimple(csa_monitor.current_mtm_kuda_zar)} is below the −R15M threshold. Collateral call required.`
            : csa_monitor.status === 'warning'
            ? `⚠ CSA WARNING — Kuda MTM ${zarMSimple(csa_monitor.current_mtm_kuda_zar)} approaching threshold. Trigger at ${csa_monitor.trigger_rate}`
            : `ℹ CSA WATCH — MTM ${zarMSimple(csa_monitor.current_mtm_kuda_zar)} — monitor closely. Trigger at USD/ZAR ${csa_monitor.trigger_rate}`
          }
        </div>
      )}

      {/* ── Tab nav ─────────────────────────────────────────────────────── */}
      <div className="border-b border-kuda-border bg-kuda-navy no-print">
        <div className="max-w-screen-2xl mx-auto px-4 md:px-6 flex items-center gap-1">
          <TabBtn
            active={tab === 'dashboard'}
            icon={<LayoutDashboardIcon size={13} />}
            label="Risk Dashboard"
            onClick={() => setTab('dashboard')}
          />
          <TabBtn
            active={tab === 'clients'}
            icon={<UsersIcon size={13} />}
            label={`Client Book${client_book?.clients?.length ? ` (${client_book.clients.length})` : ''}`}
            onClick={() => setTab('clients')}
          />
        </div>
      </div>

      {/* ── Dashboard tab ────────────────────────────────────────────────── */}
      {tab === 'dashboard' && (
        <main className="max-w-screen-2xl mx-auto px-4 md:px-6 py-6 space-y-8">
          <FacilityLimits    data={facility_limits}    />
          <CSAMonitor        data={csa_monitor}         />
          <MTMBridge         data={mtm_bridge}          />
          <ScenarioAnalysis  data={scenario_analysis}   />
          <TopClientsTable   data={top_clients}         />
          <MaturityProfile   data={maturity_profile}    />
          <FacilityProjection data={facility_projection} />
          <SettledTrades     data={settled_today}       />
          <HistoryChart />
        </main>
      )}

      {/* ── Client Book tab ──────────────────────────────────────────────── */}
      {tab === 'clients' && (
        <main className="max-w-screen-2xl mx-auto px-4 md:px-6 py-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-white">Client Book</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Per-client positions · Generate weekly mailers · MTM as at {
                  meta?.mtm_date
                    ? new Date(meta.mtm_date).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' })
                    : '—'
                }
              </p>
            </div>
          </div>
          <ClientBook data={client_book} meta={meta} facilityLimits={facility_limits} />
        </main>
      )}

      {/* Footer */}
      <footer className="border-t border-kuda-border mt-8 py-4 px-6 text-center text-xs text-slate-600">
        CBC Kuda Foreign Exchange (Pty) Ltd · FX Facility Management · Investec Bank FYN005836 ·
        Data sourced from FXFlow · Generated {new Date(meta.generated_at).toLocaleString('en-ZA')}
      </footer>
    </div>
  )
}

function TabBtn({ active, icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-all ${
        active
          ? 'border-kuda-teal text-white'
          : 'border-transparent text-slate-500 hover:text-slate-300 hover:border-slate-600'
      }`}
    >
      {icon}
      {label}
    </button>
  )
}

/** Inline micro-formatter for the CSA banner. */
function zarMSimple(n) {
  if (n == null) return '—'
  const abs  = Math.abs(n)
  const sign = n < 0 ? '-' : '+'
  if (abs >= 1_000_000) return `${sign}R${(abs / 1_000_000).toFixed(1)}M`
  return `${sign}R${Math.round(abs / 1_000)}K`
}
