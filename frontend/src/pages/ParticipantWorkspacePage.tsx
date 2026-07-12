import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useSessionStore } from '../stores/sessionStore'
import { useStudyStore } from '../stores/studyStore'
import { useWorkspaceStore } from '../stores/workspaceStore'
import { CompactCanvasPanel } from '../components/workspace/CompactCanvasPanel'
import { AnalysisPanel } from '../components/workspace/AnalysisPanel'
import { ProtocolEditorPanel } from '../components/workspace/ProtocolEditorPanel'
import { FileViewerModal } from '../components/shared/FileViewerModal'
import { getProtocol, saveProtocolSnapshot } from '../api/participants'
import { logEvent } from '../api/log'
import type { ViewerTarget } from '../types'

const STUDY_ID = 'default'

const MODE_BADGE: Record<string, string> = {
  findings:    'bg-green-100 text-green-800 border-green-300',
  suggestions: 'bg-purple-100 text-purple-800 border-purple-300',
  baseline:    'bg-gray-100 text-gray-600 border-gray-300',
}
const MODE_LABEL: Record<string, string> = {
  findings:    'Findings',
  suggestions: 'Suggestions',
  baseline:    'No AI Baseline',
}

export function ParticipantWorkspacePage() {
  const { participantId } = useParams<{ participantId: string }>()
  const navigate = useNavigate()
  const { mode, sessionId } = useSessionStore()
  const { study, fetchStudy } = useStudyStore()
  const { participant, analysisRequests, fetchWorkspace } = useWorkspaceStore()

  const [viewerTarget, setViewerTarget] = useState<ViewerTarget | null>(null)
  const [viewerIsTemplate, setViewerIsTemplate] = useState(false)
  const [protocolContent, setProtocolContent] = useState('')
  const [protocolLoading, setProtocolLoading] = useState(true)
  const snapshotSaved = useRef(false)

  useEffect(() => {
    if (!participantId) return
    fetchStudy(STUDY_ID)
    fetchWorkspace(participantId)
    loadProtocol(participantId)
  }, [participantId])

  // Reliable session_end — use both visibilitychange and beforeunload
  useEffect(() => {
    if (!participantId) return

    async function endSession() {
      if (snapshotSaved.current) return
      snapshotSaved.current = true
      // Save protocol snapshot for this session
      if (mode && sessionId) {
        try {
          const proto = await getProtocol(participantId!)
          await saveProtocolSnapshot(participantId!, sessionId, mode, proto.content ?? '')
        } catch { /* best-effort */ }
      }
      logEvent('session_end', { participant_id: participantId })
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'hidden') endSession()
    }
    function handleBeforeUnload() { endSession() }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('beforeunload', handleBeforeUnload)
      // Also fire when navigating away within the SPA
      endSession()
    }
  }, [participantId, mode, sessionId])

  async function loadProtocol(pid: string) {
    setProtocolLoading(true)
    try {
      const data = await getProtocol(pid)
      setProtocolContent(data.content ?? '')
    } catch {
      setProtocolContent('')
    } finally {
      setProtocolLoading(false)
    }
  }

  if (!mode) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-gray-500">No mode selected. Please start from the transition screen.</p>
          <button className="btn-primary" onClick={() => navigate('/conduct')}>
            Go to mode selection
          </button>
        </div>
      </div>
    )
  }

  const blocks = study?.blocks ?? []
  const files = participant?.data_files ?? []

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-2.5 flex items-center gap-3 shrink-0">
        <button
          className="text-sm text-indigo-500 hover:underline shrink-0"
          onClick={() => navigate('/design')}
        >
          ← Study Design
        </button>
        <span className="text-gray-300">|</span>
        <span className="font-semibold text-gray-800 text-sm truncate">
          {participant?.label ?? 'Loading…'}
        </span>
        <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold shrink-0 ${MODE_BADGE[mode] ?? MODE_BADGE.baseline}`}>
          {MODE_LABEL[mode] ?? mode}
        </span>
        <div className="flex-1" />
        <button
          className="btn-primary text-xs shrink-0"
          onClick={() => navigate(`/workspace/${participantId}/interview`)}
        >
          Ready to Interview →
        </button>
        <button
          className="btn-secondary text-xs shrink-0"
          onClick={() => navigate('/conduct')}
        >
          Switch mode
        </button>
      </div>

      {/* Three-column workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left — compact canvas + file upload */}
        <div className="w-72 shrink-0 border-r border-gray-200 bg-white overflow-hidden flex flex-col">
          <CompactCanvasPanel
            blocks={blocks}
            participantFiles={files}
            onOpenViewer={(target, isTemplate) => {
              setViewerTarget(target)
              setViewerIsTemplate(isTemplate ?? false)
            }}
          />
        </div>

        {/* Center — analysis panel (hidden in baseline) */}
        {mode !== 'baseline' && (
          <div className="flex-1 overflow-hidden flex flex-col border-r border-gray-200">
            <div className="shrink-0 px-3 pt-2 pb-1 border-b border-gray-100 bg-white">
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wide">Analysis</h2>
            </div>
            <div className="flex-1 overflow-hidden">
              <AnalysisPanel
                mode={mode}
                participantFiles={files}
                requests={analysisRequests}
                onOpenViewer={setViewerTarget}
              />
            </div>
          </div>
        )}

        {/* Right — protocol editor */}
        <div className={`${mode === 'baseline' ? 'flex-1' : 'w-[420px]'} shrink-0 overflow-hidden flex flex-col`}>
          {protocolLoading ? (
            <div className="flex items-center justify-center h-full text-gray-400 text-sm">
              Loading protocol…
            </div>
          ) : participantId ? (
            <ProtocolEditorPanel
              participantId={participantId}
              initialContent={protocolContent}
            />
          ) : null}
        </div>
      </div>

      {/* File viewer modal */}
      {viewerTarget && (
        <FileViewerModal
          target={viewerTarget}
          isTemplate={viewerIsTemplate}
          onClose={() => { setViewerTarget(null); setViewerIsTemplate(false) }}
        />
      )}
    </div>
  )
}
