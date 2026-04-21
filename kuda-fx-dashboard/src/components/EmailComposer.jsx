import React, { useState, useEffect, useRef } from 'react'
import {
  XIcon, CopyIcon, CheckIcon, MailIcon, RefreshCwIcon,
  LoaderIcon, AlertCircleIcon, CheckCircleIcon, ExternalLinkIcon,
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
  // ── Kuda Brand Palette ────────────────────────────────────────────────────
  const KUDA_TEAL   = '#195A7D'   // Kuda Teal P 7700 C — header / structure
  const KUDA_GREEN  = '#6BA439'   // Kuda Green P 7737 C — positive / accent
  const KUDA_OLIVE  = '#49762E'   // Kuda Olive P 364 C
  const KUDA_NAVY   = '#243746'   // Kuda Navy P 7546 C
  const KUDA_SKY    = '#BADCE6'   // Kuda Sky Blue P 7457 C
  const RED         = '#B91C1C'   // danger red (accessible on white)
  const AMBER       = '#B45309'   // warning amber
  const WHT         = '#ffffff'
  const TXT_DARK    = '#1e293b'   // body text
  const TXT_MID     = '#475569'   // secondary text
  const TXT_LIGHT   = '#94a3b8'   // muted text
  const BG_LIGHT    = '#f8fafc'   // alternating row
  const BRD_LIGHT   = '#e2e8f0'   // light border

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

  // ── Outlook-safe helpers ──────────────────────────────────────────────────
  // NOTE: Every <td> with a bg color must carry BOTH bgcolor="" attr AND style="background-color:"
  // Text colors must be on the direct container, not a parent div.

  const nomFmt = (n) => {
    const abs = Math.abs(n || 0)
    if (abs >= 1e6) return `$${(abs/1e6).toFixed(2)}M`
    if (abs >= 1e3) return `$${(abs/1e3).toFixed(0)}K`
    return `$${Math.round(abs)}`
  }

  const mtmFmt = (n) => {
    if (n == null) return '—'
    const abs = Math.abs(n)
    const sign = n >= 0 ? '+' : '-'
    const col  = n >= 0 ? KUDA_GREEN : RED
    const s = abs >= 1e6 ? `${sign}R${(abs/1e6).toFixed(2)}M` : abs >= 1e3 ? `${sign}R${(abs/1e3).toFixed(0)}K` : `${sign}R${Math.round(abs)}`
    // Use <font> tag — most reliable across Outlook versions
    return `<font color="${col}"><b>${s}</b></font>`
  }

  // Section heading: uses a Kuda Teal left-border bar (table-cell trick, not CSS border-left which Outlook strips)
  const sectionTitle = (title) => `
    <tr>
      <td colspan="99" style="padding:22px 0 8px 0;" bgcolor="#ffffff">
        <table cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td width="4" style="background-color:${KUDA_GREEN};font-size:1px;line-height:1px;" bgcolor="${KUDA_GREEN}">&nbsp;</td>
            <td style="padding:6px 0 6px 10px;background-color:#ffffff;" bgcolor="#ffffff">
              <font color="${TXT_DARK}"><b style="font-size:12px;text-transform:uppercase;letter-spacing:0.06em;">${title}</b></font>
            </td>
          </tr>
        </table>
      </td>
    </tr>`

  // ── Trade table ───────────────────────────────────────────────────────────
  const tradeTable = (rows, showEntity = false) => {
    if (!rows.length) return `<p style="color:${TXT_LIGHT};font-size:12px;padding:8px 0;">No open contracts in this category.</p>`
    const headers = [
      ...(showEntity ? ['Entity'] : []),
      'Type','Currency','Dir.','Notional','Deal Rate','Trade Date','Maturity','Days','MTM (ZAR)'
    ]
    const RIGHT_COLS = new Set(['Notional','Deal Rate','Days','MTM (ZAR)'])
    const thStyle = `padding:7px 8px;font-size:10px;font-weight:bold;text-transform:uppercase;letter-spacing:0.04em;border-bottom:2px solid ${KUDA_TEAL};background-color:${KUDA_NAVY};color:${KUDA_SKY};`
    const tdS = `padding:5px 8px;border-bottom:1px solid ${BRD_LIGHT};font-size:11px;font-family:Arial,sans-serif;`

    return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
      <thead><tr bgcolor="${KUDA_NAVY}">
        ${headers.map(h => `<th align="${RIGHT_COLS.has(h)?'right':'left'}" style="${thStyle}color:${KUDA_SKY};"><font color="${KUDA_SKY}">${h}</font></th>`).join('')}
      </tr></thead>
      <tbody>
        ${rows.map((t,i) => {
          const bg  = i%2===0 ? '#ffffff' : BG_LIGHT
          const urgCol = t.days_to_maturity<=7 ? RED : t.days_to_maturity<=14 ? AMBER : TXT_DARK
          return `<tr bgcolor="${bg}">
            ${showEntity ? `<td style="${tdS}" bgcolor="${bg}"><font color="${TXT_DARK}"><b>${t.entity}</b></font></td>` : ''}
            <td style="${tdS}" bgcolor="${bg}">
              <font color="${KUDA_TEAL}"><b style="font-size:9px;text-transform:uppercase;">${t.product_type}</b></font>
            </td>
            <td style="${tdS}" bgcolor="${bg}"><font color="${TXT_DARK}"><b>${t.ccy_pair}</b></font></td>
            <td style="${tdS}" bgcolor="${bg}"><font color="${TXT_MID}">${t.direction_client}</font></td>
            <td align="right" style="${tdS}font-family:Courier New,monospace;" bgcolor="${bg}"><font color="${TXT_DARK}">${fmtNum(t.notional_fcy)}</font></td>
            <td align="right" style="${tdS}font-family:Courier New,monospace;" bgcolor="${bg}"><font color="${TXT_DARK}">${fmtRate(t.deal_rate)}</font></td>
            <td style="${tdS}" bgcolor="${bg}"><font color="${TXT_LIGHT}">${fmtDate(t.trade_date)}</font></td>
            <td align="right" style="${tdS}font-family:Courier New,monospace;" bgcolor="${bg}"><font color="${urgCol}"><b>${fmtDate(t.maturity_date)}</b></font></td>
            <td align="right" style="${tdS}" bgcolor="${bg}"><font color="${urgCol}"><b>${t.days_to_maturity ?? '—'}</b></font></td>
            <td align="right" style="${tdS}" bgcolor="${bg}">${mtmFmt(t.mtm_zar)}</td>
          </tr>`
        }).join('')}
        <tr bgcolor="#EEF7E6">
          <td colspan="${headers.length - 1}" style="padding:7px 8px;font-size:11px;font-weight:bold;" bgcolor="#EEF7E6">
            <font color="${KUDA_OLIVE}"><b>TOTAL</b></font>
          </td>
          <td align="right" style="padding:7px 8px;font-size:11px;" bgcolor="#EEF7E6">
            ${mtmFmt(rows.reduce((s,t)=>s+(t.mtm_zar||0),0))}
          </td>
        </tr>
      </tbody>
    </table>`
  }

  // ── Commentary ────────────────────────────────────────────────────────────
  const commentaryHtml = commentary?.articles?.length ? `
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      ${sectionTitle('ZAR Market Update')}
      <tr><td style="padding:0 0 20px 0;" bgcolor="#ffffff">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${KUDA_SKY};">
          ${commentary.articles.slice(0, 5).map((a,i) => {
            const bg = i%2===0 ? '#F0F7FB' : '#ffffff'
            return `<tr bgcolor="${bg}"><td style="padding:10px 14px;border-bottom:1px solid ${KUDA_SKY};" bgcolor="${bg}">
              <p style="margin:0 0 3px;font-size:12px;">
                ${a.link
                  ? `<a href="${a.link}" style="color:${KUDA_TEAL};text-decoration:none;font-weight:bold;">${a.title}</a>`
                  : `<font color="${KUDA_TEAL}"><b>${a.title}</b></font>`}
              </p>
              ${a.summary ? `<p style="margin:0 0 4px;font-size:11px;color:${TXT_MID};line-height:1.5;"><font color="${TXT_MID}">${a.summary.slice(0,240)}${a.summary.length>240?'…':''}</font></p>` : ''}
              <p style="margin:0;font-size:9px;"><font color="${TXT_LIGHT}">${a.source}${a.pub ? ' · ' + new Date(a.pub).toLocaleDateString('en-ZA',{day:'2-digit',month:'short',year:'numeric'}) : ''}</font></p>
            </td></tr>`
          }).join('')}
        </table>
        <p style="margin:5px 0 0;font-size:9px;"><font color="${TXT_LIGHT}">Market news sourced from public feeds. Not financial advice.</font></p>
      </td></tr>
    </table>` : ''

  // ── Per-entity sections ───────────────────────────────────────────────────
  const entitySections = clients.map(client => {
    const clientTrades = activeTrades.filter(t => t.entity === client.name)
    const imports = clientTrades.filter(t => t.import_export?.toLowerCase() === 'import')
    const exports = clientTrades.filter(t => t.import_export?.toLowerCase() === 'export')
    const other   = clientTrades.filter(t => !['import','export'].includes(t.import_export?.toLowerCase()))
    const groups  = [
      ...(imports.length || !exports.length ? [{ label: `${client.name} — Import Book`, rows: imports.length ? imports : other }] : []),
      ...(exports.length ? [{ label: `${client.name} — Export Book`, rows: exports }] : []),
    ]
    const clientOrders = openOrders[client.name] || ''
    const mtmColor = client.net_mtm_zar >= 0 ? KUDA_GREEN : RED

    return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:8px;">
      <!-- Entity header bar -->
      <tr><td colspan="99" style="padding:16px 0 4px;" bgcolor="#ffffff">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr bgcolor="${KUDA_TEAL}">
            <td style="padding:10px 16px;background-color:${KUDA_TEAL};" bgcolor="${KUDA_TEAL}">
              <font color="${WHT}"><b style="font-size:14px;">${client.name}</b></font>
            </td>
            <td align="right" style="padding:10px 16px;background-color:${KUDA_TEAL};" bgcolor="${KUDA_TEAL}">
              <font color="${KUDA_SKY}" style="font-size:11px;">${client.trade_count} contracts &nbsp;·&nbsp; Long: ${nomFmt(client.long_nominal_usd)} &nbsp;·&nbsp; MTM: </font><font color="${mtmColor}"><b>${client.net_mtm_zar >= 0 ? '+' : ''}${nomFmt(Math.abs(client.net_mtm_zar))}</b></font>
            </td>
          </tr>
        </table>
      </td></tr>

      ${groups.map(g => `
        ${sectionTitle(g.label)}
        <tr><td colspan="99" style="padding:0 0 16px 0;" bgcolor="#ffffff">${tradeTable(g.rows)}</td></tr>
      `).join('')}

      ${clientOrders ? `
        ${sectionTitle(`Open Firm Orders — ${client.name}`)}
        <tr><td colspan="99" style="padding:0 0 16px 0;" bgcolor="#ffffff">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #FDE68A;">
            <tr bgcolor="#FFFBEB"><td style="padding:12px 16px;background-color:#FFFBEB;" bgcolor="#FFFBEB">
              <pre style="margin:0;font-size:12px;font-family:Courier New,monospace;white-space:pre-wrap;"><font color="#78350F">${clientOrders}</font></pre>
            </td></tr>
          </table>
        </td></tr>` : ''}
    </table>`
  }).join('')

  // ── Upcoming contracts ────────────────────────────────────────────────────
  const upcomingHtml = upcoming90.length ? `
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      ${sectionTitle('Upcoming Contracts — Next 90 Days')}
      <tr><td style="padding:0 0 20px 0;" bgcolor="#ffffff">
        ${tradeTable(upcoming90, clients.length > 1)}
      </td></tr>
    </table>` : ''

  // ── Cash flow schedule ────────────────────────────────────────────────────
  const thCF = `padding:7px 8px;font-size:10px;font-weight:bold;text-transform:uppercase;letter-spacing:0.04em;border-bottom:2px solid ${KUDA_TEAL};background-color:${KUDA_NAVY};color:${KUDA_SKY};`
  const cfHtml = cashFlows.length ? `
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      ${sectionTitle('Upcoming Cash Flow Schedule')}
      <tr><td style="padding:0 0 20px 0;" bgcolor="#ffffff">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
          <thead><tr bgcolor="${KUDA_NAVY}">
            <th align="left"  style="${thCF}"><font color="${KUDA_SKY}">Month</font></th>
            <th align="right" style="${thCF}"><font color="${KUDA_SKY}">Contracts</font></th>
            <th align="right" style="${thCF}"><font color="${KUDA_SKY}">USD Nominal</font></th>
            <th align="right" style="${thCF}"><font color="${KUDA_SKY}">ZAR Equivalent</font></th>
          </tr></thead>
          <tbody>
            ${cashFlows.map((cf,i) => {
              const bg = i%2===0 ? '#ffffff' : BG_LIGHT
              const zarEq = spot ? cf.nominal * spot : null
              return `<tr bgcolor="${bg}">
                <td style="padding:6px 8px;border-bottom:1px solid ${BRD_LIGHT};font-weight:bold;font-size:12px;" bgcolor="${bg}"><font color="${TXT_DARK}"><b>${cf.label}</b></font></td>
                <td align="right" style="padding:6px 8px;border-bottom:1px solid ${BRD_LIGHT};font-size:11px;" bgcolor="${bg}"><font color="${TXT_DARK}">${cf.trades.length}</font></td>
                <td align="right" style="padding:6px 8px;border-bottom:1px solid ${BRD_LIGHT};font-size:11px;font-family:Courier New,monospace;" bgcolor="${bg}"><font color="${TXT_DARK}">${nomFmt(cf.nominal)}</font></td>
                <td align="right" style="padding:6px 8px;border-bottom:1px solid ${BRD_LIGHT};font-size:11px;font-family:Courier New,monospace;" bgcolor="${bg}"><font color="${TXT_DARK}">${zarEq ? `R${Math.round(zarEq).toLocaleString('en-ZA')}` : '—'}</font></td>
              </tr>`
            }).join('')}
          </tbody>
        </table>
      </td></tr>
    </table>` : ''

  // ── Facility summary ──────────────────────────────────────────────────────
  const utilCol = !utilPct ? TXT_DARK : utilPct > 90 ? RED : utilPct > 75 ? AMBER : KUDA_GREEN
  const facilityHtml = dealingCap ? `
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      ${sectionTitle('Facility Summary')}
      <tr><td style="padding:0 0 20px 0;" bgcolor="#ffffff">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${BRD_LIGHT};">
          <tr>
            <td align="center" style="padding:14px 16px;border-right:1px solid ${BRD_LIGHT};background-color:#F8FAFC;" bgcolor="#F8FAFC">
              <p style="margin:0 0 5px;font-size:10px;text-transform:uppercase;letter-spacing:0.05em;"><font color="${TXT_LIGHT}">Open Nominal</font></p>
              <p style="margin:0;font-size:20px;font-weight:bold;"><font color="${KUDA_TEAL}"><b>${nomFmt(totalNominal)}</b></font></p>
            </td>
            <td align="center" style="padding:14px 16px;border-right:1px solid ${BRD_LIGHT};background-color:#F8FAFC;" bgcolor="#F8FAFC">
              <p style="margin:0 0 5px;font-size:10px;text-transform:uppercase;letter-spacing:0.05em;"><font color="${TXT_LIGHT}">Dealing Cap</font></p>
              <p style="margin:0;font-size:20px;font-weight:bold;"><font color="${TXT_DARK}"><b>${nomFmt(dealingCap)}</b></font></p>
            </td>
            <td align="center" style="padding:14px 16px;border-right:1px solid ${BRD_LIGHT};background-color:#F8FAFC;" bgcolor="#F8FAFC">
              <p style="margin:0 0 5px;font-size:10px;text-transform:uppercase;letter-spacing:0.05em;"><font color="${TXT_LIGHT}">Utilisation</font></p>
              <p style="margin:0;font-size:20px;font-weight:bold;"><font color="${utilCol}"><b>${utilPct ?? '—'}%</b></font></p>
            </td>
            <td align="center" style="padding:14px 16px;background-color:#F8FAFC;" bgcolor="#F8FAFC">
              <p style="margin:0 0 5px;font-size:10px;text-transform:uppercase;letter-spacing:0.05em;"><font color="${TXT_LIGHT}">Headroom</font></p>
              <p style="margin:0;font-size:20px;font-weight:bold;"><font color="${KUDA_GREEN}"><b>${nomFmt(dealingCap - totalNominal)}</b></font></p>
            </td>
          </tr>
        </table>
      </td></tr>
    </table>` : ''

  // ── Build final HTML ──────────────────────────────────────────────────────
  const clientNames = clients.map(c => c.name).join(' & ')
  const weekStr     = new Date().toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' })

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Kuda FX Weekly Update</title>
</head>
<body style="margin:0;padding:0;background-color:#F1F5F9;font-family:Arial,Helvetica,sans-serif;" bgcolor="#F1F5F9">

