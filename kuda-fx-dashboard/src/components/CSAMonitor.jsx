import React from 'react'
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
} from 'recharts'
import { BellIcon, AlertTriangleIcon, CheckCircleIcon } from 'lucide-react'
import { zarM, pct, rate, statusPill, cap } from '../utils/formatters'

const CSA_MIN   = -20_000_000   // gauge min ZAR
const CSA_MAX   =  10_000_000   // gauge max ZAR
const THRESHOLD = -15_000_000

export default function CSAMonitor({ data }) {
  if (!data) return null
  const {
    current_mtm_kuda_zar, csa_threshold_zar, buffer_zar,
    pct_threshold_remaining, trigger_rate, rate_move_to_trigger_pct,
    sensitivity_zar_per_pt, status, min_transfer_zar,
    collateral_contact, notification_time,
  } = data

  // Gauge needle angle: -90° = leftmost, +90° = rightmost
  const fraction = (current_mtm_kuda_zar - CSA_MIN) / (CSA_MAX - CSA_MIN)
  const needleAngle = -90 + fraction * 180   // degrees

  const statusColors = {
    safe:    '#00C896',
    watch:   '#FBBF24',
    warning: '#F59E0B',
    breach:  '#EF4444',
  }
  const statusColor = statusColors[status] || '#94a3b8'

  return (
    <section>
      <h2 className="section-title">2 · CSA Threshold Monitor</h2>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Gauge panel */}
        <div className="card lg:col-span-1 flex flex-col items-center">
          <Gauge mtm={current_mtm_kuda_zar} color={statusColor} />
          <div className="text-center mt-2">
            <p className={`text-3xl font-mono font-bold`} style={{ color: statusColor }}>
              {zarM(current_mtm_kuda_zar)}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">Kuda MTM (ZAR)</p>
            <span className={statusPill(status) + ' mt-2'}>
              {status === 'safe' && <CheckCircleIcon size={10} className="mr-1" />}
              {(status === 'warning' || status === 'watch') && <BellIcon size={10} className="mr-1" />}
              {status === 'breach' && <AlertTriangleIcon size={10} className="mr-1" />}
              {cap(status)}
            </span>
          </div>
        </div>

        {/* Metrics grid */}
        <div className="card lg:col-span-1">
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
              sub={`${pct(pct_threshold_remaining)} of threshold remaining`}
              color={buffer_zar > 5_000_000 ? 'text-kuda-teal' : buffer_zar > 0 ? 'text-amber-400' : 'text-red-400'}
            />
            <MetricRow
              label="Trigger Rate (USD/ZAR)"
              value={trigger_rate ? rate(trigger_rate, 2) : 'N/A'}
              sub={trigger_rate && rate_move_to_trigger_pct
                ? `${rate_move_to_trigger_pct > 0 ? '+' : ''}${rate_move_to_trigger_pct}% from current spot`
                : 'Rate at which MTM hits −R15M'}
              color="text-amber-400"
            />
            <MetricRow
              label="Book Sensitivity"
              value={`R${(sensitivity_zar_per_pt / 1_000_000).toFixed(2)}M / pt`}
              sub="MTM change per 1 USD/ZAR point move"
              color="text-slate-300"
            />
          </div>
        </div>

        {/* Mechanics */}
        <div className="card lg:col-span-1">
          <p className="text-xs font-semibold text-slate-300 mb-4">CSA Mechanics — ISDA Credit Support Annex</p>
          <div className="space-y-3 text-xs">
            <MechRow icon="⚖" label="Threshold"      value="−R 15,000,000" />
            <MechRow icon="🔻" label="On EOD"         value="Threshold drops to zero" />
            <MechRow icon="↕" label="Min Transfer"   value={zarM(min_transfer_zar)} />
            <MechRow icon="🕛" label="Notification"  value={`By ${notification_time}`} />
            <MechRow icon="📞" label="Contact"       value={collateral_contact} wrap />
          </div>

          {/* Buffer bar */}
          <div className="mt-5">
            <div className="flex justify-between text-xs text-slate-400 mb-1">
              <span>Buffer remaining</span>
              <span className={buffer_zar < 0 ? 'text-red-400' : 'text-kuda-teal'}>
                {pct(pct_threshold_remaining)}
              </span>
            </div>
            <div className="h-2 bg-kuda-navymid rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.max(0, Math.min(100, pct_threshold_remaining))}%`,
                  background: pct_threshold_remaining > 50 ? '#00C896' : pct_threshold_remaining > 20 ? '#F59E0B' : '#EF4444',
                }}
              />
            </div>
          </div>
        </div>

      </div>
    </section>
  )
}

/** Semi-circle SVG gauge */
function Gauge({ mtm, color }) {
  const MIN = CSA_MIN, MAX = CSA_MAX, THRESH = THRESHOLD
  const toAngle = (v) => -180 + ((v - MIN) / (MAX - MIN)) * 180

  const needleAngleDeg = toAngle(Math.max(MIN, Math.min(MAX, mtm)))
  const threshAngleDeg = toAngle(THRESH)

  // SVG arc helpers
  const polarToXY = (angleDeg, r) => {
    const rad = (angleDeg * Math.PI) / 180
    return { x: 100 + r * Math.cos(rad), y: 100 + r * Math.sin(rad) }
  }

  const arcPath = (startDeg, endDeg, r) => {
    const s = polarToXY(startDeg, r)
    const e = polarToXY(endDeg,   r)
    const large = endDeg - startDeg > 0 ? 1 : 0
    return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`
  }

  return (
    <svg viewBox="0 0 200 115" className="w-56">
      {/* Background arc */}
      <path d={arcPath(-180, 0, 70)} fill="none" stroke="#1A3260" strokeWidth="14" strokeLinecap="round" />
      {/* Danger zone (left, breach) */}
      <path d={arcPath(-180, threshAngleDeg, 70)} fill="none" stroke="#EF4444" strokeWidth="14" strokeOpacity="0.4" strokeLinecap="round" />
      {/* Safe zone */}
      <path d={arcPath(threshAngleDeg, 0, 70)} fill="none" stroke="#00C896" strokeWidth="14" strokeOpacity="0.3" strokeLinecap="round" />
      {/* Threshold marker */}
      {(() => {
        const p = polarToXY(threshAngleDeg, 70)
        return <circle cx={p.x} cy={p.y} r={5} fill="#EF4444" />
      })()}
      {/* Needle */}
      {(() => {
        const tip  = polarToXY(needleAngleDeg, 60)
        const base = polarToXY(needleAngleDeg + 90, 8)
        const base2= polarToXY(needleAngleDeg - 90, 8)
        return (
          <g>
            <line x1="100" y1="100" x2={tip.x} y2={tip.y} stroke={color} strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="100" cy="100" r="6" fill={color} />
          </g>
        )
      })()}
      {/* Labels */}
      <text x="28" y="108" fontSize="8" fill="#94a3b8" textAnchor="middle">−R20M</text>
      <text x="100" y="24" fontSize="8" fill="#94a3b8" textAnchor="middle">−R5M</text>
      <text x="172" y="108" fontSize="8" fill="#94a3b8" textAnchor="middle">+R10M</text>
      <text x="58"  y="68"  fontSize="7" fill="#EF4444" textAnchor="middle">−R15M</text>
    </svg>
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
