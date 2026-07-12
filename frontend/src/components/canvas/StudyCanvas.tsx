import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import type { Block, DataSlot } from '../../types'
import { BlockCard } from './BlockCard'
import { useStudyStore } from '../../stores/studyStore'

interface Props {
  blocks: Block[]
  studyId: string
  selectedSlotId: string | null
  onSlotClick: (slot: DataSlot) => void
}

export function StudyCanvas({ blocks, selectedSlotId: _selectedSlotId, onSlotClick: _onSlotClick }: Props) {
  const { reorderBlocks, addBlock } = useStudyStore()

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = blocks.findIndex(b => b.id === active.id)
    const newIndex = blocks.findIndex(b => b.id === over.id)
    const newOrder = arrayMove(blocks, oldIndex, newIndex).map(b => b.id)
    await reorderBlocks(newOrder)
  }

  const BLOCK_TYPES = [
    { type: 'plain',      icon: '—',  label: 'Plain'      },
    { type: 'experience', icon: '⚡', label: 'Experience' },
    { type: 'feedback',   icon: '💬', label: 'Feedback'   },
  ]

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Add block toolbar */}
      <div className="flex items-center gap-1.5 mb-3 flex-wrap shrink-0">
        <span className="text-[10px] text-gray-400 mr-0.5">Add:</span>
        {BLOCK_TYPES.map(({ type, icon, label }) => (
          <button
            key={type}
            className="btn-secondary text-xs py-1 px-2"
            onClick={() => addBlock(type, `New ${label} block`)}
          >
            {icon} {label}
          </button>
        ))}
      </div>

      {/* Block list */}
      {blocks.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-gray-300 text-sm border-2 border-dashed border-gray-200 rounded-lg">
          No blocks yet
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={blocks.map(b => b.id)}
              strategy={verticalListSortingStrategy}
            >
              {blocks.map(block => (
                <BlockCard key={block.id} block={block} />
              ))}
            </SortableContext>
          </DndContext>
        </div>
      )}
    </div>
  )
}
