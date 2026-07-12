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

      {/* Three-column layout — each column is 1/3 of the available width */}
      <div className="flex-1 grid grid-cols-3 gap-4 p-4 min-h-0 overflow-hidden">

        {/* Column 1 — Study Blocks */}
        <div className="flex flex-col bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gray-100 shrink-0">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wide">Study Blocks</h2>
            <p className="text-[10px] text-gray-400 mt-0.5">Drag to reorder · double-click to rename</p>
          </div>
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

        {/* Column 2 — Data Slots (per block) */}
        <div className="flex flex-col bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gray-100 shrink-0">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wide">Data Slots</h2>
            <p className="text-[10px] text-gray-400 mt-0.5">Click a slot badge to configure it</p>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {study && study.blocks.length === 0 && (
              <p className="text-xs text-gray-400 italic text-center mt-8">
                Add blocks in the left panel to define data slots.
              </p>
            )}
            {study && study.blocks.map(block => (
              <SlotListSection
                key={block.id}
                block={block}
                selectedSlotId={selectedSlot?.id ?? null}
                onSlotClick={slot => setSelectedSlot(slot)}
                onViewTemplate={handleViewTemplate}
              />
            ))}
          </div>
        </div>

        {/* Column 3 — Slot Configuration (always present) */}
        <div className="flex flex-col bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
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
                  Click any slot badge in the middle panel to view and edit its configuration.
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

// ── Slot list for one block (used in column 2) ────────────────────────────────
import type { Block } from '../types'
import { SlotBadge } from '../components/canvas/SlotBadge'
import * as api from '../api/studies'
import { toast } from '../components/shared/Toast'

function SlotListSection({
  block,
  selectedSlotId,
  onSlotClick,
  onViewTemplate: _onViewTemplate,
}: {
  block: Block
  selectedSlotId: string | null
  onSlotClick: (slot: DataSlot) => void
  onViewTemplate: (slotId: string, fileName: string) => void
}) {
  const { refreshStudy } = useStudyStore()

  const TYPE_ICON: Record<string, string> = {
    plain: '—', experience: '⚡', feedback: '💬',
  }
  const TYPE_COLOR: Record<string, string> = {
    plain: 'text-gray-500', experience: 'text-blue-600', feedback: 'text-amber-600',
  }

  async function handleAddSlot() {
    try {
      const slot = await api.addSlot(block.id, {
        name: 'New data slot',
        data_type: 'qualitative',
        data_nature: 'subjective',
      })
      await refreshStudy()
      onSlotClick(slot)
    } catch {
      toast('Failed to add slot', 'error')
    }
  }

  return (
    <div className="border border-gray-100 rounded-lg overflow-hidden">
      {/* Block header */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 border-b border-gray-100">
        <span className={`text-sm ${TYPE_COLOR[block.type] ?? 'text-gray-500'}`}>
          {TYPE_ICON[block.type] ?? '·'}
        </span>
        <span className="text-xs font-semibold text-gray-700 truncate">{block.label}</span>
      </div>

      {/* Slot badges */}
      <div className="p-2 flex flex-col gap-1.5">
        {block.slots.length === 0 ? (
          <p className="text-[10px] text-gray-300 italic px-1">No slots defined</p>
        ) : (
          block.slots.map(slot => (
            <SlotBadge
              key={slot.id}
              slot={slot}
              selected={selectedSlotId === slot.id}
              onClick={() => onSlotClick(slot)}
            />
          ))
        )}
        <button
          className="text-[10px] text-indigo-400 hover:text-indigo-600 text-left px-1 mt-0.5"
          onClick={handleAddSlot}
        >
          + add slot
        </button>
      </div>
    </div>
  )
}
