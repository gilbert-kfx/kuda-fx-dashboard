import React from 'react'
import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, LabelList,
} from 'recharts'
import { zarM, rate } from '../utils/formatters'
import { TrendingUpIcon, TrendingDownIcon, MinusIcon } from 'lucide-react'

export default function MTMBridge({ data }) {
  if (!data) return null

  const {
    current_mtm_kuda_zar, prev_mtm_kuda_zar, total_change_zar,
    rate_move_contribution, settled_contribution, theta_contribution,
    prev_rate, current_rate, settled_trade_count, note,
  } = data

  const noData = !prev_mtm_kuda_zar

  // Build waterfall data
  const bars = noData ? [] : [
    {
      name: 'Prev MTM',
      type: 'absolute',
      value: prev_mtm_kuda_zar,
      fill: '#1A3260',
      display: zarM(prev_mtm_kuda_zar),
    },
    {
      name: 'Rate Move',
      type: 'delta',
      value: rate_move_contribution,
      fill: rate_move_contribution >= 0 ? '#00C896' : '#EF4444',
      display: zarM(rate_move_contribution),
    },
    {
      name: 'Settled',
      type: 'delta',
      value: settled_contribution,
      fill: settled_contribution >= 0 ? '#00C896' : '#EF4444',
      display: zarM(settled_contribution),
    },
    {
      name: 'Theta / Other',
      type: 'delta',
      value: theta_contribution,
      fill: theta_contribution >= 0 ? '#6366F1' : '#F59E0B',
      display: zarM(theta_contribution),
    },
    {
      name: 'Today MTM',
      type: 'absolute',
      value: current_mtm_kuda_zar,
      fill: '#00C896',
      display: zarM(current_mtm_kuda_zar),
    },
  ]

  // Convert to waterfall (stacked bar trick: invisible base + delta)
  let running = noData ? 0 : prev_mtm_kuda_zar
  const chartData = bars.map((b, i) => {
    if (b.type === 'absolute') {
      return { ...b, base: 0, top: b.value }
    }
    const base = running
    running += b.value
    return { ...b, base: Math.min(base, base + b.value), top: Math.abs(b.value) }
  })

  return (
    <section>
      <h2 className="section-title">3 · Day-on-Day MTM Bridge</h2>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Chart */}
        <div className="card lg:col-span-2">
          {noData ? (
            <div className="flex flex-col items-center justify-center h-56 gap-2 text-slate-500">
              <p className="text-sm">Enter Prev Day MTM and Prev Day Rate in the upload panel for the bridge.</p>
              <p className="text-xs">{note}</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="#1E3A5F" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis
                  tickFormatter={(v) => zarM(v)}
                  tick={{ fill: '#94a3b8', fontSize: 10 }}
                  axisLine={false} tickLine={false} width={70}
                />
                <ReferenceLine y={0} stroke="#1E3A5F" />
                <ReferenceLine y={-15_000_000} stroke="#EF4444" strokeDasharray="4 3" strokeOpacity={0.6}
                  label={{ value: 'CSA −R15M', fill: '#EF4444', fontSize: 10, position: 'right' }}
                />
                <Tooltip
                  contentStyle={{ background: '#0B1E3D', border: '1px solid #1E3A5F', borderRadius: 8 }}
                  formatter={(v, n, p) => [zarM(p.payload.display !== undefined ? p.payload.value : v), '']}
                  cursor={{ fill: '#1E3A5F' }}
                />
                {/* Invisible base (for floating bars on deltas) */}
                <Bar dataKey="base" stackId="w" fill="transparent" />
                {/* Visible delta / absolute bar */}
                <Bar dataKey="top" stackId="w" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                  <LabelList dataKey="display" position="top" style={{ fill: '#94a3b8', fontSize: 10 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Stats */}
        <div className="card space-y-4">
          <p className="text-xs font-semibold text-slate-300">Change Attribution</p>

          <BridgeRow
            label="Today MTM"
            value={zarM(current_mtm_kuda_zar)}
            color={current_mtm_kuda_zar >= 0 ? 'text-kuda-teal' : 'text-red-400'}
          />
          {!noData && (
            <>
              <div className="border-t border-kuda-border" />
              <BridgeRow
                label="Previous MTM"
                value={zarM(prev_mtm_kuda_zar)}
                color="text-slate-400"
              />
              <BridgeRow
                label="Total change"
                value={zarM(total_change_zar)}
                color={total_change_zar >= 0 ? 'text-kuda-teal' : 'text-red-400'}
                icon={total_change_zar > 0 ? <TrendingUpIcon size={13} /> : total_change_zar < 0 ? <TrendingDownIcon size={13} /> : <MinusIcon size={13} />}
              />
              <div className="border-t border-kuda-border" />
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Breakdown</p>
              <BridgeRow
                label={`Rate move (${rate(prev_rate)} → ${rate(current_rate)})`}
                value={zarM(rate_move_contribution)}
                color={rate_move_contribution >= 0 ? 'text-kuda-teal' : 'text-red-400'}
                small
              />
              <BridgeRow
                label={`Settled (${settled_trade_count} trade${settled_trade_count !== 1 ? 's' : ''})`}
                value={zarM(settled_contribution)}
                color={settled_contribution >= 0 ? 'text-kuda-teal' : 'text-red-400'}
                small
              />
              <BridgeRow
                label="Theta / other"
                value={zarM(theta_contribution)}
                color={theta_contribution >= 0 ? 'text-indigo-400' : 'text-amber-400'}
                small
              />
            </>
          )}
        </div>

      </div>
    </section>
  )
}

function BridgeRow({ label, value, color, icon, small }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <p className={`${small ? 'text-slate-500' : 'text-slate-400'} text-xs`}>{label}</p>
      <div className={`flex items-center gap-1 font-mono font-medium text-sm ${color}`}>
        {icon}
        <span>{value}</span>
      </div>
    </div>
  )
}
