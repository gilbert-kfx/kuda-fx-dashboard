import React, { useState, useEffect } from 'react'
import { LockIcon, LoaderIcon, AlertCircleIcon } from 'lucide-react'

const CORRECT_HASH = 'b142bf5590eff42bdb2761396931a9de3baa69d4466d4457a67a42bd405cdc7f'
const SESSION_KEY  = 'kuda_auth'

async function sha256hex(str) {
  const buf  = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export default function PasswordGate({ children }) {
  const [authed,   setAuthed]   = useState(false)
  const [checked,  setChecked]  = useState(false)
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState(null)

  // Check sessionStorage on mount — skips prompt for refreshes
  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY) === 'ok') {
      setAuthed(true)
    }
    setChecked(true)
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!password) return
    setLoading(true)
    setError(null)
    try {
      const hash = await sha256hex(password)
      if (hash === CORRECT_HASH) {
        sessionStorage.setItem(SESSION_KEY, 'ok')
        setAuthed(true)
      } else {
        setError('Incorrect password. Please try again.')
        setPassword('')
      }
    } catch (_) {
      setError('Authentication error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!checked) return null
  if (authed)   return children

  return (
    <div className="min-h-screen bg-kuda-navy flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-kuda-teal/10 border border-kuda-teal/20 mb-4">
            <span className="text-kuda-teal font-bold text-2xl">K</span>
          </div>
          <h1 className="text-xl font-semibold text-white">CBC Kuda FX · Risk Dashboard</h1>
          <p className="text-slate-400 text-sm mt-1">Facility FYN005836 · Investec Bank</p>
        </div>

        {/* Password form */}
        <form onSubmit={handleSubmit} className="card space-y-4">
          <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
            <LockIcon size={14} className="shrink-0" />
            <span>Enter the dashboard password to continue</span>
          </div>

          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Password"
            autoFocus
            className="w-full bg-kuda-navylt border border-kuda-border rounded-lg px-4 py-2.5 text-sm text-white
                       placeholder-slate-600 focus:outline-none focus:border-kuda-teal transition-colors"
          />

          {error && (
            <div className="flex items-center gap-2 text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              <AlertCircleIcon size={13} className="shrink-0" />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm transition-all
              ${(!password || loading) ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : 'btn-primary'}`}
          >
            {loading
              ? <><LoaderIcon size={14} className="animate-spin" /> Verifying…</>
              : 'Unlock Dashboard →'
            }
          </button>
        </form>

        <p className="text-center text-xs text-slate-700">
          Authorised personnel only · CBC Kuda Foreign Exchange (Pty) Ltd
        </p>
      </div>
    </div>
  )
}
