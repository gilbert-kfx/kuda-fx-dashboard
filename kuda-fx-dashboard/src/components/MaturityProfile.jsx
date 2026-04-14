import React from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie, Legend,
} from 'recharts'
import { zarM, usdM } from '../utils/formatters'

const BUCKET_COLORS = {
  '0–3 months':  '#00C896',
  '3–6 months':  '#6366F1',
  '6–12 months': '#F59E0B',
  '>12 months':  '#EF4444',
  'Settled/Unknown': '#64748b',
}

const CCY_COLORS = {
  USD: '#00C896',
  GBP: '#6366F1',
  EUR: '#F59E0B',
  ZAR: '#94a3b8',
  CAD: '#EC4899',
}

export default function MaturityProfile({ data }) {
  if (!data) return null
  const { by_bucket, by_currency, total_mtm_kuda_zar } = data

  // Bar chart: MTM by bucket
  const bucketChartData = by_bucket
    .filter(b => b.bucket !== 'Settled/Unknown' || b.trade_count > 0)
    .map(b => ({
      bucket: b.bucket.replace(' months', 'm').replace('>12m', '>12m'),
      mtm: b.mtm_zar,
      nominal: b.nominal_usd,
      count: b.trade_count,
      color: BUCKET_COLORS[b.bucket] || '#64748b',
    }))

  // Pie chart: notional by currency
  const pieData = by_currency
    .filter(c => c.trade_count > 0)
    .map(c => ({
      name: c.currency,
      value: Math.abs(c.nominal_usd),
      mtm: c.mtm_zar,
      count: c.trade_count,
      color: CCY_COLORS[c.currency] || '#64748b',
    }))

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null
    const d = payload[0]?.payload
    return (
      <div className="bg-kuda-navy border border-kuda-border rounded-lg p-3 text-xs font-mono shadow-xl">
        <p className="text-slate-300 font-semibold mb-1">{d.bucket || d.name}</p>
        <p className="text-kuda-teal">MTM: {zarM(d.mtm)}</p>
        <p className="text-slate-400">Nominal: {usdM(d.nominal || d.value)}</p>
        <p className="text-slate-500">Trades: {d.count}</p>
      </div>
    )
  }

  const PieTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null
    const d = payload[0]?.payload
    return (
      <div className="bg-kuda-navy border border-kuda-border rounded-lg p-3 text-xs font-mono shadow-xl">
        <p className="font-semibold mb-1" style={{ color: d.color }}>{d.name}</p>
        <p className="text-slate-300">Gross Nominal: {usdM(d.value)}</p>
        <p className="text-kuda-teal">MTM: {zarM(d.mtm)}</p>
        <p className="text-slate-500">Trades: {d.count}</p>
      </div>
    )
  }

  return (
    <section>
      <h2 className="section-title">6 · Portfolio MTM by Maturity Bucket &amp; Currency</h2>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* MTM by bucket — bar chart */}
        <div className="card lg:col-span-3">
          <p className="text-xs font-semibold text-slate-300 mb-4">MTM by Maturity Bucket</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={bucketChartData} barSize={40}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E3A5F" vertical={false} />
              <XAxis
                dataKey="bucket"
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(v) => zarM(v)}
                tick={{ fill: '#94a3b8', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={68}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: '#1E3A5F' }} />
              <Bar dataKey="mtm" radius={[4, 4, 0, 0]}>
                {bucketChartData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          {/* Summary rows */}
          <div className="mt-3 pt-3 border-t border-kuda-border grid grid-cols-2 md:grid-cols-4 gap-3">
            {by_bucket.filter(b => b.bucket !== 'Settled/Unknown' || b.trade_count > 0).map(b => (
              <div key={b.bucket} className="text-xs">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: BUCKET_COLORS[b.bucket] || '#64748b' }} />
                  <span className="text-slate-500">{b.bucket}</span>
                </div>
                <p className={`font-mono font-medium ${b.mtm_zar >= 0 ? 'text-kuda-teal' : 'text-red-400'}`}>
                  {zarM(b.mtm_zar)}
                </p>
                <p className="text-slate-500">{b.trade_count} trades</p>
              </div>
            ))}
          </div>
        </div>

        {/* Notional by currency — pie */}
        <div className="card lg:col-span-2">
          <p className="text-xs font-semibold text-slate-300 mb-4">Gross Nominal by Currency</p>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
              >
                {pieData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<PieTooltip />} />
              <Legend
                formatter={(v) => <span style={{ color: '#94a3b8', fontSize: 11 }}>{v}</span>}
                iconSize={8}
                iconType="circle"
              />
            </PieChart>
          </ResponsiveContainer>

          {/* Currency MTM table */}
          <div className="mt-2 space-y-2">
            {by_currency.map(c => (
              <div key={c.currency} className="flex items-center justify-between text-xs font-mono">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ background: CCY_COLORS[c.currency] || '#64748b' }} />
                  <span className="text-slate-400 font-semibold w-8">{c.currency}</span>
                  <span className="text-slate-600">{c.trade_count} tr</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-slate-500">{usdM(c.nominal_usd)}</span>
                  <span className={`w-20 text-right ${c.mtm_zar >= 0 ? 'text-kuda-teal' : 'text-red-400'}`}>
                    {zarM(c.mtm_zar)}
                  </span>
                </div>
              </div>
            ))}
            <div className="border-t border-kuda-border pt-2 flex items-center justify-between text-xs font-mono">
              <span className="text-slate-400 font-semibold">TOTAL</span>
              <span className={`w-20 text-right font-bold ${total_mtm_kuda_zar >= 0 ? 'text-kuda-teal' : 'text-red-400'}`}>
                {zarM(total_mtm_kuda_zar)}
              </span>
            </div>
          </div>
        </div>

      </div>
    </section>
  )
}
