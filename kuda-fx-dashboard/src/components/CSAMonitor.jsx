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

  return (
    <section>
      <h2 className="section-title">2 · CSA Threshold Monitor</h2>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* MTM status card */}
        <div className="card flex flex-col justify-between">
          {/* Status badge */}
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-semibold text-slate-300">Kuda MTM vs Threshold</p>
            <span className={statusPill(status)}>
              {status === 'safe'    && <CheckCircleIcon    size={10} className="mr-1" />}
              {status === 'watch'   && <BellIcon           size={10} className="mr-1" />}
              {status === 'warning' && <ShieldAlertIcon    size={10} className="mr-1" />}
              {status === 'breach'  && <AlertTriangleIcon  size={10} className="mr-1" />}
              {cap(status)}
            </span>
          </div>

          {/* Big MTM number */}
          <div className="text-center py-4">
            <p className="text-5xl font-mono font-bold" style={{ color: statusColor }}>
              {zarM(current_mtm_kuda_zar)}
            </p>
            <p className="text-xs text-slate-500 mt-1">Current Kuda MTM</p>
          </div>

          {/* Visual buffer bar */}
          <div className="mt-2">
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-slate-500">CSA Threshold −R15M</span>
              <span className="font-mono font-semibold" style={{ color: bufferColor }}>
                Buffer: {zarM(buffer_zar)}
              </span>
            </div>
            {/* Track: threshold on left, MTM position shown */}
            <div className="relative h-4 bg-kuda-navymid rounded-full overflow-hidden">
              {/* Danger zone (left 0–50%) */}
              <div className="absolute left-0 top-0 h-full w-1/2 bg-red-500/20" />
              {/* Threshold line at 50% */}
              <div className="absolute left-1/2 top-0 h-full w-0.5 bg-red-500/60" />
              {/* MTM position marker */}
              <div
                className="absolute top-0 h-full rounded-full transition-all duration-700"
                style={{
                  width: `${bufferPct}%`,
                  background: `linear-gradient(90deg, #EF444440, ${bufferColor})`,
                }}
              />
              {/* Label: BREACH | SAFE */}
              <span className="absolute left-2 top-0 h-full flex items-center text-[9px] text-red-400 font-semibold">BREACH</span>
              <span className="absolute right-2 top-0 h-full flex items-center text-[9px] text-kuda-teal font-semibold">SAFE</span>
            </div>
            <div className="flex justify-between text-[10px] text-slate-600 mt-1">
              <span>−R30M</span>
              <span className="text-red-500">−R15M ↑</span>
              <span>+R15M</span>
            </div>
          </div>
        </div>

        {/* Metrics */}
        <div className="card">
          <p className="text-xs font-semibold text-slate-300 mb-4">Threshold Metrics</p>
          <div className="space-y-4">
            <MetricRow
              label="CSA Threshold"
              value={zarM(csa_threshold_zar)}
              sub="Investec calls collateral at this level"
              color="text-red-400"
            />
            <MetricRow
              label="Buffer to Threshold"
              value={zarM(buffer_zar)}
              sub={`${pct(pct_threshold_remaining)} of threshold headroom used`}
              color={buffer_zar > 5_000_000 ? 'text-kuda-teal' : buffer_zar > 0 ? 'text-amber-400' : 'text-red-400'}
            />
            <MetricRow
              label="Trigger Rate (USD/ZAR)"
              value={trigger_rate ? rate(trigger_rate, 2) : 'N/A'}
              sub={trigger_rate && rate_move_to_trigger_pct
                ? `${rate_move_to_trigger_pct > 0 ? '+' : ''}${rate_move_to_trigger_pct}% move from today's spot`
                : 'Rate at which MTM hits −R15M'}
              color="text-amber-400"
            />
            <MetricRow
              label="Book Sensitivity"
              value={`−R${(sensitivity_zar_per_pt / 1_000_000).toFixed(2)}M / pt`}
              sub="MTM impact per 1 USD/ZAR point (ZAR weakening)"
              color="text-slate-300"
            />
          </div>
        </div>

        {/* Mechanics */}
        <div className="card">
          <p className="text-xs font-semibold text-slate-300 mb-4">CSA Mechanics — ISDA Credit Support Annex</p>
          <div className="space-y-3 text-xs">
            <MechRow icon="⚖️" label="Threshold"     value="−R 15,000,000" />
            <MechRow icon="🔻" label="On EOD"        value="Threshold drops to zero" />
            <MechRow icon="↕️" label="Min Transfer"  value={zarM(min_transfer_zar)} />
            <MechRow icon="🕛" label="Notification" value={`By ${notification_time}`} />
            <MechRow icon="📞" label="Contact"      value={collateral_contact} wrap />
          </div>
          <div className="mt-5 pt-4 border-t border-kuda-border">
            <p className="text-xs text-slate-500 mb-2">Buffer remaining to threshold</p>
            <div className="h-2 bg-kuda-navymid rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.max(0, Math.min(100, pct_threshold_remaining))}%`,
                  background: pct_threshold_remaining > 50 ? '#00C896' : pct_threshold_remaining > 20 ? '#F59E0B' : '#EF4444',
                }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-slate-600 mt-1">
              <span>0%</span>
              <span className="font-mono" style={{ color: bufferColor }}>{pct(pct_threshold_remaining)}</span>
              <span>100%</span>
            </div>
          </div>
        </div>

      </div>
    </section>
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
