import React from 'react'
import { PrinterIcon, RefreshCwIcon, ChevronDownIcon } from 'lucide-react'
import { dateStr, rate } from '../utils/formatters'

export default function Header({ meta, onReset }) {
  const handlePrint = () => window.print()

  return (
    <header className="bg-kuda-navylt border-b border-kuda-border sticky top-0 z-40 no-print">
      <div className="max-w-screen-2xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
        {/* Logo / Brand */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-kuda-teal flex items-center justify-center">
            <span className="text-kuda-navy font-bold text-sm">K</span>
          </div>
          <div>
            <div className="font-semibold text-sm text-white leading-none">CBC Kuda Foreign Exchange</div>
            <div className="text-xs text-slate-500 leading-none mt-0.5">Facility Risk Dashboard · FYN005836</div>
          </div>
        </div>

        {/* Meta info */}
        {meta && (
          <div className="hidden md:flex items-center gap-6 text-xs text-slate-400 font-mono">
            <MetaChip label="MTM Date"  value={dateStr(meta.mtm_date)} />
            <SpotChip meta={meta} />
            <MetaChip label="GBP/ZAR"   value={rate(meta.gbp_usd * meta.spot_usd_zar, 4)} />
            <MetaChip label="EUR/ZAR"   value={rate(meta.eur_usd * meta.spot_usd_zar, 4)} />
            <MetaChip label="GBP/USD"   value={rate(meta.gbp_usd, 4)} />
            <MetaChip label="EUR/USD"   value={rate(meta.eur_usd, 4)} />
            <MetaChip label="Trades"    value={meta.total_trades} />
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {meta && (
            <button onClick={onReset} className="btn-ghost text-xs py-1.5 px-3">
              <RefreshCwIcon size={13} />
              New upload
            </button>
          )}
          <button onClick={handlePrint} className="btn-ghost text-xs py-1.5 px-3">
            <PrinterIcon size={13} />
            Print
          </button>
        </div>
      </div>
    </header>
  )
}

function MetaChip({ label, value, highlight }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-slate-600">{label}</span>
      <span className={highlight ? 'text-kuda-teal font-medium' : 'text-slate-300'}>{value}</span>
    </div>
  )
}

/** Spot rate chip — shows source badge so users know where the rate came from. */
function SpotChip({ meta }) {
  const { spot_usd_zar, spot_source } = meta
  const badge = {
    user:   { label: 'manual',   color: 'text-kuda-teal' },
    fxflow: { label: 'FXFlow',   color: 'text-kuda-teal' },
    live:   { label: 'live',     color: 'text-kuda-teal' },
    book:   { label: 'book avg ⚠', color: 'text-amber-400' },
  }[spot_source] || { label: '', color: '' }

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-slate-600">USD/ZAR</span>
      <span className="text-kuda-teal font-medium">{rate(spot_usd_zar)}</span>
      {badge.label && (
        <span
          className={`text-[9px] font-semibold uppercase tracking-wide px-1 py-0.5 rounded ${badge.color} border border-current opacity-70`}
          title={
            spot_source === 'book'
              ? 'Rate derived from avg forward booking rates — not the live market spot. Upload the FXFlow Facility Summary or enter today\'s rate manually to fix.'
              : spot_source === 'fxflow'
              ? 'Market rate sourced directly from FXFlow Facility Summary'
              : spot_source === 'live'
              ? 'Live market rate fetched automatically'
              : 'Rate manually entered on upload'
          }
        >
          {badge.label}
        </span>
      )}
    </div>
  )
}
