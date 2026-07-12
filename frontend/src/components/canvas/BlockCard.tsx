import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Block, DataSlot } from '../../types'
import { SlotBadge } from './SlotBadge'
import { useStudyStore } from '../../stores/studyStore'
import { toast } from '../shared/Toast'

const TYPE_CONFIG: Record<string, { icon: string; label: string; border: string; bg: string }> = {
  plain:      { icon: '—',  label: 'Plain',      border: 'border-gray-400',   bg: 'bg-gray-50'   },
  experience: { icon: '⚡', label: 'Experience', border: 'border-blue-400',   bg: 'bg-blue-50'   },
  feedback:   { icon: '💬', label: 'Feedback',   border: 'border-amber-400',  bg: 'bg-amber-50'  },
}

interface Props {
  block: Block
  selectedSlotId: string | null
  onSlotClick: (slot: DataSlot) => void
  onAddSlot: (blockId: string) => void
}

export function BlockCard({ block, selectedSlotId: _selectedSlotId, onSlotClick: _onSlotClick, onAddSlot: _onAddSlot }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: block.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  const { updateBlockLabel, deleteBlock } = useStudyStore()
  const [editing, setEditing] = useState(false)
  const [labelVal, setLabelVal] = useState(block.label)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const cfg = TYPE_CONFIG[block.type] ?? TYPE_CONFIG.plain

  async function handleLabelBlur() {
    setEditing(false)
    if (labelVal.trim() && labelVal !== block.label) {
      await updateBlockLabel(block.id, labelVal.trim())
    } else {
      setLabelVal(block.label)
    }
  }

  async function handleDelete() {
    try {
      await deleteBlock(block.id)
    } catch {
      toast('Failed to delete block', 'error')
    }
  }

  // The block card only renders the left column cell — slots are rendered separately
  // in StudyCanvas to align them to the right column.
  return (
    <div ref={setNodeRef} style={style} className="flex items-stretch">
      {/* Block cell */}
      <div className={`flex-1 flex items-center gap-2 px-3 py-2.5 rounded-lg border-l-4 ${cfg.border} ${cfg.bg} border border-r-0 rounded-r-none`}>
        {/* Drag handle */}
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-gray-400 select-none text-sm"
          title="Drag to reorder"
        >
          ⠿
        </div>

        <span className="text-base shrink-0" title={cfg.label}>{cfg.icon}</span>

        {editing ? (
          <input
            autoFocus
            className="flex-1 text-sm font-semibold bg-transparent border-b border-indigo-400 outline-none"
            value={labelVal}
            onChange={e => setLabelVal(e.target.value)}
            onBlur={handleLabelBlur}
            onKeyDown={e => e.key === 'Enter' && e.currentTarget.blur()}
          />
        ) : (
          <span
            className="flex-1 text-sm font-semibold text-gray-800 cursor-text"
            onDoubleClick={() => setEditing(true)}
            title="Double-click to rename"
          >
            {block.label}
          </span>
        )}

        <span className="text-[9px] text-gray-400 uppercase tracking-wide shrink-0">{cfg.label}</span>

        {confirmDelete ? (
          <div className="flex gap-1 shrink-0">
            <button className="text-xs text-red-600 hover:underline" onClick={handleDelete}>Delete</button>
            <button className="text-xs text-gray-400 hover:underline" onClick={() => setConfirmDelete(false)}>Cancel</button>
          </div>
        ) : (
          <button
            className="text-gray-300 hover:text-red-400 shrink-0"
            onClick={() => setConfirmDelete(true)}
            title="Delete block"
          >
            🗑
          </button>
        )}
      </div>
    </div>
  )
}


/** SlotColumn renders the right-side column of slots for one block row. */
export function SlotColumn({
  block,
  selectedSlotId,
  onSlotClick,
  onAddSlot,
}: Props) {
  return (
    <div className="w-52 flex flex-col gap-1 pl-0 border border-l-0 rounded-r-lg bg-white px-2 py-2">
      {block.slots.length === 0 && (
        <span className="text-[10px] text-gray-300 italic px-1">no slots</span>
      )}
      {block.slots.map(slot => (
        <SlotBadge
          key={slot.id}
          slot={slot}
          selected={selectedSlotId === slot.id}
          onClick={() => onSlotClick(slot)}
        />
      ))}
      <button
        className="text-[10px] text-indigo-400 hover:text-indigo-600 text-left px-1 mt-0.5"
        onClick={() => onAddSlot(block.id)}
      >
        + add slot
      </button>
    </div>
  )
}
