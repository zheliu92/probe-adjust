import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStudyStore } from '../stores/studyStore'
import { StudyCanvas } from '../components/canvas/StudyCanvas'
import { SlotDetailPanel } from '../components/canvas/SlotDetailPanel'
import { FileViewerModal } from '../components/shared/FileViewerModal'
import type { DataSlot, ViewerTarget } from '../types'

const STUDY_ID = 'default'

export function StudyDesignPage() {
  const navigate = useNavigate()
  const { fetchStudy, study, loading, error } = useStudyStore()
  const [selectedSlot, setSelectedSlot] = useState<DataSlot | null>(null)
  const [viewerTarget, setViewerTarget] = useState<ViewerTarget | null>(null)
  const [viewerIsTemplate, setViewerIsTemplate] = useState(false)

  useEffect(() => { fetchStudy(STUDY_ID) }, [])

  function handleViewTemplate(slotId: string, fileName: string) {
    setViewerTarget({ fileId: slotId, fileName, context: 'direct' })
    setViewerIsTemplate(true)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400">
        Loading study…
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shrink-0">
        <div>
          <h1 className="font-bold text-gray-900">{study?.title ?? 'Study Design'}</h1>
          <p className="text-xs text-gray-400">Stage 1 — Study Plan</p>
        </div>
        <button className="btn-primary" onClick={() => navigate('/conduct')}>
          Begin Study Conduct →
        </button>
      </div>

      {/* Body: left 2/3 (unified canvas) + right 1/3 (slot config) */}
      <div className="flex-1 flex gap-4 p-4 min-h-0 overflow-hidden">

        {/* LEFT — unified scrolling canvas (blocks + slots together) */}
        <div className="flex-[2] flex flex-col bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden min-w-0">
          {/* Header with column sub-labels */}
          <div className="shrink-0 border-b border-gray-100">
            <div className="flex items-center px-4 py-2.5 gap-3">
              <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wide">Study Plan</h2>
              <span className="text-[10px] text-gray-400">Drag to reorder · double-click to rename</span>
            </div>
            {/* Sub-column headers aligned to the canvas rows below */}
            <div className="flex border-t border-gray-50">
              <div className="w-[55%] px-4 py-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                Study Block
              </div>
              <div className="w-[45%] px-3 py-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wide border-l border-gray-100">
                Data Slots
              </div>
            </div>
          </div>

          {/* Scrollable canvas */}
          <div className="flex-1 overflow-hidden p-3">
            {study && (
              <StudyCanvas
                blocks={study.blocks}
                studyId={STUDY_ID}
                selectedSlotId={selectedSlot?.id ?? null}
                onSlotClick={slot => setSelectedSlot(slot)}
              />
            )}
            {error && (
              <div className="text-red-500 text-xs mt-3 p-2 bg-red-50 rounded">
                Error: {error}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT — slot configuration panel (always present) */}
        <div className="flex-[1] flex flex-col bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden min-w-0">
          <div className="px-4 py-2.5 border-b border-gray-100 shrink-0">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wide">Slot Configuration</h2>
            <p className="text-[10px] text-gray-400 mt-0.5">
              {selectedSlot ? selectedSlot.name : 'Select a slot to configure'}
            </p>
          </div>
          <div className="flex-1 overflow-hidden">
            {selectedSlot ? (
              <SlotDetailPanel
                slot={selectedSlot}
                onClose={() => setSelectedSlot(null)}
                onViewTemplate={handleViewTemplate}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center px-6 gap-3">
                <div className="text-4xl opacity-20">⚙️</div>
                <p className="text-sm text-gray-400">
                  Click a slot badge to view and edit its configuration.
                </p>
              </div>
            )}
          </div>
        </div>

      </div>

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
