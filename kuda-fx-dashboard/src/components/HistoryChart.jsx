import React, { useEffect, useState } from 'react'
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts'
import { TrendingUpIcon, TrendingDownIcon, CalendarIcon, LoaderIcon } from 'lucide-react'
import { zarM, usdM, pct, rate, dateStr } from '../utils/formatters'

const CSA_THRESHOLD = -15_000_000

export default function HistoryChart() {
  const [snapshots, setSnapshots] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState(null)

  useEffect(() => {
    fetch('/api/history?days=90')
      .then(r => r.ok ? r.json() : { snapshots: [] })
      .then(d => {
        // Filter out any snapshots with missing dates, then sort oldest first
        const sorted = (d.snapshots || [])
          .filter(s => s && s.date)
          .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
        setSnapshots(sorted)
        setLoading(false)
      })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  if (loading) return (
    <section>
      <h2 className="section-title">8 · MTM History</h2>
      <div className="card flex items-center justify-center h-40 gap-2 text-slate-500">
        <LoaderIcon size={16} className="animate-spin" />
        <span className="text-sm">Loading history…</span>
      </div>
    </section>
  )

  if (error || snapshots.length === 0) return (
    <section>
      <h2 className="section-title">8 · MTM History</h2>
      <div className="card text-center py-10 text-slate-500 text-sm">
        {snapshots.length === 0
          ? 'No history yet — it builds automatically from your next upload onwards.'
          : `Could not load history: ${error}`
        }
      </div>
    </section>
  )

  // Chart data
  const chartData = snapshots.map(s => ({
    date:        s.date,
    label:       s.date ? s.date.slice(5) : '—',  // MM-DD
    mtm:         s.mtm_zar,
    buffer:      s.buffer_zar,
    spot:        s.spot_usd_zar,
    nominal:     s.long_nominal_usd,
    util:        s.nominal_util_pct,
    status:      s.status,
  }))

  // Stats
  const latest   = snapshots[snapshots.length - 1]
  const prev     = snapshots[snapshots.length - 2]
  const mtmDelta = prev ? latest.mtm_zar - prev.mtm_zar : null
  const minMtm   = Math.min(...snapshots.map(s => s.mtm_zar))
  const maxMtm   = Math.max(...snapshots.map(s => s.mtm_zar))
  const breachDays = snapshots.filter(s => s.mtm_zar < CSA_THRESHOLD).length

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null
    const d = payload[0]?.payload
    return (
      <div className="bg-kuda-navy border border-kuda-border rounded-lg p-3 text-xs shadow-xl space-y-1">
        <p className="text-slate-300 font-semibold mb-1">{d.date}</p>
        <p className="font-mono" style={{ color: d.mtm >= 0 ? '#6BA439' : '#EF4444' }}>
          MTM: {zarM(d.mtm)}
        </p>
        <p className="text-slate-400">Buffer: {zarM(d.buffer)}</p>
        <p className="text-slate-400">Spot: {rate(d.spot)}</p>
        <p className="text-slate-400">Long nominal: {usdM(d.nominal)}</p>
      </div>
    )
  }

  return (
    <section>
      <h2 className="section-title">8 · MTM History — Last {snapshots.length} Days</h2>
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-4">

        {/* Stat cards */}
        <StatCard
          label="Latest MTM"
          value={zarM(latest.mtm_zar)}
          sub={mtmDelta !== null
            ? `${mtmDelta >= 0 ? '+' : ''}${zarM(mtmDelta)} vs yesterday`
            : 'Today'}
          color={latest.mtm_zar >= 0 ? 'text-kuda-teal' : 'text-red-400'}
          icon={mtmDelta >= 0 ? <TrendingUpIcon size={14} /> : <TrendingDownIcon size={14} />}
        />
        <StatCard
          label="30-Day Range"
          value={`${zarM(minMtm)} → ${zarM(maxMtm)}`}
          sub="Min → Max over period"
          color="text-slate-300"
        />
        <StatCard
          label="Spot Rate"
          value={rate(latest.spot_usd_zar)}
          sub="USD/ZAR — latest"
          color="text-kuda-skyblue"
        />
        <StatCard
          label="CSA Breach Days"
          value={breachDays === 0 ? 'None' : `${breachDays} day${breachDays > 1 ? 's' : ''}`}
          sub="Days MTM below −R15M"
          color={breachDays === 0 ? 'text-kuda-teal' : 'text-red-400'}
          icon={<CalendarIcon size={14} />}
        />
      </div>

      {/* MTM trend chart */}
      <div className="card mb-4">
        <p className="text-xs font-semibold text-slate-300 mb-4">Kuda MTM (ZAR) — Daily Close</p>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="mtmHistGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#6BA439" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#6BA439" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1E3A5F" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
            <YAxis tickFormatter={zarM} tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} width={72} />
            <ReferenceLine y={0}           stroke="#1E3A5F" />
            <ReferenceLine y={CSA_THRESHOLD} stroke="#EF4444" strokeDasharray="5 3" strokeOpacity={0.7}
              label={{ value: '−R15M', fill: '#EF4444', fontSize: 9, position: 'insideTopRight' }} />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#2D4F7C' }} />
            <Area type="monotone" dataKey="mtm" stroke="#6BA439" strokeWidth={2}
              fill="url(#mtmHistGrad)" dot={false}
              activeDot={{ r: 4, fill: '#6BA439', stroke: '#0B1E3D', strokeWidth: 2 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Daily table */}
      <div className="card overflow-x-auto">
        <p className="text-xs font-semibold text-slate-300 mb-3">Daily Close Table</p>
        <table className="w-full text-xs font-mono">
          <thead>
            <tr className="border-b border-kuda-border">
              {['Date','MTM','Buffer','Spot USD/ZAR','Long Nominal','Util %','Settled','Status'].map(h => (
                <th key={h} className="text-left text-slate-500 font-medium pb-2 pr-4">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...snapshots].reverse().map(s => (
              <tr key={s.date} className="border-b border-kuda-border/40 hover:bg-kuda-navymid transition-colors">
                <td className="py-1.5 pr-4 text-slate-300">{s.date}</td>
                <td className={`py-1.5 pr-4 font-semibold ${s.mtm_zar >= 0 ? 'text-kuda-teal' : 'text-red-400'}`}>
                  {zarM(s.mtm_zar)}
                </td>
                <td className={`py-1.5 pr-4 ${s.buffer_zar >= 0 ? 'text-slate-400' : 'text-red-400'}`}>
                  {zarM(s.buffer_zar)}
                </td>
                <td className="py-1.5 pr-4 text-kuda-skyblue">{rate(s.spot_usd_zar)}</td>
                <td className="py-1.5 pr-4 text-slate-400">{usdM(s.long_nominal_usd)}</td>
                <td className="py-1.5 pr-4 text-slate-400">{pct(s.nominal_util_pct)}</td>
                <td className="py-1.5 pr-4 text-slate-500">{s.settled_count ?? '—'}</td>
                <td className="py-1.5">
                  <span className={`pill ${
                    s.status === 'safe'    ? 'pill-safe'    :
                    s.status === 'watch'   ? 'pill-watch'   :
                    s.status === 'warning' ? 'pill-warning' : 'pill-breach'
                  }`}>{s.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function StatCard({ label, value, sub, color, icon }) {
  return (
    <div className="card">
      <p className="text-xs text-slate-500 mb-2">{label}</p>
      <div className={`flex items-center gap-1.5 font-mono font-bold text-lg ${color}`}>
        {icon}
        <span>{value}</span>
      </div>
      {sub && <p className="text-xs text-slate-600 mt-1">{sub}</p>}
    </div>
  )
}
