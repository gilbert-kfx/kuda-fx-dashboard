import React, { useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer, Area, AreaChart,
} from 'recharts'
import { zarM, pct, rate } from '../utils/formatters'

const CSA_THRESHOLD = -15_000_000

export default function ScenarioAnalysis({ data }) {
  if (!data) return null
  const { scenarios, current_rate, current_mtm_kuda_zar, sensitivity_zar_per_pt } = data
  const [hovered, setHovered] = useState(null)

  return (
    <section>
      <h2 className="section-title">4 · Total Book Scenario Analysis</h2>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* Chart */}
        <div className="card lg:col-span-3">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-semibold text-slate-300">Kuda MTM by USD/ZAR Scenario</p>
            <p className="text-xs text-slate-500 font-mono">
              Sensitivity: −R{(sensitivity_zar_per_pt / 1_000_000).toFixed(2)}M per pt
            </p>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={scenarios} onMouseLeave={() => setHovered(null)}>
              <defs>
                <linearGradient id="mtmGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#6BA439" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#6BA439" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="mtmGradNeg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#EF4444" stopOpacity={0.0} />
                  <stop offset="95%" stopColor="#EF4444" stopOpacity={0.2} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E3A5F" vertical={false} />
              <XAxis
                dataKey="rate"
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                label={{ value: 'USD/ZAR Rate', position: 'insideBottom', offset: -2, fill: '#64748b', fontSize: 11 }}
              />
              <YAxis
                tickFormatter={(v) => zarM(v)}
                tick={{ fill: '#94a3b8', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={72}
              />
              <ReferenceLine y={0} stroke="#1E3A5F" />
              <ReferenceLine
                y={CSA_THRESHOLD}
                stroke="#EF4444"
                strokeDasharray="5 3"
                strokeOpacity={0.8}
                label={{ value: 'CSA Trigger −R15M', fill: '#EF4444', fontSize: 9, position: 'insideTopRight' }}
              />
              <ReferenceLine
                x={current_rate}
                stroke="#6BA439"
                strokeDasharray="5 3"
                strokeOpacity={0.6}
                label={{ value: 'Today', fill: '#6BA439', fontSize: 9, position: 'top' }}
              />
              <Tooltip
                contentStyle={{ background: '#0B1E3D', border: '1px solid #1E3A5F', borderRadius: 8, fontSize: 12 }}
                formatter={(v) => [zarM(v), 'MTM']}
                labelFormatter={(v) => `Rate: ${v}`}
                cursor={{ stroke: '#2D4F7C', strokeWidth: 1 }}
              />
              <Area
                type="monotone"
                dataKey="est_mtm"
                stroke="#6BA439"
                strokeWidth={2}
                fill="url(#mtmGrad)"
                dot={false}
                activeDot={{ r: 4, fill: '#6BA439', stroke: '#0B1E3D', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Table */}
        <div className="card lg:col-span-2 overflow-auto">
          <p className="text-xs font-semibold text-slate-300 mb-3">Rate Scenario Table</p>
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="border-b border-kuda-border">
                <th className="text-left text-slate-500 font-medium pb-2">Rate</th>
                <th className="text-right text-slate-500 font-medium pb-2">MTM</th>
                <th className="text-right text-slate-500 font-medium pb-2">Buffer</th>
                <th className="text-right text-slate-500 font-medium pb-2">Move%</th>
              </tr>
            </thead>
            <tbody>
              {scenarios.map((s) => {
                const isBreach = s.est_mtm <= CSA_THRESHOLD
                const isToday  = s.is_today
                return (
                  <tr
                    key={s.rate}
                    className={`border-b border-kuda-border/50 transition-colors
                      ${isToday ? 'bg-kuda-teal/5' : ''}
                      ${isBreach ? 'bg-red-500/5' : ''}
                      hover:bg-kuda-navymid`}
                  >
                    <td className={`py-1.5 font-semibold ${isToday ? 'text-kuda-teal' : 'text-slate-300'}`}>
                      {s.rate.toFixed(2)}
                      {isToday && <span className="text-kuda-teal ml-1 text-[10px]">●</span>}
                    </td>
                    <td className={`text-right py-1.5 ${s.est_mtm >= 0 ? 'text-kuda-teal' : 'text-red-400'}`}>
                      {zarM(s.est_mtm)}
                    </td>
                    <td className={`text-right py-1.5 ${s.buffer >= 0 ? 'text-slate-400' : 'text-red-400'}`}>
                      {zarM(s.buffer)}
                    </td>
                    <td className={`text-right py-1.5 ${s.move_pct > 0 ? 'text-orange-400' : s.move_pct < 0 ? 'text-kuda-teal' : 'text-slate-400'}`}>
                      {s.move_pct > 0 ? '+' : ''}{s.move_pct}%
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          <div className="mt-3 pt-3 border-t border-kuda-border text-xs text-slate-500 space-y-1">
            <p>Buffer = MTM − (−R15M threshold)</p>
            <p>Linear approximation · options delta excluded</p>
          </div>
        </div>

      </div>
    </section>
  )
}
