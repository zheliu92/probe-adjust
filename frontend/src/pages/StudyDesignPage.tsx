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
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <div>
          <h1 className="font-bold text-gray-900">{study?.title ?? 'Study Design'}</h1>
          <p className="text-xs text-gray-400">Stage 1 — Study Plan</p>
        </div>
        <button className="btn-primary" onClick={() => navigate('/conduct')}>
          Begin Study Conduct →
        </button>
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Canvas — takes full remaining width unless a slot is selected */}
        <div className="flex-1 flex flex-col p-6 min-h-0 overflow-hidden">
          {study && (
            <StudyCanvas
              blocks={study.blocks}
              studyId={STUDY_ID}
              selectedSlotId={selectedSlot?.id ?? null}
              onSlotClick={slot => setSelectedSlot(slot)}
            />
          )}
          {error && (
            <div className="text-red-500 text-sm mt-4 p-3 bg-red-50 rounded">
              Error loading study: {error}. Make sure the backend is running and seeded.
            </div>
          )}
        </div>

        {/* Right panel — only shown when a slot is selected */}
        {selectedSlot && (
          <SlotDetailPanel
            slot={selectedSlot}
            onClose={() => setSelectedSlot(null)}
            onViewTemplate={handleViewTemplate}
          />
        )}
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
