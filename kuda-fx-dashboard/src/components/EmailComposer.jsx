import React, { useState, useEffect } from 'react'
import {
  XIcon, CopyIcon, CheckIcon, MailIcon, RefreshCwIcon,
  LoaderIcon, AlertCircleIcon, CheckCircleIcon, PlusIcon, TrashIcon,
} from 'lucide-react'
import { zarM, usdM, rate } from '../utils/formatters'

// ─── Formatting helpers ───────────────────────────────────────────────────────

function fmtDate(s) {
  if (!s) return '—'
  const d = new Date(s)
  return d.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtDateShort(s) {
  if (!s) return '—'
  const d = new Date(s)
  return d.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short' })
}

function fmtNum(n, decimals = 0) {
  if (n == null) return '0'
  return Math.round(Math.abs(n)).toLocaleString('en-ZA')
}

function fmtRate(n) {
  if (!n) return '—'
  return Number(n).toFixed(4)
}

// ─── Email HTML builder ───────────────────────────────────────────────────────

function buildEmailHtml({ clients, commentary, openOrders, spot, gbpZar, eurZar, senderName, mtmDate, dealingCap }) {
  const S   = '#0B1E3D'    // kuda-navy
  const SLT = '#0F2142'    // kuda-navylt
  const BRD = '#1E3A5F'    // kuda-border
  const TEL = '#00C896'    // kuda-teal
  const RED = '#EF4444'
  const SL4 = '#94a3b8'    // slate-400
  const SL5 = '#64748b'    // slate-500
  const WHT = '#ffffff'
  const LGT = '#f8fafc'    // light bg

  // Combine all trades across all selected clients
  const allTrades = clients.flatMap(c =>
    (c.trades || []).map(t => ({ ...t, entity: c.name }))
  )
  const activeTrades = allTrades.filter(t =>
    ['FORWARD','DRAWDOWN','EXTENSION','Vanilla','Forward Enhancer'].includes(t.product_type)
    && t.days_to_maturity !== null && t.days_to_maturity >= 0
  )

  // Combined portfolio stats
  const totalNominal = clients.reduce((s, c) => s + (c.long_nominal_usd || 0), 0)
  const totalMtm     = clients.reduce((s, c) => s + (c.net_mtm_zar || 0), 0)
  const totalTrades  = activeTrades.length
  const utilPct      = dealingCap ? Math.round(totalNominal / dealingCap * 100) : null

  // Upcoming maturities (next 30 days), sorted by date
  const upcoming30 = activeTrades
    .filter(t => t.days_to_maturity <= 30)
    .sort((a, b) => a.days_to_maturity - b.days_to_maturity)

  const upcoming90 = activeTrades
    .filter(t => t.days_to_maturity <= 90)
    .sort((a, b) => a.days_to_maturity - b.days_to_maturity)

  // Cash flow schedule: group by month
  const cashFlowMap = {}
  activeTrades.forEach(t => {
    const d = new Date(t.maturity_date)
    if (isNaN(d)) return
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
    const label = d.toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' })
    if (!cashFlowMap[key]) cashFlowMap[key] = { label, trades: [], nominal: 0 }
    cashFlowMap[key].trades.push(t)
    cashFlowMap[key].nominal += Math.abs(t.nominal_usd || 0)
  })
  const cashFlows = Object.entries(cashFlowMap)
    .sort(([a],[b]) => a.localeCompare(b))
    .map(([,v]) => v)
    .slice(0, 6)  // show 6 months

  // ── CSS shared ────────────────────────────────────────────────────────────
  const tdBase = `padding:5px 8px;border-bottom:1px solid #e2e8f0;font-size:11px;`
  const thBase = `padding:6px 8px;font-size:10px;font-weight:600;color:#475569;text-transform:uppercase;letter-spacing:0.04em;border-bottom:2px solid #cbd5e1;background:#f0f4f8;`

  const sectionTitle = (title) => `
    <tr><td colspan="99" style="padding:20px 0 8px;">
      <div style="border-left:3px solid ${TEL};padding-left:10px;">
        <p style="margin:0;font-size:13px;font-weight:700;color:#1e293b;text-transform:uppercase;letter-spacing:0.05em;">${title}</p>
      </div>
    </td></tr>`

  const mtmFmt = (n) => {
    const abs = Math.abs(n)
    const sign = n >= 0 ? '+' : '-'
    const col = n >= 0 ? '#00856a' : '#c0392b'
    const s = abs >= 1e6 ? `${sign}R${(abs/1e6).toFixed(2)}M` : abs >= 1e3 ? `${sign}R${(abs/1e3).toFixed(0)}K` : `${sign}R${Math.round(abs)}`
    return `<span style="color:${col};font-weight:600;">${s}</span>`
  }

  const nomFmt = (n) => {
    const abs = Math.abs(n)
    const s = abs >= 1e6 ? `$${(abs/1e6).toFixed(2)}M` : abs >= 1e3 ? `$${(abs/1e3).toFixed(0)}K` : `$${Math.round(abs)}`
    return s
  }

  // ── Trade table builder ───────────────────────────────────────────────────
  const tradeTable = (rows, showEntity = false) => {
    if (!rows.length) return `<p style="color:#94a3b8;font-size:12px;padding:8px 0;">No open contracts in this category.</p>`
    const headers = [
      ...(showEntity ? ['Entity'] : []),
      'Type','Currency','Direction','Notional','Deal Rate','Trade Date','Maturity','Days','MTM (ZAR)'
    ]
    return `
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
      <thead><tr>${headers.map(h => `<th style="${thBase}text-align:${['Notional','Deal Rate','Days','MTM (ZAR)'].includes(h)?'right':'left'}">${h}</th>`).join('')}</tr></thead>
      <tbody>${rows.map((t,i) => {
        const bg = i%2===0?'#ffffff':'#f8fafc'
        const urg = t.days_to_maturity<=7?'color:#c0392b;font-weight:700;':t.days_to_maturity<=14?'color:#d97706;':''
        return `<tr style="background:${bg};">
          ${showEntity ? `<td style="${tdBase}font-weight:600;color:#334155;">${t.entity}</td>` : ''}
          <td style="${tdBase}"><span style="background:#e0f2fe;color:#0369a1;font-size:9px;font-weight:700;padding:1px 5px;border-radius:3px;text-transform:uppercase;">${t.product_type}</span></td>
          <td style="${tdBase}font-weight:700;color:#1e293b;">${t.ccy_pair}</td>
          <td style="${tdBase}">${t.direction_client}</td>
          <td style="${tdBase}text-align:right;font-family:monospace;">${fmtNum(t.notional_fcy)}</td>
          <td style="${tdBase}text-align:right;font-family:monospace;">${fmtRate(t.deal_rate)}</td>
          <td style="${tdBase};color:#64748b;">${fmtDate(t.trade_date)}</td>
          <td style="${tdBase}text-align:right;${urg}">${fmtDate(t.maturity_date)}</td>
          <td style="${tdBase}text-align:right;${urg}">${t.days_to_maturity}</td>
          <td style="${tdBase}text-align:right;">${mtmFmt(t.mtm_zar)}</td>
        </tr>`
      }).join('')}
      <tr style="background:#f0fdf4;border-top:2px solid #86efac;">
        <td colspan="${headers.length - 1}" style="padding:6px 8px;font-size:11px;font-weight:700;color:#166534;">Total</td>
        <td style="padding:6px 8px;text-align:right;font-size:11px;">${mtmFmt(rows.reduce((s,t)=>s+t.mtm_zar,0))}</td>
      </tr>
      </tbody>
    </table>`
  }

  // ── Commentary section ────────────────────────────────────────────────────
  const commentaryHtml = commentary?.articles?.length ? `
    <table width="100%" cellpadding="0" cellspacing="0">
      ${sectionTitle('ZAR Market Update')}
      <tr><td colspan="99" style="padding:0 0 20px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:6px;overflow:hidden;">
          ${commentary.articles.slice(0, 5).map(a => `
          <tr style="border-bottom:1px solid #bae6fd;">
            <td style="padding:10px 14px;">
              <div style="display:flex;align-items:flex-start;gap:8px;">
                <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#0284c7;margin-top:5px;flex-shrink:0;"></span>
                <div>
                  <p style="margin:0 0 3px;font-size:12px;font-weight:600;color:#0c4a6e;">
                    ${a.link ? `<a href="${a.link}" style="color:#0284c7;text-decoration:none;">${a.title}</a>` : a.title}
                  </p>
                  ${a.summary ? `<p style="margin:0;font-size:11px;color:#334155;line-height:1.5;">${a.summary.slice(0,220)}${a.summary.length>220?'…':''}</p>` : ''}
                  <p style="margin:3px 0 0;font-size:9px;color:#64748b;">${a.source}${a.pub ? ' · ' + new Date(a.pub).toLocaleDateString('en-ZA',{day:'2-digit',month:'short',year:'numeric'}) : ''}</p>
                </div>
              </div>
            </td>
          </tr>`).join('')}
        </table>
        <p style="margin:6px 0 0;font-size:9px;color:#94a3b8;">Market news sourced from public feeds. Not financial advice.</p>
      </td></tr>
    </table>` : ''

  // ── Per-entity sections ───────────────────────────────────────────────────
  const entitySections = clients.map(client => {
    const clientTrades = activeTrades.filter(t => t.entity === client.name)
    const imports = clientTrades.filter(t => t.import_export?.toLowerCase() === 'import')
    const exports = clientTrades.filter(t => t.import_export?.toLowerCase() === 'export')
    const other   = clientTrades.filter(t => !['import','export'].includes(t.import_export?.toLowerCase()))

    const groups = [
      ...(imports.length || !exports.length ? [{ label: `${client.name} — Import Book`, rows: imports.length ? imports : other }] : []),
      ...(exports.length ? [{ label: `${client.name} — Export Book`, rows: exports }] : []),
    ]

    const clientOrders = openOrders[client.name] || ''

    return `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;">
      <!-- Entity divider -->
      <tr><td colspan="99" style="padding:16px 0 4px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;border-radius:6px;overflow:hidden;">
          <tr>
            <td style="padding:10px 16px;">
              <p style="margin:0;font-size:14px;font-weight:700;color:${WHT};">${client.name}</p>
            </td>
            <td style="padding:10px 16px;text-align:right;">
              <span style="font-size:11px;color:${SL4};margin-right:16px;">${client.trade_count} contracts</span>
              <span style="font-size:11px;color:${SL4};margin-right:16px;">Long: ${nomFmt(client.long_nominal_usd)}</span>
              <span style="font-size:11px;${client.net_mtm_zar>=0?`color:${TEL}`:`color:${RED}`}">MTM: ${mtmFmt(client.net_mtm_zar)}</span>
            </td>
          </tr>
        </table>
      </td></tr>

      ${groups.map(g => `
      ${sectionTitle(g.label)}
      <tr><td colspan="99" style="padding:0 0 16px;">${tradeTable(g.rows)}</td></tr>`).join('')}

      ${clientOrders ? `
      ${sectionTitle(`Open Firm Orders — ${client.name}`)}
      <tr><td colspan="99" style="padding:0 0 16px;">
        <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:6px;padding:12px 16px;">
          <pre style="margin:0;font-size:12px;color:#78350f;font-family:Arial,sans-serif;white-space:pre-wrap;">${clientOrders}</pre>
        </div>
      </td></tr>` : ''}
    </table>`
  }).join('')

  // ── Upcoming contracts ────────────────────────────────────────────────────
  const upcomingHtml = upcoming90.length ? `
    <table width="100%" cellpadding="0" cellspacing="0">
      ${sectionTitle('Upcoming Contracts — Next 90 Days')}
      <tr><td colspan="99" style="padding:0 0 20px;">
        ${tradeTable(upcoming90, clients.length > 1)}
      </td></tr>
    </table>` : ''

  // ── Cash flow schedule ────────────────────────────────────────────────────
  const cfHtml = cashFlows.length ? `
    <table width="100%" cellpadding="0" cellspacing="0">
      ${sectionTitle('Upcoming Cash Flow Schedule')}
      <tr><td colspan="99" style="padding:0 0 20px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
          <thead><tr>
            <th style="${thBase}text-align:left;">Month</th>
            <th style="${thBase}text-align:right;">Contracts</th>
            <th style="${thBase}text-align:right;">Total USD Nominal</th>
            <th style="${thBase}text-align:right;">ZAR Equivalent</th>
          </tr></thead>
          <tbody>${cashFlows.map((cf,i) => {
            const zarEq = spot ? cf.nominal * spot : null
            return `<tr style="background:${i%2===0?'#ffffff':'#f8fafc'};">
              <td style="${tdBase}font-weight:600;color:#1e293b;">${cf.label}</td>
              <td style="${tdBase}text-align:right;">${cf.trades.length}</td>
              <td style="${tdBase}text-align:right;font-family:monospace;">${nomFmt(cf.nominal)}</td>
              <td style="${tdBase}text-align:right;font-family:monospace;">${zarEq ? `R${Math.round(zarEq).toLocaleString('en-ZA')}` : '—'}</td>
            </tr>`
          }).join('')}
          </tbody>
        </table>
      </td></tr>
    </table>` : ''

  // ── Facility summary ──────────────────────────────────────────────────────
  const facilityHtml = dealingCap ? `
    <table width="100%" cellpadding="0" cellspacing="0">
      ${sectionTitle('Facility Summary — Investec Bank FYN005836')}
      <tr><td colspan="99" style="padding:0 0 20px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;">
          <tr>
            <td style="padding:12px 16px;border-right:1px solid #e2e8f0;text-align:center;">
              <div style="font-size:10px;color:#64748b;margin-bottom:4px;text-transform:uppercase;">Open Nominal</div>
              <div style="font-size:18px;font-weight:700;color:#1e293b;">${nomFmt(totalNominal)}</div>
            </td>
            <td style="padding:12px 16px;border-right:1px solid #e2e8f0;text-align:center;">
              <div style="font-size:10px;color:#64748b;margin-bottom:4px;text-transform:uppercase;">Dealing Cap</div>
              <div style="font-size:18px;font-weight:700;color:#1e293b;">${nomFmt(dealingCap)}</div>
            </td>
            <td style="padding:12px 16px;border-right:1px solid #e2e8f0;text-align:center;">
              <div style="font-size:10px;color:#64748b;margin-bottom:4px;text-transform:uppercase;">Utilisation</div>
              <div style="font-size:18px;font-weight:700;color:${utilPct>90?'#c0392b':utilPct>75?'#d97706':'#166534'};">${utilPct}%</div>
            </td>
            <td style="padding:12px 16px;text-align:center;">
              <div style="font-size:10px;color:#64748b;margin-bottom:4px;text-transform:uppercase;">Headroom</div>
              <div style="font-size:18px;font-weight:700;color:#166534;">${nomFmt(dealingCap - totalNominal)}</div>
            </td>
          </tr>
        </table>
      </td></tr>
    </table>` : ''

  const clientNames = clients.map(c => c.name).join(' & ')
  const weekStr = new Date().toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' })

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width"/></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:20px 0;">
<tr><td align="center">
<table width="700" cellpadding="0" cellspacing="0"
       style="max-width:700px;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

  <!-- Header -->
  <tr><td style="background:#0B1E3D;padding:20px 28px;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td>
          <div style="color:#00C896;font-size:22px;font-weight:800;letter-spacing:0.02em;">CBC Kuda FX</div>
          <div style="color:#94a3b8;font-size:11px;margin-top:2px;">Authorised Financial Services Provider · FSP 46310</div>
        </td>
        <td align="right" style="color:#64748b;font-size:11px;text-align:right;">
          <div>Weekly FX Position Update</div>
          <div style="margin-top:3px;">${weekStr}</div>
          ${spot ? `<div style="margin-top:3px;color:#94a3b8;">USD/ZAR ${fmtRate(spot)}${gbpZar ? ` · GBP/ZAR ${fmtRate(gbpZar)}` : ''}${eurZar ? ` · EUR/ZAR ${fmtRate(eurZar)}` : ''}</div>` : ''}
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- Body -->
  <tr><td style="padding:24px 28px;">

    <!-- Greeting -->
    <p style="margin:0 0 6px;font-size:14px;color:#1e293b;">Dear ${clientNames},</p>
    <p style="margin:0 0 24px;font-size:13px;color:#475569;line-height:1.6;">
      Please find your weekly FX position update below for the period ending <strong>${fmtDate(mtmDate || new Date().toISOString())}</strong>.
      ${spot ? `USD/ZAR is currently trading at <strong>${fmtRate(spot)}</strong>.` : ''}
    </p>

    <!-- Portfolio overview banner -->
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;border-radius:8px;margin-bottom:24px;">
      <tr>
        <td style="padding:14px 16px;border-right:1px solid #1e3a5f;text-align:center;">
          <div style="font-size:9px;color:#64748b;text-transform:uppercase;margin-bottom:4px;">Open Contracts</div>
          <div style="font-size:20px;font-weight:800;color:#ffffff;">${totalTrades}</div>
        </td>
        <td style="padding:14px 16px;border-right:1px solid #1e3a5f;text-align:center;">
          <div style="font-size:9px;color:#64748b;text-transform:uppercase;margin-bottom:4px;">Total Nominal</div>
          <div style="font-size:20px;font-weight:800;color:#ffffff;">${nomFmt(totalNominal)}</div>
        </td>
        <td style="padding:14px 16px;border-right:1px solid #1e3a5f;text-align:center;">
          <div style="font-size:9px;color:#64748b;text-transform:uppercase;margin-bottom:4px;">Mark-to-Market</div>
          <div style="font-size:20px;font-weight:800;">${mtmFmt(totalMtm)}</div>
        </td>
        <td style="padding:14px 16px;text-align:center;">
          <div style="font-size:9px;color:#64748b;text-transform:uppercase;margin-bottom:4px;">Maturing ≤30 days</div>
          <div style="font-size:20px;font-weight:800;color:${upcoming30.length>0?'#f59e0b':'#ffffff'};">${upcoming30.length}</div>
        </td>
      </tr>
    </table>

    ${commentaryHtml}
    ${upcomingHtml}
    ${cfHtml}
    ${entitySections}
    ${facilityHtml}

    <!-- Sign-off -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;border-top:1px solid #e2e8f0;">
      <tr><td style="padding:16px 0 0;">
        <p style="margin:0 0 4px;font-size:13px;color:#475569;">Vriendelike groete / Kind regards,</p>
        <p style="margin:0;font-size:13px;color:#1e293b;font-weight:700;">${senderName || 'CBC Kuda FX Dealing Desk'}</p>
        <p style="margin:2px 0 0;font-size:11px;color:#64748b;">CBC Kuda Foreign Exchange (Pty) Ltd</p>
      </td></tr>
    </table>

  </td></tr>

  <!-- Footer -->
  <tr><td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:14px 28px;text-align:center;">
    <p style="margin:0;font-size:10px;color:#94a3b8;">
      CBC Kuda Foreign Exchange (Pty) Ltd · FSP 46310 ·
      <a href="https://kuda.co.za/fx/" style="color:#00856a;">kuda.co.za/fx</a> ·
      Facility FYN005836 · Investec Bank
    </p>
    <p style="margin:4px 0 0;font-size:10px;color:#94a3b8;">
      This communication is confidential and intended solely for the named recipient.
      Market commentary is for informational purposes only and does not constitute financial advice.
    </p>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`
}

// ─── Email Composer component ─────────────────────────────────────────────────

export default function EmailComposer({ allClients, initialClient, meta, facilityLimits, onClose }) {
  // Selected client entities for this email (supports multi-select for grouped entities)
  const [selectedNames, setSelectedNames] = useState(
    initialClient ? [initialClient.name] : []
  )
  const [senderName,   setSenderName]   = useState('')
  const [openOrders,   setOpenOrders]   = useState({})  // { clientName: text }
  const [commentary,   setCommentary]   = useState(null) // fetched news data
  const [commLoading,  setCommLoading]  = useState(false)
  const [commError,    setCommError]    = useState(null)
  const [copied,       setCopied]       = useState(false)
  const [tab,          setTab]          = useState('preview')

  const selectedClients = allClients.filter(c => selectedNames.includes(c.name))

  const toggleClient = (name) => {
    setSelectedNames(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    )
  }

  const fetchCommentary = async () => {
    setCommLoading(true)
    setCommError(null)
    try {
      const res = await fetch('/api/commentary')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setCommentary(data)
    } catch (e) {
      setCommError(`Could not fetch commentary: ${e.message}`)
    } finally {
      setCommLoading(false)
    }
  }

  // Auto-fetch on open
  useEffect(() => { fetchCommentary() }, [])

  const html = selectedClients.length ? buildEmailHtml({
    clients:    selectedClients,
    commentary,
    openOrders,
    spot:       meta?.spot_usd_zar,
    gbpZar:     meta?.gbp_usd && meta?.spot_usd_zar ? meta.gbp_usd * meta.spot_usd_zar : null,
    eurZar:     meta?.eur_usd && meta?.spot_usd_zar ? meta.eur_usd * meta.spot_usd_zar : null,
    senderName,
    mtmDate:    meta?.mtm_date,
    dealingCap: facilityLimits?.dealing_cap_usd,
  }) : '<p style="color:#94a3b8;padding:20px;">Select at least one client entity.</p>'

  const copyHtml = async () => {
    await navigator.clipboard.writeText(html)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  return (
    <div className="fixed inset-0 bg-black/75 z-50 flex items-start justify-center overflow-y-auto py-6 px-3">
      <div className="w-full max-w-6xl bg-kuda-navylt rounded-2xl border border-kuda-border shadow-2xl">

        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-kuda-border">
          <div className="flex items-center gap-3">
            <MailIcon size={16} className="text-kuda-teal" />
            <div>
              <p className="text-sm font-semibold text-white">Weekly Client Mailer</p>
              <p className="text-xs text-slate-400">
                {selectedClients.length ? selectedClients.map(c => c.name).join(' & ') : 'Select client entities below'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost p-1.5"><XIcon size={16} /></button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-0 divide-y lg:divide-y-0 lg:divide-x divide-kuda-border">

          {/* ── LEFT: Settings ─────────────────────────────────── */}
          <div className="lg:col-span-1 p-5 space-y-5 overflow-y-auto" style={{ maxHeight: '80vh' }}>

            {/* Client entity selector */}
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-2">
                Client Entities (select all to include)
              </p>
              <div className="space-y-1.5 max-h-44 overflow-y-auto">
                {allClients.map(c => (
                  <label key={c.name}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer border transition-all ${
                      selectedNames.includes(c.name)
                        ? 'border-kuda-teal/40 bg-kuda-teal/5'
                        : 'border-kuda-border hover:border-slate-500'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedNames.includes(c.name)}
                      onChange={() => toggleClient(c.name)}
                      className="accent-kuda-teal"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-white truncate">{c.name}</p>
                      <p className="text-[10px] text-slate-500 font-mono">
                        {c.trade_count} trades · {usdM(c.long_nominal_usd)}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Sender */}
            <div>
              <label className="block text-[10px] text-slate-500 uppercase tracking-widest mb-1">
                Sender name (sign-off)
              </label>
              <input
                type="text"
                placeholder="e.g. Stian van Zyl"
                value={senderName}
                onChange={e => setSenderName(e.target.value)}
                className="w-full bg-kuda-navy border border-kuda-border rounded-lg px-3 py-2
                           text-sm text-white placeholder-slate-600 focus:outline-none focus:border-kuda-teal"
              />
            </div>

            {/* Market commentary fetch */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] text-slate-500 uppercase tracking-widest">Market Commentary</p>
                <button
                  onClick={fetchCommentary}
                  disabled={commLoading}
                  className="btn-ghost text-[10px] py-1 px-2 flex items-center gap-1"
                >
                  {commLoading
                    ? <LoaderIcon size={11} className="animate-spin" />
                    : <RefreshCwIcon size={11} />}
                  Refresh
                </button>
              </div>

              {commLoading && (
                <div className="flex items-center gap-2 text-xs text-slate-500 py-2">
                  <LoaderIcon size={12} className="animate-spin" />
                  Fetching ZAR market news…
                </div>
              )}
              {commError && (
                <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 rounded px-2 py-1.5">
                  <AlertCircleIcon size={12} />
                  {commError}
                </div>
              )}
              {commentary?.articles?.length > 0 && !commLoading && (
                <div className="space-y-1.5">
                  {commentary.articles.slice(0, 5).map((a, i) => (
                    <div key={i} className="text-[10px] border border-kuda-border rounded p-2 bg-kuda-navy">
                      <p className="text-slate-300 font-medium leading-snug">{a.title}</p>
                      <p className="text-slate-600 mt-0.5">{a.source}</p>
                    </div>
                  ))}
                  <p className="text-[10px] text-slate-600 flex items-center gap-1">
                    <CheckCircleIcon size={10} className="text-kuda-teal" />
                    {commentary.articles.length} articles included in email
                  </p>
                </div>
              )}
              {commentary?.articles?.length === 0 && !commLoading && (
                <p className="text-[10px] text-slate-500">
                  No ZAR articles found — news sources may be temporarily unavailable.
                </p>
              )}
            </div>

            {/* Open Firm Orders per entity */}
            {selectedClients.length > 0 && (
              <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-2">
                  Open Firm Orders
                </p>
                <p className="text-[10px] text-slate-600 mb-2">
                  Enter pending/limit orders for each entity. These appear in the email as-is.
                </p>
                <div className="space-y-3">
                  {selectedClients.map(c => (
                    <div key={c.name}>
                      <p className="text-[10px] text-slate-400 font-medium mb-1">{c.name}</p>
                      <textarea
                        rows={3}
                        placeholder={`e.g.\nEURZAR 50 000 @ R19.60\nUSDZAR 100 000 @ R16.50\n(or "None")`}
                        value={openOrders[c.name] || ''}
                        onChange={e => setOpenOrders(prev => ({ ...prev, [c.name]: e.target.value }))}
                        className="w-full bg-kuda-navy border border-kuda-border rounded-lg px-3 py-2
                                   text-xs text-white placeholder-slate-600 focus:outline-none
                                   focus:border-kuda-teal resize-none font-mono"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>

          {/* ── RIGHT: Preview ─────────────────────────────────── */}
          <div className="lg:col-span-2 flex flex-col">
            {/* Tab bar */}
            <div className="flex items-center gap-1 px-5 pt-4 border-b border-kuda-border">
              {[['preview', 'Email Preview'], ['html', 'HTML Source']].map(([id, label]) => (
                <button key={id} onClick={() => setTab(id)}
                  className={`text-xs px-3 py-1.5 rounded-t-lg border-b-2 transition-all ${
                    tab === id ? 'border-kuda-teal text-white font-medium' : 'border-transparent text-slate-500 hover:text-slate-300'
                  }`}
                >{label}</button>
              ))}
            </div>

            <div className="flex-1 p-5">
              {tab === 'preview' && (
                <iframe
                  srcDoc={html}
                  title="Email Preview"
                  className="w-full rounded-xl border border-kuda-border"
                  style={{ height: '62vh', background: '#fff' }}
                  sandbox="allow-same-origin"
                />
              )}
              {tab === 'html' && (
                <textarea readOnly value={html}
                  className="w-full h-full min-h-[50vh] bg-kuda-navy border border-kuda-border rounded-xl
                             px-4 py-3 text-xs text-slate-300 font-mono resize-none focus:outline-none"
                />
              )}
            </div>

            {/* Footer actions */}
            <div className="px-5 py-4 border-t border-kuda-border flex flex-wrap items-center justify-between gap-3">
              <p className="text-[10px] text-slate-600 max-w-xs">
                Copy HTML then paste into Outlook using <strong>Ctrl+Shift+V</strong> (Paste Special → HTML) to preserve formatting.
              </p>
              <div className="flex items-center gap-2">
                <button onClick={onClose} className="btn-ghost text-xs py-1.5 px-4">Cancel</button>
                <button onClick={copyHtml}
                  className="btn-primary text-xs py-1.5 px-4 flex items-center gap-2"
                  disabled={!selectedClients.length}
                >
                  {copied ? <CheckIcon size={13} /> : <CopyIcon size={13} />}
                  {copied ? 'Copied!' : 'Copy HTML'}
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
