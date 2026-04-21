import React, { useState } from 'react'
import { zarM, usdM, pct } from '../utils/formatters'
import { ChevronUpIcon, ChevronDownIcon, InfoIcon } from 'lucide-react'

const CSA_THRESHOLD = -15_000_000
const SCENARIO_COLORS = {
  bad:  'text-red-400',
  warn: 'text-orange-400',
  ok:   'text-kuda-teal',
  zero: 'text-slate-400',
}

export default function TopClientsTable({ data }) {
  if (!data) return null
  const { clients, display_rates, current_rate } = data
  const [sortField, setSortField] = useState('gross_nominal_usd')
  const [sortDir,   setSortDir]   = useState('desc')

  const sorted = [...clients].sort((a, b) => {
    const va = a[sortField] ?? 0
    const vb = b[sortField] ?? 0
    return sortDir === 'desc' ? vb - va : va - vb
  })

  const toggleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortField(field); setSortDir('desc') }
  }

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <ChevronUpIcon size={12} className="opacity-30" />
    return sortDir === 'desc' ? <ChevronDownIcon size={12} className="text-kuda-teal" /> : <ChevronUpIcon size={12} className="text-kuda-teal" />
  }

  // Pick which scenario rate columns to display
  const ratesToShow = display_rates.slice(0, 7)

  return (
    <section>
      <h2 className="section-title">5 · Top 10 Client Scenario Table</h2>
      <div className="card overflow-x-auto">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-slate-300">
            MTM (R '000) by USD/ZAR scenario · proportional to nominal share
          </p>
          <div className="flex items-center gap-1 text-xs text-slate-500">
            <InfoIcon size={12} />
            <span>MTM is book total × client share</span>
          </div>
        </div>

        <table className="w-full text-xs font-mono min-w-[900px]">
          <thead>
            <tr className="border-b border-kuda-border">
              <th className="text-left text-slate-500 font-medium pb-2 pr-4 w-44">Client</th>
              <th
                className="text-right text-slate-500 font-medium pb-2 cursor-pointer hover:text-slate-300 pr-2"
                onClick={() => toggleSort('trade_count')}
              >
                <span className="inline-flex items-center gap-0.5">Trades <SortIcon field="trade_count" /></span>
              </th>
              <th
                className="text-right text-slate-500 font-medium pb-2 cursor-pointer hover:text-slate-300 pr-3"
                onClick={() => toggleSort('gross_nominal_usd')}
              >
                <span className="inline-flex items-center gap-0.5">Gross ($) <SortIcon field="gross_nominal_usd" /></span>
              </th>
              <th
                className="text-right text-slate-500 font-medium pb-2 cursor-pointer hover:text-slate-300 pr-4"
                onClick={() => toggleSort('current_mtm_zar')}
              >
                <span className="inline-flex items-center gap-0.5">MTM Today <SortIcon field="current_mtm_zar" /></span>
              </th>
              {ratesToShow.map(r => {
                const rNum = parseFloat(r)
                const isToday = Math.abs(rNum - current_rate) < 0.03
                return (
                  <th
                    key={r}
                    className={`text-right pb-2 font-medium pr-2 ${isToday ? 'text-kuda-teal' : 'text-slate-500'}`}
                  >
                    {rNum.toFixed(1)}{isToday && '●'}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.map((c, i) => (
              <tr key={c.client} className="border-b border-kuda-border/50 hover:bg-kuda-navymid transition-colors">
                <td className="py-2 pr-4 text-slate-300 font-sans truncate max-w-[11rem]" title={c.client}>
                  <span className="text-slate-500 mr-1.5">{i + 1}.</span>
                  {c.client}
                </td>
                <td className="text-right py-2 text-slate-400 pr-2">{c.trade_count}</td>
                <td className="text-right py-2 text-slate-300 pr-3">{usdM(c.gross_nominal_usd)}</td>
                <td className={`text-right py-2 pr-4 font-semibold ${c.current_mtm_zar >= 0 ? 'text-kuda-teal' : 'text-red-400'}`}>
                  {zarM(c.current_mtm_zar)}
                </td>
                {ratesToShow.map(r => {
                  const val    = (c.mtm_at_rates[r] ?? 0) * 1000  // convert from K back to ZAR
                  const rNum   = parseFloat(r)
                  const isToday = Math.abs(rNum - current_rate) < 0.03
                  const color  = val < 0 && val < (CSA_THRESHOLD * c.share_pct / 100) ? 'text-red-400'
                               : val < 0 ? 'text-orange-400'
                               : val > 0 ? 'text-kuda-teal'
                               : 'text-slate-500'
                  return (
                    <td
                      key={r}
                      className={`text-right py-2 pr-2 ${color} ${isToday ? 'bg-kuda-teal/5' : ''}`}
                    >
                      {zarM(val)}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
          {/* Totals */}
          <tfoot>
            <tr className="border-t-2 border-kuda-border">
              <td colSpan={3} className="pt-2 text-slate-400 font-sans font-semibold text-xs">Book Total</td>
              <td className={`text-right pt-2 font-semibold pr-4 ${clients.reduce((s, c) => s + c.current_mtm_zar, 0) >= 0 ? 'text-kuda-teal' : 'text-red-400'}`}>
                {zarM(clients.reduce((s, c) => s + c.current_mtm_zar, 0))}
              </td>
              {ratesToShow.map(r => {
                const total = clients.reduce((s, c) => s + (c.mtm_at_rates[r] ?? 0) * 1000, 0)
                return (
                  <td key={r} className={`text-right pt-2 font-semibold pr-2 ${total >= 0 ? 'text-kuda-teal' : 'text-red-400'}`}>
                    {zarM(total)}
                  </td>
                )
              })}
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  )
}
