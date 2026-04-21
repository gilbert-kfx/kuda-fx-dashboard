import React from 'react'
import { zarM, rate } from '../utils/formatters'
import {
  TrendingUpIcon, TrendingDownIcon, MinusIcon,
  CircleDotIcon, CheckCircleIcon, PlusCircleIcon,
} from 'lucide-react'

const CSA_THRESHOLD = -15_000_000

/** Color the MTM value based on distance from CSA threshold */
function mtmTextColor(n) {
  if (n == null) return 'text-slate-400'
  if (n < CSA_THRESHOLD)         return 'text-red-400'
  if (n < CSA_THRESHOLD * 0.5)   return 'text-amber-400'
  if (n < 0)                     return 'text-yellow-300'
  return 'text-kuda-teal'
}

/** Sign-prefixed ZAR formatter for deltas */
function deltaStr(n) {
  if (n == null) return '—'
  const abs = Math.abs(n)
  const sign = n > 0 ? '+' : n < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}R${(abs / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000)     return `${sign}R${(abs / 1_000).toFixed(1)}K`
  return `${sign}R${abs.toFixed(0)}`
}

export default function MTMBridge({ data }) {
  if (!data) return null

  const {
    current_mtm_kuda_zar,
    prev_mtm_kuda_zar,
    total_change_zar,
    rate_move_contribution,
    settled_contribution,
    other_contribution,
    prev_rate,
    current_rate,
    settled_trade_count,
  } = data

  const hasHistory = !!prev_mtm_kuda_zar

  // Which direction did the day change go?
  const ChangeIcon =
    !total_change_zar ? MinusIcon :
    total_change_zar > 0 ? TrendingUpIcon : TrendingDownIcon

  const changeColor = !total_change_zar
    ? 'text-slate-500'
    : total_change_zar > 0
    ? 'text-kuda-teal'
    : 'text-red-400'

  return (
    <section>
      <h2 className="section-title">3 · Day-on-Day MTM Change</h2>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* ── Left: positions ──────────────────────────────────────────── */}
        <div className="card lg:col-span-2 flex flex-col gap-5">

          {/* Today MTM — hero number */}
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Today's MTM (Kuda)</p>
            <p className={`text-3xl font-bold font-mono ${mtmTextColor(current_mtm_kuda_zar)}`}>
              {zarM(current_mtm_kuda_zar)}
            </p>
            <p className="text-xs text-slate-500 mt-0.5 font-mono">@ USD/ZAR {rate(current_rate)}</p>
          </div>

          {hasHistory && (
            <>
              <div className="border-t border-kuda-border" />

              {/* Yesterday vs Day change */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Yesterday</p>
                  <p className="text-lg font-semibold font-mono text-slate-300">
                    {zarM(prev_mtm_kuda_zar)}
                  </p>
                  <p className="text-xs text-slate-600 font-mono">@ {rate(prev_rate)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Day Change</p>
                  <div className={`flex items-center gap-1.5 ${changeColor}`}>
                    <ChangeIcon size={16} />
                    <p className="text-lg font-semibold font-mono">{deltaStr(total_change_zar)}</p>
                  </div>
                </div>
              </div>

              {/* CSA buffer bar */}
              <div>
                <div className="flex justify-between text-[10px] font-mono mb-1">
                  <span className="text-slate-500">Buffer to CSA threshold (−R15M)</span>
                  <span className={mtmTextColor(current_mtm_kuda_zar)}>
                    {deltaStr(current_mtm_kuda_zar - CSA_THRESHOLD)}
                  </span>
                </div>
                <div className="h-1.5 bg-kuda-navylt rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all bg-kuda-teal"
                    style={{
                      width: `${Math.min(
                        Math.max(
                          ((current_mtm_kuda_zar - CSA_THRESHOLD) / Math.abs(CSA_THRESHOLD)) * 50 + 50,
                          0
                        ),
                        100
                      )}%`,
                      background:
                        current_mtm_kuda_zar < CSA_THRESHOLD ? '#EF4444' :
                        current_mtm_kuda_zar < 0 ? '#F59E0B' : '#00C896',
                    }}
                  />
                </div>
              </div>
            </>
          )}
        </div>

        {/* ── Right: attribution ───────────────────────────────────────── */}
        <div className="card lg:col-span-3">
          <p className="text-xs font-semibold text-slate-300 mb-4">What drove the change?</p>

          {!hasHistory ? (
            <div className="flex flex-col items-center justify-center h-32 text-center gap-2">
              <p className="text-slate-500 text-sm">No previous day data found.</p>
              <p className="text-slate-600 text-xs">
                Re-upload today's file — yesterday's snapshot will be loaded automatically.
              </p>
            </div>
          ) : (
            <div className="space-y-1">

              <AttributionRow
                icon={<CircleDotIcon size={14} className="text-indigo-400" />}
                label="Spot rate movement"
                sublabel={`USD/ZAR moved ${rate(prev_rate)} → ${rate(current_rate)}`}
                value={rate_move_contribution}
                total={total_change_zar}
              />

              <AttributionRow
                icon={<CheckCircleIcon size={14} className="text-slate-400" />}
                label={`Settled trades`}
                sublabel={
                  settled_trade_count === 0
                    ? 'No contracts matured today'
                    : `${settled_trade_count} contract${settled_trade_count !== 1 ? 's' : ''} matured and rolled off the book`
                }
                value={settled_contribution}
                total={total_change_zar}
              />

              <AttributionRow
                icon={<PlusCircleIcon size={14} className="text-amber-400" />}
                label="New deals & repricing"
                sublabel="New contracts booked + forward curve repricing"
                value={other_contribution}
                total={total_change_zar}
              />

              <div className="border-t border-kuda-border mt-4 pt-4 flex items-center justify-between font-mono">
                <div className="flex items-center gap-2">
                  <ChangeIcon size={14} className={changeColor} />
                  <span className="text-xs text-slate-400 font-semibold">Total day change</span>
                </div>
                <span className={`font-bold text-sm ${changeColor}`}>
                  {deltaStr(total_change_zar)}
                </span>
              </div>

              <p className="text-[10px] text-slate-600 pt-1">
                Rate impact is estimated from book sensitivity × rate move.
                Residual is attributed to new trades and market repricing.
              </p>

            </div>
          )}
        </div>

      </div>
    </section>
  )
}

function AttributionRow({ icon, label, sublabel, value, total }) {
  // Bar width proportional to share of total change magnitude
  const totalAbs = Math.abs(total) || 1
  const barPct   = Math.min(Math.abs(value) / totalAbs * 100, 100)
  const isPos    = value >= 0
  const barColor = isPos ? '#00C896' : '#EF4444'

  return (
    <div className="py-3 border-b border-kuda-border/50 last:border-0">
      <div className="flex items-start justify-between gap-4 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="shrink-0 mt-0.5">{icon}</span>
          <div className="min-w-0">
            <p className="text-xs text-slate-300 font-medium leading-none">{label}</p>
            <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">{sublabel}</p>
          </div>
        </div>
        <span
          className={`text-sm font-mono font-semibold shrink-0 ${isPos ? 'text-kuda-teal' : 'text-red-400'}`}
        >
          {deltaStr(value)}
        </span>
      </div>
      {/* Proportional impact bar */}
      <div className="h-1 bg-kuda-navylt rounded-full overflow-hidden ml-6">
        <div
          className="h-full rounded-full"
          style={{ width: `${barPct}%`, background: barColor, opacity: 0.7 }}
        />
      </div>
    </div>
  )
}
