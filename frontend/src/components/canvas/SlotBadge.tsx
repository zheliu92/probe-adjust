import type { DataSlot } from '../../types'

interface Props {
  slot: DataSlot
  onClick?: () => void
  selected?: boolean
  compact?: boolean
}

const TYPE_SHAPE: Record<string, string> = {
  qualitative: 'rounded-full',
  quantitative: 'rounded',
}
const NATURE_COLOR: Record<string, string> = {
  subjective: 'bg-amber-100 text-amber-900 border-amber-400',
  objective:  'bg-blue-100 text-blue-900 border-blue-400',
}
const TYPE_LABEL: Record<string, string> = {
  qualitative: 'QL',
  quantitative: 'QN',
}
const NATURE_LABEL: Record<string, string> = {
  subjective: 'Subj',
  objective: 'Obj',
}

export function SlotBadge({ slot, onClick, selected, compact = false }: Props) {
  const shape = TYPE_SHAPE[slot.data_type] ?? 'rounded'
  const color = NATURE_COLOR[slot.data_nature] ?? 'bg-gray-100 text-gray-800 border-gray-300'
  const ring  = selected ? 'ring-2 ring-indigo-500 ring-offset-1' : ''

  const typeTag   = TYPE_LABEL[slot.data_type]   ?? slot.data_type
  const natureTag = NATURE_LABEL[slot.data_nature] ?? slot.data_nature

  const title = `${slot.name} · ${slot.data_type} · ${slot.data_nature}${slot.template_file_name ? ' · template: ' + slot.template_file_name : ''}`

  if (compact) {
    return (
      <span
        title={title}
        className={`${shape} ${color} ${ring} inline-flex items-center gap-1 border text-[9px] font-semibold px-1.5 py-0.5`}
      >
        {typeTag} · {natureTag}
      </span>
    )
  }

  return (
    <button
      onClick={onClick}
      title={title}
      className={`${shape} ${color} ${ring} border text-[10px] font-medium px-2 py-1 cursor-pointer hover:opacity-80 transition-opacity flex items-center gap-1.5 w-full text-left`}
    >
      <span className="font-bold opacity-60">{typeTag}</span>
      <span className="flex-1 truncate">{slot.name}</span>
      {slot.template_file_name && <span title="Template uploaded" className="opacity-50">📄</span>}
    </button>
  )
}
