import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Block } from '../../types'
import { useStudyStore } from '../../stores/studyStore'
import { toast } from '../shared/Toast'

const TYPE_CONFIG: Record<string, { icon: string; label: string; border: string; bg: string }> = {
  plain:      { icon: '—',  label: 'Plain',      border: 'border-gray-400',  bg: 'bg-gray-50'   },
  experience: { icon: '⚡', label: 'Experience', border: 'border-blue-400',  bg: 'bg-blue-50'   },
  feedback:   { icon: '💬', label: 'Feedback',   border: 'border-amber-400', bg: 'bg-amber-50'  },
}

interface Props {
  block: Block
}

export function BlockCard({ block }: Props) {
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 px-3 py-2.5 mb-2 rounded-lg border-l-4 border ${cfg.border} ${cfg.bg}`}
    >
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-gray-400 select-none shrink-0"
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
          className="flex-1 text-sm font-semibold text-gray-800 cursor-text truncate"
          onDoubleClick={() => setEditing(true)}
          title="Double-click to rename"
        >
          {block.label}
        </span>
      )}

      <span className="text-[9px] text-gray-400 uppercase tracking-wide shrink-0 hidden sm:inline">
        {cfg.label}
      </span>

      {confirmDelete ? (
        <div className="flex gap-1 shrink-0 text-xs">
          <button className="text-red-600 hover:underline" onClick={handleDelete}>Delete</button>
          <button className="text-gray-400 hover:underline" onClick={() => setConfirmDelete(false)}>Cancel</button>
        </div>
      ) : (
        <button
          className="text-gray-300 hover:text-red-400 shrink-0 text-sm"
          onClick={() => setConfirmDelete(true)}
          title="Delete block"
        >
          🗑
        </button>
      )}
    </div>
  )
}
