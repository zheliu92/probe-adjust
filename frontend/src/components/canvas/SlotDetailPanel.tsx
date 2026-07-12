import { useState, useEffect, useRef } from 'react'
import type { DataSlot, DataType, DataNature } from '../../types'
import * as api from '../../api/studies'
import { useStudyStore } from '../../stores/studyStore'
import { toast } from '../shared/Toast'

interface Props {
  slot: DataSlot | null
  onClose: () => void
  onViewTemplate: (slotId: string, fileName: string) => void
}

export function SlotDetailPanel({ slot, onClose, onViewTemplate }: Props) {
  const refreshStudy = useStudyStore(s => s.refreshStudy)
  const [name, setName] = useState('')
  const [dataType, setDataType] = useState<DataType>('qualitative')
  const [dataNature, setDataNature] = useState<DataNature>('subjective')
  const [annotation, setAnnotation] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!slot) return
    setName(slot.name)
    setDataType(slot.data_type)
    setDataNature(slot.data_nature)
    setAnnotation(slot.annotation?.content ?? '')
    setConfirmDelete(false)
  }, [slot?.id])

  if (!slot) return null

  async function handleSaveMeta() {
    if (!slot) return
    setSaving(true)
    try {
      await api.updateSlot(slot.id, { name, data_type: dataType, data_nature: dataNature })
      await refreshStudy()
      toast('Slot saved', 'success')
    } catch {
      toast('Failed to save slot', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveAnnotation() {
    if (!slot) return
    try {
      await api.upsertAnnotation(slot.id, annotation)
    } catch {
      toast('Failed to save AI instruction', 'error')
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !slot) return
    setUploading(true)
    try {
      await api.uploadTemplate(slot.id, file)
      await refreshStudy()
      toast('Template uploaded', 'success')
    } catch {
      toast('Upload failed', 'error')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleDeleteSlot() {
    if (!slot) return
    try {
      await api.deleteSlot(slot.id)
      await refreshStudy()
      onClose()
      toast('Slot deleted', 'success')
    } catch {
      toast('Failed to delete slot', 'error')
    }
  }

  return (
    <div className="w-80 border-l border-gray-200 bg-white flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <h3 className="font-semibold text-sm text-gray-800">Data Slot</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Name */}
        <div>
          <label className="label">Slot name</label>
          <input
            className="input"
            value={name}
            onChange={e => setName(e.target.value)}
            onBlur={handleSaveMeta}
          />
        </div>

        {/* Data type */}
        <div>
          <label className="label">Data type</label>
          <div className="flex gap-2">
            {(['qualitative', 'quantitative'] as DataType[]).map(v => (
              <button
                key={v}
                onClick={() => { setDataType(v); }}
                className={`flex-1 py-1.5 text-xs rounded border transition-colors ${
                  dataType === v
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {v === 'qualitative' ? '● Qualitative' : '■ Quantitative'}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-gray-400 mt-1">
            Qualitative = circle badge &nbsp;|&nbsp; Quantitative = square badge
          </p>
        </div>

        {/* Data nature */}
        <div>
          <label className="label">Data nature</label>
          <div className="flex gap-2">
            {(['subjective', 'objective'] as DataNature[]).map(v => (
              <button
                key={v}
                onClick={() => { setDataNature(v); }}
                className={`flex-1 py-1.5 text-xs rounded border transition-colors ${
                  dataNature === v
                    ? v === 'subjective'
                      ? 'bg-amber-400 text-amber-900 border-amber-500'
                      : 'bg-blue-500 text-white border-blue-500'
                    : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {v === 'subjective' ? '🌡 Subjective' : '📐 Objective'}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-gray-400 mt-1">
            Subjective = warm amber &nbsp;|&nbsp; Objective = cool blue
          </p>
        </div>

        <button
          className="btn-primary w-full justify-center"
          onClick={handleSaveMeta}
          disabled={saving}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>

        {/* Template file upload — always available, optional */}
        <div className="border-t border-gray-100 pt-4">
          <label className="label">Template file <span className="text-gray-400 font-normal">(optional · .txt, .md, .json)</span></label>
          <p className="text-[10px] text-gray-400 mb-2">
            Upload a template if this slot has a pre-designed form (e.g. a survey questionnaire or interview protocol). Leave empty if the data will be collected without a template.
          </p>
          {slot.template_file_name && (
            <div className="flex items-center gap-2 mb-2 p-2 bg-indigo-50 rounded text-xs text-gray-700">
              <span>📎 {slot.template_file_name}</span>
              <button
                className="text-indigo-600 hover:underline ml-auto"
                onClick={() => onViewTemplate(slot.id, slot.template_file_name!)}
              >
                Preview
              </button>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.md,.json"
            onChange={handleUpload}
            className="block text-xs text-gray-500 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
          />
          {uploading && <p className="text-xs text-gray-400 mt-1">Uploading…</p>}
        </div>

        {/* AI analysis instruction (was "Annotation") */}
        <div className="border-t border-gray-100 pt-4">
          <label className="label">AI analysis instruction</label>
          <p className="text-[10px] text-gray-400 mb-1">
            Tell the AI what this data represents and how to interpret it. This instruction is sent with every analysis request.
          </p>
          <textarea
            className="input min-h-[90px] resize-y text-sm leading-relaxed"
            placeholder='e.g. "Questions 4–7 measure participant trust. Focus on contradictions between stated trust and observed behaviour."'
            value={annotation}
            onChange={e => setAnnotation(e.target.value)}
            onBlur={handleSaveAnnotation}
          />
          <p className="text-[10px] text-gray-400 mt-1">Auto-saved when you click away.</p>
        </div>

        {/* Delete slot */}
        <div className="border-t border-gray-100 pt-4">
          {confirmDelete ? (
            <div className="flex gap-2">
              <button className="btn-danger flex-1 justify-center text-xs" onClick={handleDeleteSlot}>
                Yes, delete slot
              </button>
              <button className="btn-secondary flex-1 justify-center text-xs" onClick={() => setConfirmDelete(false)}>
                Cancel
              </button>
            </div>
          ) : (
            <button
              className="text-xs text-red-400 hover:text-red-600 hover:underline"
              onClick={() => setConfirmDelete(true)}
            >
              Delete this slot
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
