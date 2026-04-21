import React from 'react'
import { CheckCircle2Icon, TrendingUpIcon, TrendingDownIcon } from 'lucide-react'
import { zarM, dateStr, rate } from '../utils/formatters'

export default function SettledTrades({ data }) {
  if (!data) return null
  const { count, total_mtm, trades } = data

  return (
    <section>
      <h2 className="section-title">7 · Settled Trades Today</h2>
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <CheckCircle2Icon size={16} className="text-kuda-teal" />
            <p className="text-sm font-semibold text-white">
              {count} trade{count !== 1 ? 's' : ''} settled today
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-slate-400">Total MTM released:</span>
            <span className={total_mtm >= 0 ? 'text-kuda-teal font-semibold' : 'text-red-400 font-semibold'}>
              {zarM(total_mtm)}
            </span>
          </div>
        </div>

        {count === 0 ? (
          <div className="text-center py-8 text-slate-500 text-sm">No trades settled today.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="border-b border-kuda-border">
                  <th className="text-left text-slate-500 font-medium pb-2 pr-4">Client</th>
                  <th className="text-left text-slate-500 font-medium pb-2 pr-3">Ref</th>
                  <th className="text-left text-slate-500 font-medium pb-2 pr-3">Direction</th>
                  <th className="text-left text-slate-500 font-medium pb-2 pr-3">Pair</th>
                  <th className="text-right text-slate-500 font-medium pb-2 pr-3">Notional</th>
                  <th className="text-right text-slate-500 font-medium pb-2 pr-3">Deal Rate</th>
                  <th className="text-right text-slate-500 font-medium pb-2 pr-3">MTM (ZAR)</th>
                  <th className="text-right text-slate-500 font-medium pb-2">Maturity</th>
                </tr>
              </thead>
              <tbody>
                {trades.map((t, i) => (
                  <tr key={i} className="border-b border-kuda-border/40 hover:bg-kuda-navymid transition-colors">
                    <td className="py-2 pr-4 text-slate-300 max-w-[10rem] truncate font-sans" title={t.client}>
                      {t.client}
                    </td>
                    <td className="py-2 pr-3 text-slate-500">{t.ext_ref}</td>
                    <td className="py-2 pr-3">
                      <span className={`pill ${t.direction === 'Sell' ? 'bg-orange-400/10 text-orange-400' : 'bg-indigo-400/10 text-indigo-400'}`}>
                        {t.direction}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-slate-400">{t.ccy_pair}</td>
                    <td className="py-2 pr-3 text-right text-slate-300">
                      {Math.abs(t.notional_fcy).toLocaleString('en-ZA', { maximumFractionDigits: 0 })}
                    </td>
                    <td className="py-2 pr-3 text-right text-slate-400">{rate(t.deal_rate)}</td>
                    <td className={`py-2 pr-3 text-right font-semibold ${t.mtm_zar >= 0 ? 'text-kuda-teal' : 'text-red-400'}`}>
                      {zarM(t.mtm_zar)}
                    </td>
                    <td className="py-2 text-right text-slate-500">{dateStr(t.maturity)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}
