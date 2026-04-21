import React, { useState, useRef } from 'react'
import { XIcon, CopyIcon, CheckIcon, MailIcon, ChevronDownIcon } from 'lucide-react'
import { zarM, usdM, rate } from '../utils/formatters'

/** Format a date string nicely for the email */
function fmtDate(s) {
  if (!s) return '—'
  const d = new Date(s)
  return d.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' })
}

/** Format a number with thousands comma */
function fmtNum(n) {
  if (!n) return '0'
  return Math.round(n).toLocaleString('en-ZA')
}

/** Generate the HTML email body */
function buildEmailHtml({ client, commentary, spot, senderName, mtmDate }) {
  const trades = client.trades.filter(t =>
    ['FORWARD','DRAWDOWN','EXTENSION','Vanilla','Forward Enhancer'].includes(t.product_type)
    && t.days_to_maturity !== null && t.days_to_maturity >= 0
  )

  // Group by import/export for better readability
  const imports = trades.filter(t => t.import_export?.toLowerCase() === 'import')
  const exports = trades.filter(t => t.import_export?.toLowerCase() === 'export')
  const other   = trades.filter(t => !['import','export'].includes(t.import_export?.toLowerCase()))
  const groups  = [
    ...(imports.length ? [{ label: 'IMPORT BOOK', rows: imports }] : []),
    ...(exports.length ? [{ label: 'EXPORT BOOK', rows: exports }] : []),
    ...(other.length   ? [{ label: 'OPEN CONTRACTS', rows: other }]  : []),
  ]
  if (!groups.length) groups.push({ label: 'OPEN CONTRACTS', rows: trades })

  const mtmColor = client.net_mtm_zar >= 0 ? '#00856a' : '#c0392b'

  const tradeTable = (rows) => `
    <table width="100%" cellpadding="0" cellspacing="0" border="0"
           style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:11px;">
      <thead>
        <tr style="background:#f0f4f8;">
          <th style="padding:6px 8px;text-align:left;border-bottom:2px solid #cbd5e1;color:#475569;">Type</th>
          <th style="padding:6px 8px;text-align:left;border-bottom:2px solid #cbd5e1;color:#475569;">Currency</th>
          <th style="padding:6px 8px;text-align:left;border-bottom:2px solid #cbd5e1;color:#475569;">Dir.</th>
          <th style="padding:6px 8px;text-align:right;border-bottom:2px solid #cbd5e1;color:#475569;">Notional</th>
          <th style="padding:6px 8px;text-align:right;border-bottom:2px solid #cbd5e1;color:#475569;">Deal Rate</th>
          <th style="padding:6px 8px;text-align:right;border-bottom:2px solid #cbd5e1;color:#475569;">Maturity</th>
          <th style="padding:6px 8px;text-align:right;border-bottom:2px solid #cbd5e1;color:#475569;">MTM (ZAR)</th>
          <th style="padding:6px 8px;text-align:right;border-bottom:2px solid #cbd5e1;color:#475569;">Days</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map((t, i) => {
          const bg = i % 2 === 0 ? '#ffffff' : '#f8fafc'
          const mtm = t.mtm_zar >= 0
            ? `<span style="color:#00856a;">+${fmtNum(t.mtm_zar)}</span>`
            : `<span style="color:#c0392b;">(${fmtNum(Math.abs(t.mtm_zar))})</span>`
          const urgency =
            t.days_to_maturity !== null && t.days_to_maturity <= 7  ? 'color:#c0392b;font-weight:bold;' :
            t.days_to_maturity !== null && t.days_to_maturity <= 14 ? 'color:#d97706;' : ''
          return `
          <tr style="background:${bg};">
            <td style="padding:5px 8px;border-bottom:1px solid #e2e8f0;">${t.product_type}</td>
            <td style="padding:5px 8px;border-bottom:1px solid #e2e8f0;font-weight:bold;">${t.ccy_pair}</td>
            <td style="padding:5px 8px;border-bottom:1px solid #e2e8f0;">${t.direction_client}</td>
            <td style="padding:5px 8px;border-bottom:1px solid #e2e8f0;text-align:right;">${fmtNum(t.notional_fcy)}</td>
            <td style="padding:5px 8px;border-bottom:1px solid #e2e8f0;text-align:right;font-family:monospace;">${t.deal_rate.toFixed(4)}</td>
            <td style="padding:5px 8px;border-bottom:1px solid #e2e8f0;text-align:right;${urgency}">${fmtDate(t.maturity_date)}</td>
            <td style="padding:5px 8px;border-bottom:1px solid #e2e8f0;text-align:right;">${mtm}</td>
            <td style="padding:5px 8px;border-bottom:1px solid #e2e8f0;text-align:right;${urgency}">${t.days_to_maturity ?? '—'}</td>
          </tr>`
        }).join('')}
      </tbody>
    </table>`

  const upcomingSection = [
    { label: '7 days',   d: client.upcoming_7d },
    { label: '14 days',  d: client.upcoming_14d },
    { label: '1 month',  d: client.upcoming_30d },
    { label: '3 months', d: client.upcoming_90d },
  ].filter(h => h.d.count > 0).map(h =>
    `<td style="padding:8px 16px;text-align:center;border-right:1px solid #e2e8f0;">
       <div style="font-size:10px;color:#64748b;margin-bottom:2px;">${h.label}</div>
       <div style="font-size:15px;font-weight:bold;color:#1e293b;">${h.d.count}</div>
       <div style="font-size:10px;color:#475569;">contract${h.d.count !== 1 ? 's' : ''}</div>
       <div style="font-size:11px;color:#64748b;">${usdM(h.d.nominal_usd)}</div>
     </td>`
  ).join('')

  const commentaryHtml = commentary ? `
    <tr><td colspan="2" style="padding:0 0 24px;">
      <div style="background:#f0f9ff;border-left:4px solid #0284c7;padding:14px 16px;border-radius:4px;">
        <p style="margin:0 0 6px;font-size:11px;font-weight:bold;color:#0369a1;text-transform:uppercase;letter-spacing:0.05em;">
          Market Commentary · ${fmtDate(mtmDate || new Date().toISOString())}
        </p>
        <p style="margin:0;font-size:12px;color:#334155;line-height:1.6;">${commentary.replace(/\n/g, '<br/>')}</p>
      </div>
    </td></tr>` : ''

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width"/></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f1f5f9;padding:24px 0;">
<tr><td align="center">
<table width="640" cellpadding="0" cellspacing="0" border="0"
       style="max-width:640px;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">

  <!-- Header -->
  <tr><td style="background:#0B1E3D;padding:20px 28px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td>
          <div style="color:#00C896;font-size:20px;font-weight:bold;letter-spacing:0.02em;">CBC Kuda FX</div>
          <div style="color:#94a3b8;font-size:11px;margin-top:2px;">Authorised Financial Services Provider · FSP 46310</div>
        </td>
        <td align="right" style="color:#64748b;font-size:11px;">
          ${fmtDate(mtmDate || new Date().toISOString())}${spot ? `<br/>USD/ZAR ${rate(spot)}` : ''}
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- Body -->
  <tr><td style="padding:28px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0">

      <!-- Greeting -->
      <tr><td style="padding:0 0 20px;">
        <p style="margin:0 0 10px;font-size:14px;color:#1e293b;">Good day,</p>
        <p style="margin:0;font-size:13px;color:#475569;line-height:1.6;">
          Please find your FX position update for <strong>${client.name}</strong> below.
          ${spot ? `USD/ZAR is currently trading at <strong>${rate(spot)}</strong>.` : ''}
        </p>
      </td></tr>

      ${commentaryHtml}

      <!-- Position Summary -->
      <tr><td style="padding:0 0 20px;">
        <p style="margin:0 0 10px;font-size:12px;font-weight:bold;color:#1e293b;text-transform:uppercase;letter-spacing:0.05em;">Position Summary</p>
        <table width="100%" cellpadding="0" cellspacing="0" border="0"
               style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;">
          <tr>
            <td style="padding:12px 16px;border-right:1px solid #e2e8f0;text-align:center;">
              <div style="font-size:10px;color:#64748b;margin-bottom:4px;">OPEN CONTRACTS</div>
              <div style="font-size:22px;font-weight:bold;color:#1e293b;">${client.trade_count}</div>
            </td>
            <td style="padding:12px 16px;border-right:1px solid #e2e8f0;text-align:center;">
              <div style="font-size:10px;color:#64748b;margin-bottom:4px;">GROSS NOMINAL</div>
              <div style="font-size:22px;font-weight:bold;color:#1e293b;">${usdM(client.long_nominal_usd)}</div>
            </td>
            <td style="padding:12px 16px;text-align:center;">
              <div style="font-size:10px;color:#64748b;margin-bottom:4px;">MARK-TO-MARKET</div>
              <div style="font-size:22px;font-weight:bold;color:${mtmColor};">${zarM(client.net_mtm_zar)}</div>
            </td>
          </tr>
        </table>
      </td></tr>

      <!-- Upcoming maturities -->
      ${upcomingSection ? `
      <tr><td style="padding:0 0 20px;">
        <p style="margin:0 0 10px;font-size:12px;font-weight:bold;color:#1e293b;text-transform:uppercase;letter-spacing:0.05em;">Upcoming Maturities</p>
        <table width="100%" cellpadding="0" cellspacing="0" border="0"
               style="background:#fff7ed;border:1px solid #fed7aa;border-radius:6px;">
          <tr>${upcomingSection}</tr>
        </table>
      </td></tr>` : ''}

      <!-- Trade tables per group -->
      ${groups.map(g => `
      <tr><td style="padding:0 0 20px;">
        <p style="margin:0 0 8px;font-size:12px;font-weight:bold;color:#1e293b;text-transform:uppercase;letter-spacing:0.05em;">${g.label}</p>
        ${tradeTable(g.rows)}
      </td></tr>`).join('')}

      <!-- Sign-off -->
      <tr><td style="padding:8px 0 0;border-top:1px solid #e2e8f0;">
        <p style="margin:16px 0 4px;font-size:13px;color:#475569;">Vriendelike groete / Kind regards,</p>
        <p style="margin:0;font-size:13px;color:#1e293b;font-weight:bold;">${senderName || 'CBC Kuda FX Dealing Desk'}</p>
        <p style="margin:2px 0 0;font-size:11px;color:#64748b;">CBC Kuda Foreign Exchange (Pty) Ltd</p>
      </td></tr>

    </table>
  </td></tr>

  <!-- Footer -->
  <tr><td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:14px 28px;text-align:center;">
    <p style="margin:0;font-size:10px;color:#94a3b8;">
      CBC Kuda Foreign Exchange (Pty) Ltd · FSP 46310 · <a href="https://kuda.co.za/fx/" style="color:#00856a;">kuda.co.za/fx</a>
    </p>
    <p style="margin:4px 0 0;font-size:10px;color:#94a3b8;">
      This email and any attachments are confidential and intended solely for the use of the named addressee.
    </p>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`
}

export default function EmailComposer({ client, meta, onClose }) {
  const [commentary, setCommentary] = useState('')
  const [senderName, setSenderName] = useState('')
  const [copied, setCopied]         = useState(false)
  const [tab, setTab]               = useState('preview') // 'preview' | 'html' | 'compose'
  const iframeRef = useRef()

  const html = buildEmailHtml({
    client,
    commentary,
    spot:       meta?.spot_usd_zar,
    senderName,
    mtmDate:    meta?.mtm_date,
  })

  const copyHtml = async () => {
    await navigator.clipboard.writeText(html)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-start justify-center overflow-y-auto py-8 px-4">
      <div className="w-full max-w-4xl bg-kuda-navylt rounded-2xl border border-kuda-border shadow-2xl">

        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-kuda-border">
          <div className="flex items-center gap-3">
            <MailIcon size={16} className="text-kuda-teal" />
            <div>
              <p className="text-sm font-semibold text-white">Generate Client Mailer</p>
              <p className="text-xs text-slate-400">{client.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost p-1.5">
            <XIcon size={16} />
          </button>
        </div>

        {/* Compose settings */}
        <div className="px-6 py-4 border-b border-kuda-border grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] text-slate-500 uppercase tracking-widest mb-1">
              Sender name (appears in sign-off)
            </label>
            <input
              type="text"
              placeholder="e.g. Stian van Zyl"
              value={senderName}
              onChange={e => setSenderName(e.target.value)}
              className="w-full bg-kuda-navy border border-kuda-border rounded-lg px-3 py-2 text-sm text-white
                         placeholder-slate-600 focus:outline-none focus:border-kuda-teal"
            />
          </div>
          <div className="md:col-span-1">
            <label className="block text-[10px] text-slate-500 uppercase tracking-widest mb-1">
              Market commentary (paste from Umkhulu daily report)
            </label>
            <textarea
              rows={3}
              placeholder="Paste Adam's commentary here — it will appear at the top of the email as market context..."
              value={commentary}
              onChange={e => setCommentary(e.target.value)}
              className="w-full bg-kuda-navy border border-kuda-border rounded-lg px-3 py-2 text-sm text-white
                         placeholder-slate-600 focus:outline-none focus:border-kuda-teal resize-none"
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 px-6 pt-4 pb-0">
          {[['preview', 'Email Preview'], ['html', 'HTML Source']].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`text-xs px-3 py-1.5 rounded-t-lg border-b-2 transition-all ${
                tab === id
                  ? 'border-kuda-teal text-white font-medium'
                  : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="px-6 pb-6">
          {tab === 'preview' && (
            <iframe
              ref={iframeRef}
              srcDoc={html}
              title="Email Preview"
              className="w-full rounded-xl border border-kuda-border"
              style={{ height: '520px', background: '#fff' }}
              sandbox="allow-same-origin"
            />
          )}

          {tab === 'html' && (
            <textarea
              readOnly
              value={html}
              className="w-full h-96 bg-kuda-navy border border-kuda-border rounded-xl px-4 py-3
                         text-xs text-slate-300 font-mono resize-none focus:outline-none"
            />
          )}
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 border-t border-kuda-border flex flex-wrap items-center justify-between gap-3">
          <p className="text-[10px] text-slate-600 max-w-xs">
            Copy the HTML and paste into Outlook using Ctrl+Shift+V (paste special → HTML) to preserve formatting.
          </p>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="btn-ghost text-xs py-1.5 px-4">
              Cancel
            </button>
            <button
              onClick={copyHtml}
              className="btn-primary text-xs py-1.5 px-4 flex items-center gap-2"
            >
              {copied ? <CheckIcon size={13} /> : <CopyIcon size={13} />}
              {copied ? 'Copied!' : 'Copy HTML'}
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
