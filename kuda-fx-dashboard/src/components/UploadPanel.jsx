import React, { useState, useRef, useCallback } from 'react'
import { UploadCloudIcon, FileSpreadsheetIcon, AlertCircleIcon, LoaderIcon } from 'lucide-react'

const ACCEPTED = '.xlsx,.xls,.csv'

export default function UploadPanel({ onData }) {
  const [dragging, setDragging] = useState(false)
  const [file,     setFile]     = useState(null)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState(null)
  const inputRef = useRef()

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setDragging(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped) validateAndSet(dropped)
  }, [])

  const validateAndSet = (f) => {
    const ext = f.name.split('.').pop().toLowerCase()
    if (!['xlsx', 'xls', 'csv'].includes(ext)) {
      setError('Please upload the FXFlow Open Trades Excel (.xlsx) or CSV file.')
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

      <div className="w-full max-w-xl space-y-5">
        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`card cursor-pointer border-2 border-dashed transition-all text-center py-12
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
                  Drag & drop or click · Excel (.xlsx) or CSV
                </p>
              </div>
            </div>
          )}
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

        <p className="text-center text-xs text-slate-600">
          Rates fetched automatically · MTM & nominal calculated from trades data
        </p>
      </div>
    </div>
  )
}
