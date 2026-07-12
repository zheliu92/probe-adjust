import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSessionStore } from '../stores/sessionStore'
import { logEvent } from '../api/log'

export function SessionEntryPage() {
  const [pid, setPid] = useState('')
  const { setParticipantId } = useSessionStore()
  const navigate = useNavigate()

  function handleEnter() {
    const trimmed = pid.trim()
    if (!trimmed) return
    setParticipantId(trimmed)
    logEvent('session_start', { participant_id: trimmed })
    navigate('/design')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-white flex items-center justify-center p-6">
      <div className="card max-w-md w-full p-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Probe-Adjust</h1>
          <p className="text-sm text-gray-500 mt-1">
            Mixed-methods research support prototype
          </p>
        </div>

        <div>
          <label className="label text-sm">Your Participant ID</label>
          <input
            className="input"
            placeholder="e.g. R01"
            value={pid}
            onChange={(e) => setPid(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleEnter()}
            autoFocus
          />
          <p className="text-xs text-gray-400 mt-1">
            This ID is used to label your interaction logs. No authentication required.
          </p>
        </div>

        <button
          className="btn-primary w-full justify-center text-base py-2.5"
          onClick={handleEnter}
          disabled={!pid.trim()}
        >
          Enter →
        </button>
      </div>
    </div>
  )
}
