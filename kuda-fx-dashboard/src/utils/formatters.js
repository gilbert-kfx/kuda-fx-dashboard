/** Number & date formatting utilities for the Kuda FX dashboard. */

/** Format ZAR amount with R prefix and thousands separator. */
export const zarM = (n) => {
  if (n == null) return '—'
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}R${(abs / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000)     return `${sign}R${(abs / 1_000).toFixed(1)}K`
  return `${sign}R${abs.toFixed(0)}`
}

/** Format ZAR as compact thousands (for table cells). */
export const zarK = (n) => {
  if (n == null) return '—'
  const abs = Math.abs(n)
  const sign = n < 0 ? '(' : ''
  const end  = n < 0 ? ')' : ''
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}M${end}`
  return `${sign}${Math.round(abs / 1_000).toLocaleString()}K${end}`
}

/** Format USD amount. */
export const usdM = (n) => {
  if (n == null) return '—'
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000)     return `${sign}$${(abs / 1_000).toFixed(0)}K`
  return `${sign}$${abs.toFixed(0)}`
}

/** Format a percentage. */
export const pct = (n, decimals = 1) => {
  if (n == null) return '—'
  return `${n.toFixed(decimals)}%`
}

/** Format a rate. */
export const rate = (n, decimals = 4) => {
  if (n == null) return '—'
  return n.toFixed(decimals)
}

/** Format a date string as DD MMM YYYY. */
export const dateStr = (s) => {
  if (!s) return '—'
  const d = new Date(s)
  return d.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' })
}

/** Return a Tailwind color class based on MTM vs CSA threshold. */
export const mtmColor = (mtm, threshold = -15_000_000) => {
  if (mtm == null) return 'text-slate-400'
  if (mtm < threshold) return 'text-red-400'
  if (mtm < threshold * 0.5) return 'text-amber-500'
  if (mtm < 0) return 'text-yellow-400'
  return 'text-kuda-teal'
}

/** Return utilisation color (teal → amber → red). */
export const utilColor = (pctUsed) => {
  if (pctUsed == null) return 'text-slate-400'
  if (pctUsed >= 100) return 'text-red-400'
  if (pctUsed >= 80)  return 'text-amber-500'
  if (pctUsed >= 60)  return 'text-yellow-400'
  return 'text-kuda-teal'
}

/** Return progress bar bg class. */
export const utilBarColor = (pctUsed) => {
  if (pctUsed == null) return 'bg-slate-600'
  if (pctUsed >= 100) return 'bg-red-500'
  if (pctUsed >= 80)  return 'bg-amber-500'
  if (pctUsed >= 60)  return 'bg-yellow-400'
  return 'bg-kuda-teal'
}

/** Status pill CSS. */
export const statusPill = (status) => {
  switch (status?.toLowerCase()) {
    case 'safe':    return 'pill pill-safe'
    case 'watch':   return 'pill pill-watch'
    case 'warning': return 'pill pill-warning'
    case 'breach':  return 'pill pill-breach'
    default:        return 'pill bg-slate-700 text-slate-300'
  }
}

/** Capitalise first letter. */
export const cap = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : ''
