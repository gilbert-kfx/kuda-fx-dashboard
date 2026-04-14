import React, { useState } from 'react'
import Header           from './components/Header.jsx'
import UploadPanel      from './components/UploadPanel.jsx'
import FacilityLimits   from './components/FacilityLimits.jsx'
import CSAMonitor       from './components/CSAMonitor.jsx'
import MTMBridge        from './components/MTMBridge.jsx'
import ScenarioAnalysis from './components/ScenarioAnalysis.jsx'
import TopClientsTable  from './components/TopClientsTable.jsx'
import MaturityProfile  from './components/MaturityProfile.jsx'
import SettledTrades    from './components/SettledTrades.jsx'

export default function App() {
  const [dashData, setDashData] = useState(null)

  const handleData  = (data) => setDashData(data)
  const handleReset = () => setDashData(null)

  if (!dashData) {
    return <UploadPanel onData={handleData} />
  }

  const { meta, facility_limits, csa_monitor, mtm_bridge,
          scenario_analysis, top_clients, maturity_profile, settled_today } = dashData

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
        <MaturityProfile data={maturity_profile}  />
        <SettledTrades   data={settled_today}     />
      </main>

      {/* Footer */}
      <footer className="border-t border-kuda-border mt-8 py-4 px-6 text-center text-xs text-slate-600">
        CBC Kuda Foreign Exchange (Pty) Ltd · Investec Bank Facility FYN005836 ·
        Data sourced from FXFlow · Generated {new Date().toLocaleString('en-ZA')}
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
