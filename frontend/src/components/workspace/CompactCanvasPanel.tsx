import { useRef } from 'react'
import type { Block, ParticipantDataFile, ViewerTarget } from '../../types'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { toast } from '../shared/Toast'

const TYPE_CONFIG = {
  plain: { icon: '—', color: 'border-gray-300' },
  experience: { icon: '⚡', color: 'border-blue-400' },
  feedback: { icon: '💬', color: 'border-amber-400' },
}
const NATURE_COLOR: Record<string, string> = {
  subjective: 'bg-amber-100 text-amber-800 border-amber-300',
  objective: 'bg-blue-100 text-blue-800 border-blue-300',
}
const TYPE_SHAPE: Record<string, string> = {
  qualitative: 'rounded-full',
  quantitative: 'rounded-sm',
}

interface Props {
  blocks: Block[]
  participantFiles: ParticipantDataFile[]
  onOpenViewer: (target: ViewerTarget, isTemplate?: boolean) => void
}

export function CompactCanvasPanel({ blocks, participantFiles, onOpenViewer }: Props) {
  const { uploadFile } = useWorkspaceStore()
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  function getFileForSlot(slotId: string): ParticipantDataFile | undefined {
    return participantFiles.find((f) => f.slot_id === slotId)
  }

  async function handleFileChange(slotId: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!['txt', 'md', 'json'].includes(ext ?? '')) {
      toast('Only .txt, .md, .json files are allowed', 'error')
      return
    }
    try {
      await uploadFile(slotId, file)
      toast(`Uploaded ${file.name}`, 'success')
    } catch {
      toast('Upload failed', 'error')
    } finally {
      if (fileInputRefs.current[slotId]) {
        fileInputRefs.current[slotId]!.value = ''
      }
    }
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto p-3 gap-2">
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
        Study Plan
      </h2>
      {blocks.map((block) => {
        const cfg = TYPE_CONFIG[block.type] ?? TYPE_CONFIG.plain
        return (
          <div key={block.id} className={`card border-l-4 ${cfg.color} p-2`}>
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="text-sm">{cfg.icon}</span>
              <span className="text-xs font-semibold text-gray-800">{block.label}</span>
            </div>

            {block.slots.map((slot) => {
              // A slot has a template when template_file_name is populated (set at study design time)
              // A slot accepts participant data when template_file_name is absent
              const hasTemplate = Boolean(slot.template_file_name)
              const uploadedFile = !hasTemplate ? getFileForSlot(slot.id) : null
              const shape = TYPE_SHAPE[slot.data_type] ?? 'rounded'
              const color = NATURE_COLOR[slot.data_nature] ?? 'bg-gray-100 text-gray-700 border-gray-200'

              return (
                <div key={slot.id} className="flex items-center gap-2 py-1 border-t border-gray-100 first:border-t-0">
                  <span className={`${shape} ${color} border text-[10px] px-1.5 py-0.5 shrink-0`}>
                    {slot.name}
                  </span>

                  {hasTemplate && slot.template_file_name ? (
                    <button
                      className="text-xs text-indigo-600 hover:underline truncate"
                      onClick={() =>
                        onOpenViewer({
                          fileId: slot.id,
                          fileName: slot.template_file_name!,
                          context: 'direct',
                        }, true)
                      }
                    >
                      📄 {slot.template_file_name}
                    </button>
                  ) : uploadedFile ? (
                    <button
                      className="text-xs text-gray-700 hover:text-indigo-600 hover:underline truncate"
                      onClick={() =>
                        onOpenViewer({
                          fileId: uploadedFile.id,
                          fileName: uploadedFile.file_name,
                          context: 'direct',
                        })
                      }
                    >
                      📊 {uploadedFile.file_name}
                    </button>
                  ) : (
                    <>
                      <input
                        type="file"
                        accept=".txt,.md,.json"
                        className="hidden"
                        ref={(el) => { fileInputRefs.current[slot.id] = el }}
                        onChange={(e) => handleFileChange(slot.id, e)}
                      />
                      <button
                        className="text-xs text-gray-400 hover:text-indigo-500 border border-dashed border-gray-300 rounded px-2 py-0.5"
                        onClick={() => fileInputRefs.current[slot.id]?.click()}
                      >
                        + Upload data
                      </button>
                    </>
                  )}
                </div>
              )
            })}

            {block.slots.length === 0 && (
              <p className="text-xs text-gray-400 italic">No data slots defined</p>
            )}
          </div>
        )
      })}
    </div>
  )
}
