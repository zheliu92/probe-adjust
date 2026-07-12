import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useSessionStore } from '../stores/sessionStore'
import { useStudyStore } from '../stores/studyStore'
import { useWorkspaceStore } from '../stores/workspaceStore'
import { CompactCanvasPanel } from '../components/workspace/CompactCanvasPanel'
import { AnalysisPanel } from '../components/workspace/AnalysisPanel'
import { ProtocolEditorPanel } from '../components/workspace/ProtocolEditorPanel'
import { BaselineDataPanel, type OpenFile } from '../components/workspace/BaselineDataPanel'
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

  // Modal viewer — used in findings/suggestions mode for citation clicks
  const [viewerTarget, setViewerTarget] = useState<ViewerTarget | null>(null)
  const [viewerIsTemplate, setViewerIsTemplate] = useState(false)

  // Baseline inline file preview — cumulative list of open file cards
  const [baselineOpenFiles, setBaselineOpenFiles] = useState<OpenFile[]>([])

  const [protocolContent, setProtocolContent] = useState('')
  const [protocolLoading, setProtocolLoading] = useState(true)
  const snapshotSaved = useRef(false)

  useEffect(() => {
    if (!participantId) return
    fetchStudy(STUDY_ID)
    fetchWorkspace(participantId)
    loadProtocol(participantId)
  }, [participantId])

  // Reliable session_end
  useEffect(() => {
    if (!participantId) return
    async function endSession() {
      if (snapshotSaved.current) return
      snapshotSaved.current = true
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
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('beforeunload', endSession)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('beforeunload', endSession)
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

  // Handler passed to CompactCanvasPanel.
  // - In baseline mode: add file to inline preview (cumulative), avoid duplicates
  // - In findings/suggestions mode: open the modal viewer as before
  const handleOpenFile = useCallback((target: ViewerTarget, isTemplate?: boolean) => {
    if (mode === 'baseline' && !isTemplate) {
      // Add to baseline preview panel (avoid duplicate cards)
      setBaselineOpenFiles(prev => {
        if (prev.some(f => f.fileId === target.fileId)) return prev
        return [...prev, { fileId: target.fileId, fileName: target.fileName }]
      })
      logEvent('file_opened', {
        file_id: target.fileId,
        file_name: target.fileName,
        context: 'baseline_panel',
      })
    } else {
      // Normal modal viewer
      setViewerTarget(target)
      setViewerIsTemplate(isTemplate ?? false)
    }
  }, [mode])

  function handleCloseBaselineFile(fileId: string) {
    setBaselineOpenFiles(prev => prev.filter(f => f.fileId !== fileId))
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

      {/* Three-column workspace — same layout for ALL modes */}
      <div className="flex-1 flex overflow-hidden">

        {/* Left — compact canvas + file upload (all modes) */}
        <div className="w-72 shrink-0 border-r border-gray-200 bg-white overflow-hidden flex flex-col">
          <CompactCanvasPanel
            blocks={blocks}
            participantFiles={files}
            onOpenViewer={handleOpenFile}
          />
        </div>

        {/* Center — Analysis panel (findings/suggestions) OR Data preview (baseline) */}
        <div className="flex-1 overflow-hidden flex flex-col border-r border-gray-200">
          <div className="shrink-0 px-3 pt-2 pb-1 border-b border-gray-100 bg-white">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wide">
              {mode === 'baseline' ? 'Data Preview' : 'Analysis'}
            </h2>
            {mode === 'baseline' && (
              <p className="text-[10px] text-gray-400 mt-0.5">
                Click a data file in the left panel to preview it here
              </p>
            )}
          </div>
          <div className="flex-1 overflow-hidden">
            {mode === 'baseline' ? (
              <BaselineDataPanel
                openFiles={baselineOpenFiles}
                onClose={handleCloseBaselineFile}
              />
            ) : (
              <AnalysisPanel
                mode={mode}
                participantFiles={files}
                requests={analysisRequests}
                onOpenViewer={setViewerTarget}
              />
            )}
          </div>
        </div>

        {/* Right — protocol editor (all modes) */}
        <div className="w-[420px] shrink-0 overflow-hidden flex flex-col">
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

      {/* File viewer modal — findings/suggestions mode only */}
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