<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#F1F5F9" style="background-color:#F1F5F9;padding:24px 0;">
<tr><td align="center">

<table width="680" cellpadding="0" cellspacing="0" border="0" style="max-width:680px;background-color:#ffffff;" bgcolor="#ffffff">

  <!-- ═══ HEADER ═══ -->
  <tr bgcolor="${KUDA_TEAL}">
    <td style="background-color:${KUDA_TEAL};padding:0;" bgcolor="${KUDA_TEAL}">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <!-- Kuda Green accent stripe -->
          <td width="6" style="background-color:${KUDA_GREEN};font-size:1px;line-height:1px;" bgcolor="${KUDA_GREEN}">&nbsp;</td>
          <td style="padding:18px 24px;background-color:${KUDA_TEAL};" bgcolor="${KUDA_TEAL}">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td>
                  <p style="margin:0;font-size:24px;font-weight:bold;letter-spacing:0.08em;font-family:Arial,Helvetica,sans-serif;">
                    <font color="${WHT}">KUDA </font><font color="${KUDA_SKY}" style="font-size:13px;font-weight:normal;letter-spacing:0.14em;">FOREIGN EXCHANGE</font>
                  </p>
                  <p style="margin:4px 0 0;font-size:10px;letter-spacing:0.06em;"><font color="${KUDA_SKY}">IN YOUR CORNER · FSP 46310</font></p>
                </td>
                <td align="right">
                  <p style="margin:0;font-size:11px;"><font color="${KUDA_SKY}">Weekly FX Position Update</font></p>
                  <p style="margin:3px 0 0;font-size:12px;font-weight:bold;"><font color="${WHT}">${weekStr}</font></p>
                  ${spot ? `<p style="margin:4px 0 0;font-size:11px;"><font color="${KUDA_SKY}">USD/ZAR <b><font color="${WHT}">${fmtRate(spot)}</font></b>${gbpZar ? ` &nbsp;·&nbsp; GBP/ZAR <b><font color="${WHT}">${fmtRate(gbpZar)}</font></b>` : ''}${eurZar ? ` &nbsp;·&nbsp; EUR/ZAR <b><font color="${WHT}">${fmtRate(eurZar)}</font></b>` : ''}</font></p>` : ''}
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- ═══ BODY ═══ -->
  <tr bgcolor="#ffffff"><td style="padding:28px 28px 8px;background-color:#ffffff;" bgcolor="#ffffff">

    <!-- Greeting -->
    <p style="margin:0 0 6px;font-size:15px;"><font color="${TXT_DARK}">Dear <b>${clientNames},</b></font></p>
    <p style="margin:0 0 22px;font-size:13px;line-height:1.6;"><font color="${TXT_MID}">Please find your weekly FX position update below, for the period ending <b><font color="${TXT_DARK}">${fmtDate(mtmDate || new Date().toISOString())}</font></b>.${spot ? ` USD/ZAR is currently trading at <b><font color="${KUDA_TEAL}">${fmtRate(spot)}</font></b>.` : ''}</font></p>

    <!-- Portfolio overview banner -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
      <tr bgcolor="${KUDA_NAVY}">
        <td align="center" style="padding:14px 10px;border-right:1px solid #2E4A5F;background-color:${KUDA_NAVY};" bgcolor="${KUDA_NAVY}">
          <p style="margin:0 0 4px;font-size:9px;text-transform:uppercase;letter-spacing:0.07em;"><font color="${KUDA_SKY}">Open Contracts</font></p>
          <p style="margin:0;font-size:22px;font-weight:bold;"><font color="${WHT}"><b>${totalTrades}</b></font></p>
        </td>
        <td align="center" style="padding:14px 10px;border-right:1px solid #2E4A5F;background-color:${KUDA_NAVY};" bgcolor="${KUDA_NAVY}">
          <p style="margin:0 0 4px;font-size:9px;text-transform:uppercase;letter-spacing:0.07em;"><font color="${KUDA_SKY}">Total Nominal</font></p>
          <p style="margin:0;font-size:22px;font-weight:bold;"><font color="${WHT}"><b>${nomFmt(totalNominal)}</b></font></p>
        </td>
        <td align="center" style="padding:14px 10px;border-right:1px solid #2E4A5F;background-color:${KUDA_NAVY};" bgcolor="${KUDA_NAVY}">
          <p style="margin:0 0 4px;font-size:9px;text-transform:uppercase;letter-spacing:0.07em;"><font color="${KUDA_SKY}">Mark-to-Market</font></p>
          <p style="margin:0;font-size:22px;font-weight:bold;">${mtmFmt(totalMtm)}</p>
        </td>
        <td align="center" style="padding:14px 10px;background-color:${KUDA_NAVY};" bgcolor="${KUDA_NAVY}">
          <p style="margin:0 0 4px;font-size:9px;text-transform:uppercase;letter-spacing:0.07em;"><font color="${KUDA_SKY}">Maturing &le;30 days</font></p>
          <p style="margin:0;font-size:22px;font-weight:bold;"><font color="${upcoming30.length > 0 ? '#FCD34D' : WHT}"><b>${upcoming30.length}</b></font></p>
        </td>
      </tr>
    </table>

    ${commentaryHtml}
    ${upcomingHtml}
    ${cfHtml}
    ${entitySections}
    ${facilityHtml}

    <!-- Sign-off -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;border-top:2px solid ${KUDA_GREEN};">
      <tr bgcolor="#ffffff"><td style="padding:18px 0 8px;background-color:#ffffff;" bgcolor="#ffffff">
        <p style="margin:0 0 4px;font-size:13px;"><font color="${TXT_MID}">Vriendelike groete / Kind regards,</font></p>
        <p style="margin:0 0 2px;font-size:14px;font-weight:bold;"><font color="${KUDA_TEAL}"><b>${senderName || 'CBC Kuda FX Dealing Desk'}</b></font></p>
        <p style="margin:0;font-size:11px;"><font color="${TXT_LIGHT}">CBC Kuda Foreign Exchange (Pty) Ltd &nbsp;·&nbsp; FSP 46310</font></p>
      </td></tr>
    </table>

  </td></tr>

  <!-- ═══ FOOTER ═══ -->
  <tr bgcolor="${KUDA_NAVY}">
    <td align="center" style="padding:14px 28px;background-color:${KUDA_NAVY};" bgcolor="${KUDA_NAVY}">
      <p style="margin:0 0 3px;font-size:10px;"><font color="${KUDA_SKY}">CBC Kuda Foreign Exchange (Pty) Ltd &nbsp;·&nbsp; FSP 46310</font></p>
      <p style="margin:0;font-size:9px;"><font color="#475569">This communication is confidential and intended solely for the named recipient. Market commentary is for informational purposes only and does not constitute financial advice.</font></p>
    </td>
  </tr>

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

  // Opens a standalone rendered version in a new tab.
  // User can then Ctrl+A → Ctrl+C → paste directly into Outlook / Gmail.
  const openInNewTab = () => {
    const blob = new Blob([html], { type: 'text/html' })
    const url  = URL.createObjectURL(blob)
    window.open(url, '_blank')
    // Revoke after a short delay to give the browser time to open it
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }

  return (
    <div className="fixed inset-0 bg-black/75 z-50 flex items-start justify-center overflow-y-auto py-6 px-3">
      <div className="w-full max-w-6xl bg-kuda-navylt rounded-2xl border border-kuda-border shadow-2xl">

        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-kuda-border">
          <div className="flex items-center gap-3">
            <MailIcon size={16} className="text-kuda-teal" />
            <div>
              <p className="text-sm font-semibold text-white">Kuda FX · Weekly Client Mailer</p>
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
            <div className="px-5 py-4 border-t border-kuda-border space-y-3">
              {/* Send instructions */}
              <div className="bg-kuda-navy rounded-lg border border-kuda-border px-4 py-3 space-y-1.5">
                <p className="text-[10px] font-semibold text-slate-300 uppercase tracking-widest">How to send</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-400">
                  <div className="flex items-start gap-2">
                    <span className="shrink-0 w-5 h-5 rounded-full bg-kuda-teal/20 text-kuda-teal text-[10px] font-bold flex items-center justify-center mt-0.5">1</span>
                    <span><strong className="text-slate-300">Outlook / Apple Mail:</strong> Click <em>Open in browser</em>, then Ctrl+A → Ctrl+C, and paste into a new email (Ctrl+V). Formatting is preserved automatically.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="shrink-0 w-5 h-5 rounded-full bg-slate-600/40 text-slate-400 text-[10px] font-bold flex items-center justify-center mt-0.5">2</span>
                    <span><strong className="text-slate-300">Gmail / Webmail:</strong> Use <em>Copy HTML</em>, then in Gmail compose click the three-dot menu → <em>Paste as HTML</em> (or use a browser extension like Stripo).</span>
                  </div>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex flex-wrap items-center justify-end gap-2">
                <button onClick={onClose} className="btn-ghost text-xs py-1.5 px-4">Close</button>
                <button
                  onClick={copyHtml}
                  disabled={!selectedClients.length}
                  className="btn-ghost text-xs py-1.5 px-4 flex items-center gap-2 border border-kuda-border"
                >
                  {copied ? <CheckIcon size={13} className="text-kuda-teal" /> : <CopyIcon size={13} />}
                  {copied ? 'Copied!' : 'Copy HTML'}
                </button>
                <button
                  onClick={openInNewTab}
                  disabled={!selectedClients.length}
                  className="btn-primary text-xs py-1.5 px-4 flex items-center gap-2"
                >
                  <ExternalLinkIcon size={13} />
                  Open in browser
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
