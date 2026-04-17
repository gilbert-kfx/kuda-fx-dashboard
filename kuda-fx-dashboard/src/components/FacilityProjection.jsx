import React from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { usdM } from '../utils/formatters'

const HORIZON_COLORS = {
  '7 days':   '#00C896',
  '14 days':  '#22d3ee',
  '1 month':  '#6366F1',
  '2 months': '#F59E0B',
  '3 months': '#EF4444',
}

function pct(val, total) {
  if (!total) return 0
  return Math.min(Math.round(val / total * 100), 100)
}

/** Compact USD formatter for axis ticks */
function axisFmt(v) {
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  return `$${Math.round(v / 1_000)}K`
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  return (
    <div className="bg-kuda-navy border border-kuda-border rounded-lg p-3 text-xs font-mono shadow-xl space-y-1">
      <p className="text-white font-semibold mb-1">{label}</p>
      <p className="text-kuda-teal">Remaining nominal: {usdM(d.nominal)}</p>
      <p className="text-slate-400">Headroom: {usdM(d.headroom)}</p>
      {d.contracts > 0 && (
        <p className="text-slate-500">Contracts maturing: {d.contracts} ({usdM(d.rolled)} rolling off)</p>
      )}
      <p className="text-slate-600">Cap utilisation: {d.util}%</p>
    </div>
  )
}

export default function FacilityProjection({ data }) {
  if (!data) return null
  const { current_nominal_usd, cap_usd, headroom_usd, utilisation_pct, horizons } = data

  // Build chart data: "Today" point + 5 horizon points
  const chartData = [
    {
      label:     'Today',
      nominal:   current_nominal_usd,
      headroom:  headroom_usd,
      contracts: 0,
      rolled:    0,
      util:      utilisation_pct,
    },
    ...horizons.map(h => ({
      label:     h.label,
      nominal:   h.projected_nominal_usd,
      headroom:  h.headroom_usd,
      contracts: h.contracts_maturing,
      rolled:    h.nominal_maturing_usd,
      util:      h.utilisation_pct,
    })),
  ]

  // Colour the utilisation bar
  const utilColor =
    utilisation_pct >= 90 ? 'bg-red-500' :
    utilisation_pct >= 75 ? 'bg-amber-400' :
    'bg-kuda-teal'

  return (
    <section>
      <h2 className="section-title">8 · Facility Nominal Projection</h2>

      {/* Summary header */}
      <div className="card mb-4">
        <div className="flex flex-wrap items-center gap-6 mb-3">
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-0.5">Current Nominal</p>
            <p className="text-2xl font-bold text-white font-mono">{usdM(current_nominal_usd)}</p>
          </div>
          <div className="h-10 w-px bg-kuda-border" />
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-0.5">Dealing Cap</p>
            <p className="text-2xl font-bold text-slate-300 font-mono">{usdM(cap_usd)}</p>
          </div>
          <div className="h-10 w-px bg-kuda-border" />
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-0.5">Current Headroom</p>
            <p className={`text-2xl font-bold font-mono ${headroom_usd < 2_000_000 ? 'text-red-400' : 'text-kuda-teal'}`}>
              {usdM(headroom_usd)}
            </p>
          </div>
          <div className="flex-1 min-w-[160px]">
            <div className="flex items-center justify-between text-[10px] font-mono mb-1">
              <span className="text-slate-500">Utilisation</span>
              <span className="text-slate-300">{utilisation_pct}%</span>
            </div>
            <div className="h-2 bg-kuda-navylt rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${utilColor}`}
                style={{ width: `${utilisation_pct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Projection chart */}
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="nomGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#00C896" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#00C896" stopOpacity={0.03} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1E3A5F" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={axisFmt}
              tick={{ fill: '#94a3b8', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              width={60}
              domain={[0, Math.ceil(cap_usd * 1.05 / 1_000_000) * 1_000_000]}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#1E3A5F', strokeWidth: 1 }} />
            <ReferenceLine
              y={cap_usd}
              stroke="#EF4444"
              strokeDasharray="5 3"
              label={{ value: 'Cap', fill: '#EF4444', fontSize: 10, position: 'insideTopRight' }}
            />
            <Area
              type="monotone"
              dataKey="nominal"
              stroke="#00C896"
              strokeWidth={2}
              fill="url(#nomGrad)"
              dot={{ r: 4, fill: '#00C896', strokeWidth: 0 }}
              activeDot={{ r: 5 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Horizon stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {horizons.map((h) => {
          const nominalReleased = current_nominal_usd - h.projected_nominal_usd
          const headroomGained  = h.headroom_usd - headroom_usd
          const hColor = HORIZON_COLORS[h.label] || '#00C896'
          const utilFill =
            h.utilisation_pct >= 90 ? '#EF4444' :
            h.utilisation_pct >= 75 ? '#F59E0B' :
            '#00C896'

          return (
            <div key={h.label} className="card space-y-3">
              {/* Horizon label */}
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: hColor }} />
                <span className="text-xs font-semibold text-slate-300">{h.label}</span>
              </div>

              {/* Projected nominal */}
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest">Projected Nominal</p>
                <p className="text-lg font-bold text-white font-mono">{usdM(h.projected_nominal_usd)}</p>
              </div>

              {/* Divider row */}
              <div className="border-t border-kuda-border pt-2 space-y-1.5 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-500">Contracts maturing</span>
                  <span className="text-slate-300 font-semibold">{h.contracts_maturing}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Nominal rolling off</span>
                  <span className="text-kuda-teal">{usdM(h.nominal_maturing_usd)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Headroom gained</span>
                  <span className={headroomGained >= 0 ? 'text-kuda-teal' : 'text-red-400'}>
                    {headroomGained >= 0 ? '+' : ''}{usdM(headroomGained)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Remaining headroom</span>
                  <span className="text-slate-300">{usdM(h.headroom_usd)}</span>
                </div>
              </div>

              {/* Utilisation mini-bar */}
              <div>
                <div className="flex justify-between text-[10px] font-mono mb-1">
                  <span className="text-slate-600">Cap utilisation</span>
                  <span style={{ color: utilFill }}>{h.utilisation_pct}%</span>
                </div>
                <div className="h-1.5 bg-kuda-navylt rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${h.utilisation_pct}%`, background: utilFill }}
                  />
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
