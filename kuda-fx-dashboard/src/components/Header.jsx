import React from 'react'
import { PrinterIcon, RefreshCwIcon } from 'lucide-react'
import { dateStr, rate } from '../utils/formatters'

export default function Header({ meta, onReset }) {
  const handlePrint = () => window.print()

  return (
    <header className="bg-kuda-blue border-b border-kuda-bluelt sticky top-0 z-40 no-print shadow-lg">
      <div className="max-w-screen-2xl mx-auto px-6 py-3 flex items-center justify-between gap-4">

        {/* Kuda brand logo */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Geometric horse mark — simplified polygon badge */}
          <div className="w-9 h-9 shrink-0" aria-hidden="true">
            <svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* Polygon horse mark built from Kuda brand palette */}
              <rect width="36" height="36" rx="6" fill="#195A7D"/>
              {/* Main horse head facets */}
              <polygon points="18,4 26,10 22,18 14,16" fill="#6BA439"/>
              <polygon points="14,16 22,18 20,26 12,24" fill="#49762E"/>
              <polygon points="22,18 28,14 30,22 24,24" fill="#243746"/>
              <polygon points="24,24 30,22 28,30 22,30" fill="#195A7D"/>
              <polygon points="12,24 20,26 18,32 10,30" fill="#6BA439"/>
              <polygon points="18,4 26,10 30,6 24,2" fill="#BADCE6"/>
              <polygon points="26,10 30,6 32,14 28,14" fill="#195A7D" opacity="0.7"/>
              {/* Snout/lower accent */}
              <polygon points="10,30 18,32 16,36 8,34" fill="#49762E"/>
            </svg>
          </div>

          <div>
            <div
              className="font-bold text-white leading-none tracking-wide"
              style={{ fontFamily: "'Raleway', sans-serif", fontSize: '15px', letterSpacing: '0.06em' }}
            >
              KUDA <span className="font-normal text-kuda-skyblue" style={{ fontSize: '12px', letterSpacing: '0.12em' }}>FOREIGN EXCHANGE</span>
            </div>
            <div className="text-xs text-kuda-skyblue/70 leading-none mt-0.5 tracking-widest uppercase" style={{ fontSize: '9px' }}>
              FX Facility Management · FYN005836
            </div>
          </div>
        </div>

        {/* Meta info */}
        {meta && (
          <div className="hidden md:flex items-center gap-6 text-xs text-blue-200 font-mono">
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
            <button
              onClick={onReset}
              className="flex items-center gap-2 border border-kuda-skyblue/30 hover:border-kuda-skyblue/70
                         text-kuda-skyblue/70 hover:text-white text-xs px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
            >
              <RefreshCwIcon size={13} />
              New upload
            </button>
          )}
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 border border-kuda-skyblue/30 hover:border-kuda-skyblue/70
                       text-kuda-skyblue/70 hover:text-white text-xs px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
          >
            <PrinterIcon size={13} />
            Print
          </button>
        </div>
      </div>
    </header>
  )
}

function MetaChip({ label, value }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-blue-300/60">{label}</span>
      <span className="text-white font-medium">{value}</span>
    </div>
  )
}

function SpotChip({ meta }) {
  const { spot_usd_zar, spot_source } = meta
  const badge = {
    user:   { label: 'manual',      color: 'text-kuda-teal border-kuda-teal/40' },
    fxflow: { label: 'FXFlow',      color: 'text-kuda-teal border-kuda-teal/40' },
    live:   { label: 'live',        color: 'text-kuda-teal border-kuda-teal/40' },
    book:   { label: 'book avg ⚠',  color: 'text-amber-300 border-amber-300/40' },
  }[spot_source] || { label: '', color: '' }

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-blue-300/60">USD/ZAR</span>
      <span className="text-kuda-teal font-semibold">{rate(spot_usd_zar)}</span>
      {badge.label && (
        <span
          className={`text-[9px] font-semibold uppercase tracking-wide px-1 py-0.5 rounded border ${badge.color} opacity-80`}
          title={
            spot_source === 'book'
              ? "Rate derived from avg forward booking rates — not the live market spot. Upload the FXFlow Facility Summary or enter today's rate manually to fix."
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
