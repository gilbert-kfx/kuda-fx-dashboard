import React from 'react'
import { ArrowDownCircleIcon, ArrowUpCircleIcon, ScaleIcon } from 'lucide-react'
import { zarM, usdM, rate } from '../utils/formatters'

const IMPORT_COLOR = '#3b82f6'   // blue-500
const EXPORT_COLOR = '#6BA439'   // kuda-teal

// Tenor bucket colours — short to long
const BUCKET_COLORS = ['#ef4444', '#fb923c', '#fbbf24', '#6BA439', '#3b82f6', '#8b5cf6']

export default function BookSplit({ data }) {
  if (!data) return null

  const {
    import: imp, export: exp,
    net_position_usd, total_gross_usd,
    import_pct, export_pct,
  } = data

  const isBalanced  = Math.abs(net_position_usd) < 500_000
  const netColor    = isBalanced ? '#6BA439' : Math.abs(net_position_usd) < 2_000_000 ? '#fbbf24' : '#fb923c'
  const netLabel    = isBalanced ? '✓ Near-flat' : net_position_usd < 0 ? 'Net import bias' : 'Net export bias'

  // Max notional across all buckets (for scaling the tenor bars)
  const allBucketMax = Math.max(
    ...( imp.tenor_buckets || []).map(b => b.nominal_usd),
    ...( exp.tenor_buckets || []).map(b => b.nominal_usd),
    1,
  )

  return (
    <section>
      <h2 className="section-title">3 · Import / Export Book Balance</h2>

      {/* ── Top row: Import | Balance | Export ───────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">

        {/* Import book */}
        <BookCard book={imp} type="Import" color={IMPORT_COLOR} icon={<ArrowDownCircleIcon size={14} />} />

        {/* Centre balance card */}
        <div className="card flex flex-col justify-between">
          <div className="flex items-center gap-2 mb-4">
            <ScaleIcon size={14} className="text-slate-400" />
            <p className="text-xs font-semibold text-slate-300">Book Balance</p>
          </div>

          {/* Split bar */}
          <div>
            <div className="flex justify-between text-[10px] text-slate-400 mb-1">
              <span style={{ color: IMPORT_COLOR }}>Import {import_pct}%</span>
              <span style={{ color: EXPORT_COLOR }}>Export {export_pct}%</span>
            </div>
            <div className="h-5 rounded-full overflow-hidden flex">
              <div
                style={{ width: `${import_pct}%`, background: IMPORT_COLOR }}
                className="transition-all duration-700"
              />
              <div
                style={{ width: `${export_pct}%`, background: EXPORT_COLOR }}
                className="transition-all duration-700"
              />
            </div>
            {/* Midpoint marker */}
            <div className="relative h-3">
              <div className="absolute left-1/2 top-0 w-0.5 h-3 bg-slate-600" />
              <span className="absolute left-1/2 -translate-x-1/2 top-3 text-[9px] text-slate-600">50%</span>
            </div>
          </div>

          {/* Net position */}
          <div className="text-center mt-6">
            <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Net Position</p>
            <p className="text-3xl font-mono font-bold" style={{ color: netColor }}>
              {usdM(net_position_usd)}
            </p>
            <p className="text-xs mt-1" style={{ color: netColor }}>{netLabel}</p>
          </div>

          {/* Totals */}
          <div className="mt-4 pt-3 border-t border-kuda-border grid grid-cols-2 gap-2 text-xs">
            <div className="text-center">
              <p className="text-slate-500">Total gross</p>
              <p className="font-mono text-slate-300">{usdM(total_gross_usd)}</p>
            </div>
            <div className="text-center">
              <p className="text-slate-500">Combined MTM</p>
              <p className="font-mono" style={{ color: data.total_mtm_zar >= 0 ? '#6BA439' : '#ef4444' }}>
                {zarM(data.total_mtm_zar)}
              </p>
            </div>
          </div>
        </div>

        {/* Export book */}
        <BookCard book={exp} type="Export" color={EXPORT_COLOR} icon={<ArrowUpCircleIcon size={14} />} />
      </div>

      {/* ── Bottom row: back-to-back tenor chart ─────────────────────── */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-semibold text-slate-300">Maturity Profile — Import vs Export</p>
          <div className="flex items-center gap-4 text-[10px]">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: IMPORT_COLOR }} />
              <span className="text-slate-400">Import
                {imp.avg_tenor_days ? ` (avg ${imp.avg_tenor_days}d)` : ''}
              </span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: EXPORT_COLOR }} />
              <span className="text-slate-400">Export
                {exp.avg_tenor_days ? ` (avg ${exp.avg_tenor_days}d)` : ''}
              </span>
            </span>
          </div>
        </div>

        {/* Back-to-back bar chart */}
        <div className="space-y-3">
          {(imp.tenor_buckets || []).map((impBucket, i) => {
            const expBucket  = (exp.tenor_buckets || [])[i] || { nominal_usd: 0, count: 0 }
            const impPct     = (impBucket.nominal_usd  / allBucketMax) * 100
            const expPct     = (expBucket.nominal_usd  / allBucketMax) * 100
            const bucketColor = BUCKET_COLORS[i] || '#94a3b8'

            return (
              <div key={impBucket.label} className="flex items-center gap-2">
                {/* Import bar (grows left from centre) */}
                <div className="flex-1 flex justify-end">
                  <div className="w-full max-w-[180px] flex justify-end items-center gap-2">
                    {impBucket.nominal_usd > 0 && (
                      <span className="text-[10px] text-slate-500 whitespace-nowrap">
                        {usdM(impBucket.nominal_usd)}
                        {impBucket.count > 0 && <span className="text-slate-600"> ({impBucket.count})</span>}
                      </span>
                    )}
                    <div className="flex-1 h-5 flex justify-end items-center">
                      <div
                        className="h-4 rounded-l-sm transition-all duration-700"
                        style={{
                          width: `${impPct}%`,
                          background: IMPORT_COLOR,
                          opacity: impBucket.nominal_usd > 0 ? 0.85 : 0.1,
                          minWidth: impBucket.nominal_usd > 0 ? '2px' : '0',
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Bucket label */}
                <div className="w-12 text-center">
                  <span
                    className="text-[10px] font-semibold px-1 py-0.5 rounded"
                    style={{ color: bucketColor, background: `${bucketColor}20` }}
                  >
                    {impBucket.label}
                  </span>
                </div>

                {/* Export bar (grows right from centre) */}
                <div className="flex-1">
                  <div className="w-full max-w-[180px] flex items-center gap-2">
                    <div className="flex-1 h-5 flex items-center">
                      <div
                        className="h-4 rounded-r-sm transition-all duration-700"
                        style={{
                          width: `${expPct}%`,
                          background: EXPORT_COLOR,
                          opacity: expBucket.nominal_usd > 0 ? 0.85 : 0.1,
                          minWidth: expBucket.nominal_usd > 0 ? '2px' : '0',
                        }}
                      />
                    </div>
                    {expBucket.nominal_usd > 0 && (
                      <span className="text-[10px] text-slate-500 whitespace-nowrap">
                        {usdM(expBucket.nominal_usd)}
                        {expBucket.count > 0 && <span className="text-slate-600"> ({expBucket.count})</span>}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Avg tenor comparison strip */}
        <div className="mt-4 pt-3 border-t border-kuda-border flex justify-around text-center text-xs">
          <div>
            <p className="text-slate-500">Import avg tenor</p>
            <p className="font-mono font-semibold mt-0.5" style={{ color: IMPORT_COLOR }}>
              {imp.avg_tenor_days != null ? `${imp.avg_tenor_days}d` : '—'}
            </p>
          </div>
          <div>
            <p className="text-slate-500">Tenor difference</p>
            <p className="font-mono font-semibold mt-0.5 text-slate-300">
              {imp.avg_tenor_days != null && exp.avg_tenor_days != null
                ? `${Math.abs(exp.avg_tenor_days - imp.avg_tenor_days)}d`
                : '—'}
            </p>
          </div>
          <div>
            <p className="text-slate-500">Export avg tenor</p>
            <p className="font-mono font-semibold mt-0.5" style={{ color: EXPORT_COLOR }}>
              {exp.avg_tenor_days != null ? `${exp.avg_tenor_days}d` : '—'}
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

function BookCard({ book, type, color, icon }) {
  const {
    trade_count, gross_nominal_usd, net_nominal_usd,
    mtm_zar, avg_deal_rate, avg_tenor_days, ccy_breakdown,
  } = book

  return (
    <div className="card" style={{ borderLeft: `3px solid ${color}` }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5" style={{ color }}>
          {icon}
          <p className="text-xs font-semibold">{type} Book</p>
        </div>
        <span
          className="text-[10px] font-mono px-2 py-0.5 rounded-full text-white"
          style={{ background: `${color}33`, color }}
        >
          {trade_count} trades
        </span>
      </div>

      {/* Primary metric */}
      <p className="text-3xl font-mono font-bold mb-0.5" style={{ color }}>
        {usdM(gross_nominal_usd)}
      </p>
      <p className="text-xs text-slate-500 mb-4">Gross nominal (active trades)</p>

      {/* Stats grid */}
      <div className="space-y-2.5">
        <StatRow
          label="Net nominal"
          value={usdM(net_nominal_usd)}
          sub="after cancellations"
          valueColor={net_nominal_usd >= 0 ? '#6BA439' : '#3b82f6'}
        />
        <StatRow
          label="MTM (ZAR)"
          value={zarM(mtm_zar)}
          valueColor={mtm_zar >= 0 ? '#6BA439' : '#ef4444'}
        />
        <StatRow
          label="Avg deal rate"
          value={avg_deal_rate != null ? avg_deal_rate.toFixed(4) : '—'}
          sub="USD/ZAR weighted"
        />
        <StatRow
          label="Avg tenor"
          value={avg_tenor_days != null ? `${avg_tenor_days}d` : '—'}
          sub={avg_tenor_days ? (avg_tenor_days < 60 ? 'Short dated' : avg_tenor_days < 150 ? 'Medium dated' : 'Long dated') : ''}
          valueColor={avg_tenor_days < 60 ? '#fb923c' : avg_tenor_days < 150 ? '#fbbf24' : '#3b82f6'}
        />
      </div>

      {/* Currency breakdown */}
      {ccy_breakdown?.length > 0 && (
        <div className="mt-4 pt-3 border-t border-kuda-border">
          <p className="text-[10px] text-slate-500 mb-2 uppercase tracking-wide">Currency split</p>
          {ccy_breakdown.map(c => (
            <div key={c.ccy} className="flex justify-between text-xs mb-1">
              <span className="text-slate-500 font-mono">{c.ccy}</span>
              <span className="text-slate-300 font-mono">{usdM(c.nominal_usd)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function StatRow({ label, value, sub, valueColor }) {
  return (
    <div className="flex justify-between items-start gap-2">
      <div>
        <p className="text-[10px] text-slate-500">{label}</p>
        {sub && <p className="text-[10px] text-slate-600">{sub}</p>}
      </div>
      <p className="text-sm font-mono font-semibold shrink-0" style={{ color: valueColor || '#cbd5e1' }}>
        {value}
      </p>
    </div>
  )
}
