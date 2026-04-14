import React from 'react'
import { RadialBarChart, RadialBar, ResponsiveContainer, Tooltip } from 'recharts'
import { ShieldCheckIcon, AlertTriangleIcon } from 'lucide-react'
import { zarM, usdM, pct, dateStr, utilColor, utilBarColor } from '../utils/formatters'

export default function FacilityLimits({ data }) {
  if (!data) return null
  const {
    dealing_cap_usd, long_nominal_usd, net_nominal_usd, gross_nominal_usd,
    nominal_headroom_usd, nominal_utilisation_pct,
    pfe_limit_zar, pfe_exposure_zar, pfe_utilisation_pct,
    settlement_limit_usd, max_settlement_usd, max_settlement_date, settlement_breaches,
    max_tenor_days, max_tenor_limit_days, tenor_breach,
    total_open_trades, fec_count, option_count,
    fec_gross_notional_usd, fec_net_notional_usd,
    opt_gross_notional_usd, opt_net_notional_usd,
  } = data

  return (
    <section>
      <h2 className="section-title">1 · Facility Limits — FYN005836</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">

        {/* Dealing Cap */}
        <LimitCard
          title="Dealing Cap"
          subtitle="USD 24M nominal"
          used={long_nominal_usd}
          limit={dealing_cap_usd}
          utilPct={nominal_utilisation_pct}
          primary={usdM(long_nominal_usd)}
          primaryLabel="Long-side nominal (USD)"
          secondary={`Net ${usdM(net_nominal_usd)} · Gross ${usdM(gross_nominal_usd)} · Headroom ${usdM(nominal_headroom_usd)}`}
          breach={nominal_utilisation_pct >= 100}
        />

        {/* PFE */}
        <LimitCard
          title="PFE Limit"
          subtitle="ZAR 35M potential future exposure"
          used={pfe_exposure_zar}
          limit={pfe_limit_zar}
          utilPct={pfe_utilisation_pct}
          primary={zarM(pfe_exposure_zar)}
          primaryLabel="Stress exposure (ZAR)"
          secondary={`Limit ${zarM(pfe_limit_zar)} · Headroom ${zarM(pfe_limit_zar - pfe_exposure_zar)}`}
          breach={pfe_utilisation_pct >= 100}
        />

        {/* Settlement */}
        <LimitCard
          title="Settlement Limit"
          subtitle="USD 5M per settlement date"
          used={max_settlement_usd}
          limit={settlement_limit_usd}
          utilPct={(max_settlement_usd / settlement_limit_usd) * 100}
          primary={usdM(max_settlement_usd)}
          primaryLabel={`Peak date: ${dateStr(max_settlement_date)}`}
          secondary={settlement_breaches > 0
            ? `⚠ ${settlement_breaches} date${settlement_breaches > 1 ? 's' : ''} exceed limit`
            : 'All settlement dates within limit'}
          breach={settlement_breaches > 0}
        />

        {/* Tenor */}
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs font-semibold text-slate-300">Max Tenor</p>
              <p className="text-xs text-slate-500">12 month maximum</p>
            </div>
            {tenor_breach
              ? <AlertTriangleIcon size={18} className="text-red-400" />
              : <ShieldCheckIcon    size={18} className="text-kuda-teal" />
            }
          </div>
          <p className={`metric-value mb-0.5 ${tenor_breach ? 'text-red-400' : 'text-kuda-teal'}`}>
            {max_tenor_days}d
          </p>
          <p className="metric-label">Longest open position</p>
          <ProgressBar pct={(max_tenor_days / max_tenor_limit_days) * 100} />
          <div className="mt-4 pt-3 border-t border-kuda-border grid grid-cols-2 gap-2 text-xs">
            <StatRow label="FECs"    value={fec_count} />
            <StatRow label="Options" value={option_count} />
            <StatRow label="FEC gross" value={usdM(fec_gross_notional_usd)} />
            <StatRow label="FEC net"   value={usdM(fec_net_notional_usd)} />
            <StatRow label="Opt gross" value={usdM(opt_gross_notional_usd)} />
            <StatRow label="Opt net"   value={usdM(opt_net_notional_usd)} />
          </div>
        </div>

      </div>
    </section>
  )
}

function LimitCard({ title, subtitle, used, limit, utilPct, primary, primaryLabel, secondary, breach }) {
  const clampedPct = Math.min(utilPct, 100)

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-xs font-semibold text-slate-300">{title}</p>
          <p className="text-xs text-slate-500">{subtitle}</p>
        </div>
        {breach
          ? <AlertTriangleIcon size={18} className="text-red-400" />
          : <ShieldCheckIcon    size={18} className="text-kuda-teal" />
        }
      </div>
      <p className={`metric-value mb-0.5 ${utilColor(utilPct)}`}>{primary}</p>
      <p className="metric-label">{primaryLabel}</p>
      <ProgressBar pct={clampedPct} breach={breach} />
      <p className="text-xs text-slate-500 mt-2">{secondary}</p>
    </div>
  )
}

function ProgressBar({ pct: pctVal, breach }) {
  const clamped = Math.min(Math.max(pctVal, 0), 100)
  return (
    <div className="mt-3 h-1.5 bg-kuda-navymid rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all ${utilBarColor(pctVal)}`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  )
}

function StatRow({ label, value }) {
  return (
    <div>
      <p className="text-slate-500">{label}</p>
      <p className="text-slate-300 font-mono font-medium">{value}</p>
    </div>
  )
}
