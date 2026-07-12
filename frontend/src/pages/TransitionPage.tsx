import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSessionStore } from '../stores/sessionStore'
import { uploadParticipantZip } from '../api/participants'
import { logEvent } from '../api/log'
import { toast } from '../components/shared/Toast'
import type { Mode } from '../types'

const STUDY_ID = 'default'

const MODE_OPTIONS: {
  mode: Mode
  label: string
  activeClass: string
  description: string
}[] = [
  {
    mode: 'findings',
    label: 'Findings',
    activeClass: 'border-green-500 bg-green-50 ring-2 ring-green-300',
    description:
      'The system analyses your data and surfaces interviewable tensions — contradictions, convergences, and anomalies — each with a citation linking back to the source.',
  },
  {
    mode: 'suggestions',
    label: 'Suggestions',
    activeClass: 'border-purple-500 bg-purple-50 ring-2 ring-purple-300',
    description:
      'Everything in Findings mode, plus specific protocol adjustment suggestions: where to add follow-up questions, clarify wording, or add interviewer notes.',
  },
  {
    mode: 'baseline',
    label: 'No AI Assistance',
    activeClass: 'border-gray-500 bg-gray-100 ring-2 ring-gray-300',
    description:
      'No AI analysis. You see all uploaded data files and can edit the interview protocol freely, without any system-generated findings or suggestions.',
  },
]

export function TransitionPage() {
  const navigate = useNavigate()
  const { setStage2 } = useSessionStore()

  const [selectedMode, setSelectedMode] = useState<Mode | null>(null)
  const [participant, setParticipant] = useState<{ id: string; label: string } | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Pre-select mode if returning to this page
  useEffect(() => {
    const storedMode = useSessionStore.getState().mode
    if (storedMode) setSelectedMode(storedMode)
  }, [])

  async function handleZipUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.zip')) {
      toast('Please select a .zip file', 'error')
      return
    }
    setUploading(true)
    try {
      const p = await uploadParticipantZip(STUDY_ID, file)
      setParticipant({ id: p.id, label: p.label })
      toast(`Participant "${p.label}" loaded — ${p.data_files.length} file(s) matched`, 'success')
    } catch (err: any) {
      toast(`Upload failed: ${err?.response?.data?.detail ?? err.message}`, 'error')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function handleStart() {
    if (!selectedMode || !participant) return
    setStage2(selectedMode, participant.id)
    logEvent('stage2_start', { mode: selectedMode, study_participant_id: participant.id })
    navigate(`/workspace/${participant.id}`)
  }

  const canStart = selectedMode !== null && participant !== null

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-white flex items-center justify-center p-6">
      <div className="max-w-xl w-full space-y-7">

        {/* Header */}
        <div>
          <button
            className="text-sm text-indigo-500 hover:underline mb-3 inline-block"
            onClick={() => navigate('/design')}
          >
            ← Back to Study Design
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Begin Study Conduct</h1>
          <p className="text-sm text-gray-500 mt-1">
            Upload the participant data package, then choose your AI assistance mode.
          </p>
        </div>

        {/* Step 1 — Upload participant zip */}
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-2">
            1. Upload participant data package
          </h2>
          <div
            className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-indigo-400 transition-colors cursor-pointer bg-white"
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? (
              <p className="text-sm text-indigo-500 animate-pulse">Unpacking and matching files…</p>
            ) : participant ? (
              <div className="space-y-1">
                <p className="text-sm font-semibold text-green-700">✓ {participant.label} loaded</p>
                <p className="text-xs text-gray-500">Click to replace with a different package</p>
              </div>
            ) : (
              <div className="space-y-1">
                <p className="text-sm text-gray-500">
                  Drop a <span className="font-mono text-xs bg-gray-100 px-1 rounded">.zip</span> file here, or click to browse
                </p>
                <p className="text-xs text-gray-400">
                  Filename must start with the participant ID, e.g.{' '}
                  <span className="font-mono">P1_experience_data.zip</span>
                </p>
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip"
            className="hidden"
            onChange={handleZipUpload}
          />
        </div>

        {/* Step 2 — Mode selection */}
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-2">2. Select AI assistance mode</h2>
          <div className="grid grid-cols-1 gap-3">
            {MODE_OPTIONS.map(({ mode, label, activeClass, description }) => {
              const isSelected = selectedMode === mode
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setSelectedMode(mode)}
                  className={[
                    'text-left px-4 py-3 rounded-xl border-2 transition-all',
                    isSelected
                      ? activeClass
                      : 'border-gray-200 bg-white hover:border-gray-300',
                  ].join(' ')}
                >
                  <div className="font-semibold text-sm text-gray-900 mb-0.5">{label}</div>
                  <div className="text-xs text-gray-600 leading-relaxed">{description}</div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Start */}
        <button
          className="btn-primary w-full justify-center text-base py-3 disabled:opacity-40 disabled:cursor-not-allowed"
          onClick={handleStart}
          disabled={!canStart}
        >
          Start Session →
        </button>

        {!canStart && (
          <p className="text-xs text-center text-gray-400">
            {!participant && !selectedMode
              ? 'Upload a data package and select a mode to continue'
              : !participant
              ? 'Upload a participant data package to continue'
              : 'Select a mode to continue'}
          </p>
        )}
      </div>
    </div>
  )
}
