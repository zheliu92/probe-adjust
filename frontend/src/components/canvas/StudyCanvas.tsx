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
import { BlockCard, SlotColumn } from './BlockCard'
import { useStudyStore } from '../../stores/studyStore'
import * as api from '../../api/studies'
import { toast } from '../shared/Toast'

interface Props {
  blocks: Block[]
  studyId: string
  selectedSlotId: string | null
  onSlotClick: (slot: DataSlot) => void
}

export function StudyCanvas({ blocks, selectedSlotId, onSlotClick }: Props) {
  const { reorderBlocks, addBlock, refreshStudy } = useStudyStore()

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

  async function handleAddSlot(blockId: string) {
    try {
      const slot = await api.addSlot(blockId, {
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

  const BLOCK_TYPES = [
    { type: 'plain',      icon: '—',  label: 'Plain'      },
    { type: 'experience', icon: '⚡', label: 'Experience' },
    { type: 'feedback',   icon: '💬', label: 'Feedback'   },
  ]

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="text-xs text-gray-400 mr-1">Add block:</span>
        {BLOCK_TYPES.map(({ type, icon, label }) => (
          <button
            key={type}
            className="btn-secondary text-xs"
            onClick={() => addBlock(type, `New ${label} block`)}
          >
            {icon} {label}
          </button>
        ))}
      </div>

      {/* Column headers */}
      {blocks.length > 0 && (
        <div className="flex gap-0 mb-1 px-1">
          <div className="flex-1 text-[10px] text-gray-400 uppercase tracking-wide font-semibold pl-10">Study block</div>
          <div className="w-52 text-[10px] text-gray-400 uppercase tracking-wide font-semibold pl-2">Data slots</div>
        </div>
      )}

      {/* Canvas */}
      {blocks.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-gray-300 text-sm border-2 border-dashed border-gray-200 rounded-lg">
          No blocks yet — add one above to start designing your study plan.
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto pr-1">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={blocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
              {blocks.map(block => (
                <div key={block.id} className="flex gap-0 mb-2 items-stretch">
                  {/* Left: draggable block card */}
                  <div className="flex-1">
                    <BlockCard
                      block={block}
                      selectedSlotId={selectedSlotId}
                      onSlotClick={onSlotClick}
                      onAddSlot={handleAddSlot}
                    />
                  </div>
                  {/* Right: slot column, top-aligned */}
                  <SlotColumn
                    block={block}
                    selectedSlotId={selectedSlotId}
                    onSlotClick={onSlotClick}
                    onAddSlot={handleAddSlot}
                  />
                </div>
              ))}
            </SortableContext>
          </DndContext>
        </div>
      )}
    </div>
  )
}
