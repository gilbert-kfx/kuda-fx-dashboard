import React, { useState, useMemo } from 'react'
import { SearchIcon, MailIcon, TrendingUpIcon, TrendingDownIcon, CalendarIcon, ChevronRightIcon } from 'lucide-react'
import { zarM, usdM, rate } from '../utils/formatters'
import EmailComposer from './EmailComposer.jsx'

function fmtDate(s) {
  if (!s) return '—'
  const d = new Date(s)
  return d.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtNum(n) {
  if (!n) return '0'
  return Math.round(Math.abs(n)).toLocaleString('en-ZA')
}

const URGENCY = (days) =>
  days !== null && days <= 7  ? 'text-red-400 font-semibold' :
  days !== null && days <= 14 ? 'text-orange-400' :
  'text-slate-300'

const PRODUCT_BADGE = {
  FORWARD:          'bg-indigo-500/20 text-indigo-300',
  DRAWDOWN:         'bg-cyan-500/20 text-cyan-300',
  EXTENSION:        'bg-purple-500/20 text-purple-300',
  CANCELLATION:     'bg-slate-500/20 text-slate-400',
  'Vanilla':        'bg-amber-500/20 text-amber-300',
  'Forward Enhancer': 'bg-teal-500/20 text-teal-300',
}

function ProductBadge({ type }) {
  const cls = PRODUCT_BADGE[type] || 'bg-slate-500/20 text-slate-400'
  return (
    <span className={`inline-block text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${cls}`}>
      {type}
    </span>
  )
}

function UpcomingChip({ label, data, color }) {
  if (!data || data.count === 0) return null
  return (
    <div className={`flex flex-col items-center px-3 py-2 rounded-lg border ${color}`}>
      <span className="text-[9px] uppercase tracking-widest mb-0.5 opacity-70">{label}</span>
      <span className="text-lg font-bold leading-none">{data.count}</span>
      <span className="text-[9px] opacity-60 mt-0.5">{usdM(data.nominal_usd)}</span>
    </div>
  )
}

export default function ClientBook({ data, meta, facilityLimits }) {
  const [search,   setSearch]   = useState('')
  const [selected, setSelected] = useState(null)
  const [composing, setComposing] = useState(false)
  const [sortKey,  setSortKey]  = useState('gross_nominal_usd') // or 'net_mtm_zar' | 'name'

  const clients = data?.clients ?? []

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return clients
      .filter(c => !q || c.name.toLowerCase().includes(q))
      .sort((a, b) => {
        if (sortKey === 'name') return (a.name || '').localeCompare(b.name || '')
        return b[sortKey] - a[sortKey]
      })
  }, [clients, search, sortKey])

  const active = selected
    ? clients.find(c => c.name === selected)
    : null

  // Auto-select first on mount
  React.useEffect(() => {
    if (filtered.length && !selected) setSelected(filtered[0].name)
  }, [filtered])

  if (!clients.length) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500 text-sm">
        No client data — re-upload today's trades file.
      </div>
    )
  }

  return (
    <>
      {composing && active && (
        <EmailComposer
          allClients={clients}
          initialClient={active}
          meta={meta}
          facilityLimits={facilityLimits}
          onClose={() => setComposing(false)}
        />
      )}

      <div className="flex gap-4 h-full" style={{ minHeight: '70vh' }}>

        {/* ── LEFT: Client list ──────────────────────────────────────────── */}
        <div className="w-72 shrink-0 flex flex-col gap-3">
          {/* Search + sort */}
          <div className="card p-3 space-y-2">
            <div className="relative">
              <SearchIcon size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Search clients…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-kuda-navy border border-kuda-border rounded-lg
                           text-xs text-white placeholder-slate-600 focus:outline-none focus:border-kuda-teal"
              />
            </div>
            <div className="flex gap-1">
              {[['gross_nominal_usd','Nominal'],['net_mtm_zar','MTM'],['name','A–Z']].map(([k,l]) => (
                <button
                  key={k}
                  onClick={() => setSortKey(k)}
                  className={`flex-1 text-[10px] py-1 rounded ${
                    sortKey === k ? 'bg-kuda-teal/20 text-kuda-teal' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* Client rows */}
          <div className="space-y-1.5 overflow-y-auto" style={{ maxHeight: 'calc(70vh - 80px)' }}>
            {filtered.map(c => {
              const isActive = selected === c.name
              const mtmPos   = c.net_mtm_zar >= 0
              const urgent   = c.upcoming_7d?.count > 0
              return (
                <button
                  key={c.name}
                  onClick={() => setSelected(c.name)}
                  className={`w-full text-left p-3 rounded-xl border transition-all ${
                    isActive
                      ? 'border-kuda-teal/40 bg-kuda-teal/5'
                      : 'border-kuda-border bg-kuda-navylt hover:border-slate-500'
                  }`}
                >
                  <div className="flex items-start justify-between gap-1 mb-1.5">
                    <p className="text-xs font-medium text-white leading-tight">{c.name}</p>
                    <ChevronRightIcon size={12} className={isActive ? 'text-kuda-teal mt-0.5' : 'text-slate-600 mt-0.5'} />
                  </div>
                  <div className="flex items-center justify-between text-[10px] font-mono">
                    <span className="text-slate-500">{usdM(c.long_nominal_usd)}</span>
                    <span className={mtmPos ? 'text-kuda-teal' : 'text-red-400'}>
                      {zarM(c.net_mtm_zar)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[9px] text-slate-600">{c.trade_count} trades</span>
                    {urgent && (
                      <span className="text-[9px] text-red-400 font-semibold">
                        ⚠ {c.upcoming_7d.count} exp. this week
                      </span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* ── RIGHT: Client detail ───────────────────────────────────────── */}
        {active ? (
          <div className="flex-1 min-w-0 space-y-4">

            {/* Client header */}
            <div className="card">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold text-white">{active.name}</h3>
                  <p className="text-xs text-slate-500">{active.trade_count} open contract{active.trade_count !== 1 ? 's' : ''}</p>
                </div>
                <button
                  onClick={() => setComposing(true)}
                  className="btn-primary text-xs py-2 px-4 flex items-center gap-2"
                >
                  <MailIcon size={13} />
                  Generate Mailer
                </button>
              </div>

              {/* Summary stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 pt-4 border-t border-kuda-border">
                <Stat label="Long Nominal" value={usdM(active.long_nominal_usd)} />
                <Stat label="Gross Nominal" value={usdM(active.gross_nominal_usd)} />
                <Stat
                  label="MTM (Kuda)"
                  value={zarM(active.net_mtm_zar)}
                  color={active.net_mtm_zar >= 0 ? 'text-kuda-teal' : 'text-red-400'}
                />
                <Stat label="MTM Date" value={meta?.mtm_date ? fmtDate(meta.mtm_date) : '—'} />
              </div>

              {/* Upcoming maturities */}
              {(active.upcoming_7d.count + active.upcoming_14d.count + active.upcoming_30d.count + active.upcoming_90d.count) > 0 && (
                <div className="mt-4 pt-4 border-t border-kuda-border">
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                    <CalendarIcon size={11} />
                    Upcoming Maturities
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    <UpcomingChip label="7 days"   data={active.upcoming_7d}  color="border-red-500/30 text-red-300" />
                    <UpcomingChip label="14 days"  data={active.upcoming_14d} color="border-kuda-blue/30 text-kuda-skyblue" />
                    <UpcomingChip label="1 month"  data={active.upcoming_30d} color="border-indigo-500/30 text-indigo-300" />
                    <UpcomingChip label="3 months" data={active.upcoming_90d} color="border-slate-500/30 text-slate-300" />
                  </div>
                </div>
              )}
            </div>

            {/* Trades table */}
            <div className="card overflow-hidden p-0">
              <div className="px-4 py-3 border-b border-kuda-border">
                <p className="text-xs font-semibold text-slate-300">Open Contracts</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-kuda-border">
                      {['Type','Currency','Dir.','Notional','Deal Rate','Booked','Maturity','Days','MTM (ZAR)'].map(h => (
                        <th key={h} className="px-3 py-2.5 text-left text-[10px] text-slate-500 uppercase tracking-wide font-medium whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {active.trades.map((t, i) => (
                      <tr
                        key={i}
                        className={`border-b border-kuda-border/50 hover:bg-kuda-teal/5 transition-colors ${
                          i % 2 === 0 ? '' : 'bg-white/[0.015]'
                        }`}
                      >
                        <td className="px-3 py-2 whitespace-nowrap">
                          <ProductBadge type={t.product_type} />
                        </td>
                        <td className="px-3 py-2 font-semibold text-white whitespace-nowrap">{t.ccy_pair}</td>
                        <td className="px-3 py-2 text-slate-400">{t.direction_client}</td>
                        <td className="px-3 py-2 text-right font-mono text-slate-300 whitespace-nowrap">
                          {fmtNum(t.notional_fcy)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-slate-300 whitespace-nowrap">
                          {t.deal_rate != null ? t.deal_rate.toFixed(4) : '—'}
                        </td>
                        <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{fmtDate(t.trade_date)}</td>
                        <td className={`px-3 py-2 whitespace-nowrap font-mono ${URGENCY(t.days_to_maturity)}`}>
                          {fmtDate(t.maturity_date)}
                        </td>
                        <td className={`px-3 py-2 text-right font-mono ${URGENCY(t.days_to_maturity)}`}>
                          {t.days_to_maturity !== null ? t.days_to_maturity : '—'}
                        </td>
                        <td className={`px-3 py-2 text-right font-mono ${t.mtm_zar >= 0 ? 'text-kuda-teal' : 'text-red-400'}`}>
                          {t.mtm_zar >= 0 ? '+' : ''}{fmtNum(t.mtm_zar) !== '0' ? zarM(t.mtm_zar) : 'R0'}
                        </td>
                      </tr>
                    ))}
                    {/* Totals row */}
                    <tr className="border-t-2 border-kuda-border bg-kuda-navylt">
                      <td colSpan={3} className="px-3 py-2.5 text-[10px] text-slate-500 uppercase font-semibold">Total</td>
                      <td className="px-3 py-2.5 text-right font-mono text-slate-300 font-semibold" />
                      <td colSpan={3} />
                      <td />
                      <td className={`px-3 py-2.5 text-right font-mono font-bold ${active.net_mtm_zar >= 0 ? 'text-kuda-teal' : 'text-red-400'}`}>
                        {zarM(active.net_mtm_zar)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
            Select a client from the list
          </div>
        )}
      </div>
    </>
  )
}

function Stat({ label, value, color = 'text-white' }) {
  return (
    <div>
      <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-0.5">{label}</p>
      <p className={`text-base font-bold font-mono ${color}`}>{value}</p>
    </div>
  )
}
