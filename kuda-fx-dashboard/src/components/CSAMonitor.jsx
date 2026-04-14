import React from 'react'
import { BellIcon, AlertTriangleIcon, CheckCircleIcon, ShieldAlertIcon } from 'lucide-react'
import { zarM, pct, rate, statusPill, cap } from '../utils/formatters'

const THRESHOLD = -15_000_000

export default function CSAMonitor({ data }) {
  if (!data) return null
  const {
    current_mtm_kuda_zar, csa_threshold_zar, buffer_zar,
    pct_threshold_remaining, trigger_rate, rate_move_to_trigger_pct,
    sensitivity_zar_per_pt, status, min_transfer_zar,
    collateral_contact, notification_time,
  } = data

  const statusColors = { safe: '#00C896', watch: '#FBBF24', warning: '#F59E0B', breach: '#EF4444' }
  const statusColor  = statusColors[status] || '#94a3b8'

  // Buffer bar: how far current MTM is from threshold
  // buffer_zar = current_mtm - threshold  (e.g. 2.87M - (-15M) = 17.87M)
  // Max buffer we show = 30M (comfortable headroom)
  const bufferPct    = Math.max(0, Math.min(100, (buffer_zar / 30_000_000) * 100))
  const bufferColor  = buffer_zar > 10_000_000 ? '#00C896' : buffer_zar > 3_000_000 ? '#F59E0B' : '#EF4444'

  // Trigger rate distance from spot
  const spotRate = data.spot_usd_zar || 0
  const triggerDistance = trigger_rate && spotRate ? (trigger_rate - spotRate).toFixed(2) : null
  const triggerColor = !trigger_rate ? '#94a3b8'
    : trigger_rate - spotRate > 3 ? '#00C896'
    : trigger_rate - spotRate > 1 ? '#F59E0B'
    : '#EF4444'

  return (
    <section>
      <h2 className="section-title">2 · CSA Threshold Monitor</h2>

      {/* Top row: 4 big metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">

        {/* Current MTM */}
        <BigMetricCard
          label="Kuda MTM"
          value={zarM(current_mtm_kuda_zar)}
          sub="vs −R15M threshold"
          color={statusColor}
          badge={<span className={statusPill(status)}>
            {status === 'safe' && <CheckCircleIcon size={10} className="mr-1" />}
            {(status === 'watch' || status === 'warning') && <BellIcon size={10} className="mr-1" />}
            {status === 'breach' && <AlertTriangleIcon size={10} className="mr-1" />}
            {cap(status)}
          </span>}
        />

        {/* ── TRIGGER RATE — prominent ── */}
        <div className="card flex flex-col justify-between" style={{ borderColor: triggerColor, borderWidth: 1 }}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-slate-300">CSA Trigger Rate</p>
            <AlertTriangleIcon size={14} style={{ color: triggerColor }} />
          </div>
          <div>
            <p className="text-4xl font-mono font-bold" style={{ color: triggerColor }}>
              {trigger_rate ? rate(trigger_rate, 2) : 'N/A'}
            </p>
            <p className="text-xs text-slate-500 mt-1">USD/ZAR</p>
          </div>
          <div className="mt-3 pt-3 border-t border-kuda-border space-y-1">
            {triggerDistance && (
              <p className="text-xs font-mono" style={{ color: triggerColor }}>
                {triggerDistance > 0 ? '+' : ''}{triggerDistance} pts from spot
              </p>
            )}
            {rate_move_to_trigger_pct && (
              <p className="text-xs text-slate-500">
                {rate_move_to_trigger_pct > 0 ? '+' : ''}{rate_move_to_trigger_pct}% ZAR move to trigger
              </p>
            )}
            <p className="text-[10px] text-slate-600">MTM hits −R15M at this rate</p>
          </div>
        </div>

        {/* Buffer */}
        <BigMetricCard
          label="Buffer to Threshold"
          value={zarM(buffer_zar)}
          sub={`${pct(pct_threshold_remaining)} of headroom remaining`}
          color={buffer_zar > 10_000_000 ? '#00C896' : buffer_zar > 3_000_000 ? '#F59E0B' : '#EF4444'}
        />

        {/* Sensitivity */}
        <BigMetricCard
          label="Book Sensitivity"
          value={`−R${(sensitivity_zar_per_pt / 1_000_000).toFixed(2)}M`}
          sub="per 1 USD/ZAR point move"
          color="#94a3b8"
        />
      </div>

      {/* Bottom row: buffer bar + mechanics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Buffer visualiser */}
        <div className="card">
          <p className="text-xs font-semibold text-slate-300 mb-3">MTM Position vs CSA Threshold</p>
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-slate-500">CSA Threshold −R15M</span>
            <span className="font-mono font-semibold" style={{ color: bufferColor }}>
              Buffer: {zarM(buffer_zar)}
            </span>
          </div>
          <div className="relative h-5 bg-kuda-navymid rounded-full overflow-hidden">
            <div className="absolute left-0 top-0 h-full w-1/2 bg-red-500/20" />
            <div className="absolute left-1/2 top-0 h-full w-0.5 bg-red-500/60" />
            <div
              className="absolute top-0 h-full rounded-full transition-all duration-700"
              style={{ width: `${bufferPct}%`, background: `linear-gradient(90deg, #EF444440, ${bufferColor})` }}
            />
            <span className="absolute left-2 top-0 h-full flex items-center text-[9px] text-red-400 font-semibold">BREACH</span>
            <span className="absolute right-2 top-0 h-full flex items-center text-[9px] text-kuda-teal font-semibold">SAFE →</span>
          </div>
          <div className="flex justify-between text-[10px] text-slate-600 mt-1">
            <span>−R30M</span>
            <span className="text-red-500 font-semibold">−R15M threshold</span>
            <span>+R15M</span>
          </div>
        </div>

        {/* CSA Mechanics */}
        <div className="card">
          <p className="text-xs font-semibold text-slate-300 mb-3">CSA Mechanics — ISDA Credit Support Annex</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
            <MechRow icon="⚖️" label="Threshold"    value="−R 15,000,000" />
            <MechRow icon="🔻" label="On EOD"       value="Drops to zero" />
            <MechRow icon="↕️" label="Min Transfer" value={zarM(min_transfer_zar)} />
            <MechRow icon="🕛" label="By"           value={notification_time} />
            <MechRow icon="📞" label="Contact"      value="Janine Clarence" wrap />
            <MechRow icon="✉️" label="Email"        value="collateral@investec" wrap />
          </div>
        </div>

      </div>
    </section>
  )
}

function BigMetricCard({ label, value, sub, color, badge }) {
  return (
    <div className="card flex flex-col justify-between">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-slate-300">{label}</p>
        {badge}
      </div>
      <p className="text-3xl font-mono font-bold" style={{ color }}>{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-2">{sub}</p>}
    </div>
  )
}

function MetricRow({ label, value, sub, color }) {
  return (
    <div>
      <p className="text-slate-500 text-xs">{label}</p>
      <p className={`font-mono font-semibold text-sm mt-0.5 ${color}`}>{value}</p>
      {sub && <p className="text-xs text-slate-600 mt-0.5">{sub}</p>}
    </div>
  )
}

function MechRow({ icon, label, value, wrap }) {
  return (
    <div className={`flex gap-2 ${wrap ? 'items-start' : 'items-center'}`}>
      <span className="text-base w-5 shrink-0">{icon}</span>
      <span className="text-slate-500 shrink-0 w-24">{label}</span>
      <span className="text-slate-300 font-mono">{value}</span>
    </div>
  )
}
