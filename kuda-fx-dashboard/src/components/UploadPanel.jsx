import React, { useState, useRef, useCallback } from 'react'
import { UploadCloudIcon, FileSpreadsheetIcon, AlertCircleIcon, LoaderIcon, PlusCircleIcon } from 'lucide-react'

const ACCEPTED = '.xlsx,.xls,.csv'

export default function UploadPanel({ onData }) {
  const [dragging,     setDragging]     = useState(false)
  const [file,         setFile]         = useState(null)
  const [summaryFile,  setSummaryFile]  = useState(null)
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState(null)
  const [spotRate,     setSpotRate]     = useState('')
  const [gbpUsd,       setGbpUsd]       = useState('')
  const [eurUsd,       setEurUsd]       = useState('')
  const [prevMtm,      setPrevMtm]      = useState('')
  const [prevRate,     setPrevRate]     = useState('')
  const inputRef        = useRef()
  const summaryInputRef = useRef()

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setDragging(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped) validateAndSet(dropped)
  }, [])

  const validateAndSet = (f) => {
    const ext = f.name.split('.').pop().toLowerCase()
    if (!['xlsx', 'xls', 'csv'].includes(ext)) {
      setError('Please upload the FXFlow Open Trades Excel (.xlsx) or Facility Upload CSV (.csv) file.')
      return
    }
    setFile(f)
    setError(null)
  }

  const handleSubmit = async () => {
    if (!file) { setError('Please select a file first.'); return }
    setLoading(true)
    setError(null)

    const form = new FormData()
    form.append('trades_file', file)
    if (summaryFile) form.append('facility_summary_file', summaryFile)
    if (spotRate) form.append('spot_usd_zar', spotRate)
    if (gbpUsd)   form.append('gbp_usd',      gbpUsd)
    if (eurUsd)   form.append('eur_usd',       eurUsd)
    if (prevMtm)  form.append('prev_mtm_zar',  prevMtm.replace(/,/g, ''))
    if (prevRate) form.append('prev_rate',     prevRate)

    try {
      const res  = await fetch('/api/process', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `Server error ${res.status}`)
      onData(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12 bg-kuda-navy">
      {/* Hero */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-kuda-teal/10 border border-kuda-teal/20 mb-4">
          <span className="text-kuda-teal font-bold text-2xl">K</span>
        </div>
        <h1 className="text-2xl font-semibold text-white">CBC Kuda FX · Risk Dashboard</h1>
        <p className="text-slate-400 text-sm mt-1">Facility FYN005836 · Investec Bank</p>
      </div>

      <div className="w-full max-w-2xl space-y-5">
        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`card cursor-pointer border-2 border-dashed transition-all text-center py-10
            ${dragging ? 'border-kuda-teal bg-kuda-teal/5' : 'border-kuda-border hover:border-slate-500'}`}
        >
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED}
            className="hidden"
            onChange={(e) => e.target.files[0] && validateAndSet(e.target.files[0])}
          />
          {file ? (
            <div className="flex flex-col items-center gap-3">
              <FileSpreadsheetIcon size={40} className="text-kuda-teal" />
              <div>
                <p className="font-medium text-white">{file.name}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {(file.size / 1024).toFixed(0)} KB · Click to change
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <UploadCloudIcon size={40} className="text-slate-500" />
              <div>
                <p className="font-medium text-white">Upload FXFlow Open Trades report</p>
                <p className="text-xs text-slate-400 mt-1">
                  Drag & drop or click · FXFlow Open Trades Excel (.xlsx) preferred · CSV also accepted
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Facility Summary file — optional but gives accurate nominal/PFE/rate */}
        <div
          className="card border border-kuda-teal/20 cursor-pointer hover:border-kuda-teal/50 transition-all"
          onClick={() => summaryInputRef.current?.click()}
        >
          <input
            ref={summaryInputRef}
            type="file"
            accept={ACCEPTED}
            className="hidden"
            onChange={(e) => e.target.files[0] && setSummaryFile(e.target.files[0])}
          />
          <div className="flex items-center gap-3">
            {summaryFile
              ? <FileSpreadsheetIcon size={20} className="text-kuda-teal shrink-0" />
              : <PlusCircleIcon size={20} className="text-slate-500 shrink-0" />
            }
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white">
                {summaryFile ? summaryFile.name : 'Add FXFlow Facility Summary (recommended)'}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                {summaryFile
                  ? 'Rates, nominal & PFE will be read directly from this file'
                  : 'Upload the "Facility Summary" report alongside the trades file for accurate nominal, PFE & USD/ZAR rate'}
              </p>
            </div>
            {summaryFile && (
              <button
                className="ml-auto text-xs text-slate-500 hover:text-red-400 shrink-0"
                onClick={(e) => { e.stopPropagation(); setSummaryFile(null) }}
              >✕</button>
            )}
          </div>
        </div>

        {/* Spot rate — shown only when no Facility Summary uploaded */}
        {!summaryFile && (
          <div className="card border border-amber-500/30 bg-amber-500/5">
            <div className="flex items-start gap-3 mb-3">
              <span className="text-amber-400 text-lg mt-0.5">📍</span>
              <div>
                <p className="text-sm font-semibold text-white">Today's USD/ZAR Spot Rate</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Upload the FXFlow Facility Summary above to set this automatically, or enter
                  the current market mid-rate here (e.g. from Bloomberg or Reuters).
                  If left blank the dashboard will try to fetch a live rate.
                </p>
              </div>
            </div>
            <input
              type="text"
              value={spotRate}
              onChange={(e) => setSpotRate(e.target.value)}
              placeholder="e.g. 16.43  (today's USD/ZAR mid-market spot)"
              className="input-dark w-full text-base font-mono placeholder:text-slate-600"
            />
          </div>
        )}

        {/* Other rates + bridge inputs */}
        <div className="card">
          <p className="section-title mb-3">Cross Rates &amp; Bridge Inputs
            <span className="normal-case text-slate-600 ml-2 tracking-normal">(optional — auto-fetched or derived if blank)</span>
          </p>
          <div className="grid grid-cols-2 md:grid-cols-2 gap-3">
            <RateInput label="GBP/USD Cross"     value={gbpUsd}    onChange={setGbpUsd}    placeholder="e.g. 1.2740" />
            <RateInput label="EUR/USD Cross"     value={eurUsd}    onChange={setEurUsd}    placeholder="e.g. 1.0850" />
            <RateInput label="Prev Day MTM (R)"  value={prevMtm}   onChange={setPrevMtm}   placeholder="e.g. 3 870 000" />
            <RateInput label="Prev Day Rate"     value={prevRate}  onChange={setPrevRate}  placeholder="e.g. 16.42" />
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-red-400 text-sm">
            <AlertCircleIcon size={16} className="shrink-0" />
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={loading || !file}
          className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all
            ${(!file || loading) ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : 'btn-primary'}`}
        >
          {loading ? (
            <><LoaderIcon size={16} className="animate-spin" /> Processing…</>
          ) : (
            'Generate Dashboard →'
          )}
        </button>
      </div>
    </div>
  )
}

function RateInput({ label, value, onChange, placeholder }) {
  return (
    <div>
      <label className="block text-xs text-slate-400 mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="input-dark"
      />
    </div>
  )
}
