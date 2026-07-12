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
import { SlotBadge } from './SlotBadge'
import { useStudyStore } from '../../stores/studyStore'
import * as api from '../../api/studies'
import { toast } from '../shared/Toast'

interface Props {
  blocks: Block[]
  studyId: string
  selectedSlotId: string | null
  onSlotClick: (slot: DataSlot) => void
}

const BLOCK_TYPES = [
  { type: 'plain',      icon: '—',  label: 'Plain'      },
  { type: 'experience', icon: '⚡', label: 'Experience' },
  { type: 'feedback',   icon: '💬', label: 'Feedback'   },
]

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

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Add block toolbar */}
      <div className="flex items-center gap-1.5 mb-3 flex-wrap shrink-0">
        <span className="text-[10px] text-gray-400 mr-0.5">Add block:</span>
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

      {/* Block rows — each row = block (55%) + slots (45%), both stretch to shared height */}
      {blocks.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-gray-300 text-sm border-2 border-dashed border-gray-200 rounded-lg">
          No blocks yet — add one above.
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
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
                /* Each row: block cell + slot cell, same border/background treatment,
                   items-stretch means both children fill the row height */
                <div key={block.id} className="flex items-stretch rounded-lg overflow-hidden border border-gray-200">
                  {/* Block cell — 55% width */}
                  <div className="w-[55%] shrink-0">
                    <BlockCard block={block} />
                  </div>

                  {/* Slot cell — 45% width, vertically aligned to top */}
                  <div className="w-[45%] border-l border-gray-200 bg-gray-50 flex flex-col justify-start p-2 gap-1.5">
                    {block.slots.length === 0 ? (
                      <span className="text-[10px] text-gray-300 italic px-1 pt-1">no slots</span>
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
                      onClick={() => handleAddSlot(block.id)}
                    >
                      + add slot
                    </button>
                  </div>
                </div>
              ))}
            </SortableContext>
          </DndContext>
        </div>
      )}
    </div>
  )
}
