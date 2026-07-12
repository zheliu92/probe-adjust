import client from './client'
import type { Study, StudySummary, Block, DataSlot, Annotation } from '../types'

// ── Studies ───────────────────────────────────────────────────────────────────
export const getStudies = () => client.get<StudySummary[]>('/studies').then(r => r.data)
export const getStudy = (id: string) => client.get<Study>(`/studies/${id}`).then(r => r.data)
export const createStudy = (title: string, description = '') =>
  client.post<Study>('/studies', { title, description }).then(r => r.data)
export const updateStudy = (id: string, data: { title?: string; description?: string }) =>
  client.put<Study>(`/studies/${id}`, data).then(r => r.data)
export const deleteStudy = (id: string) => client.delete(`/studies/${id}`)

// ── Blocks ────────────────────────────────────────────────────────────────────
export const addBlock = (studyId: string, type: string, label: string) =>
  client.post<Block>(`/studies/${studyId}/blocks`, { type, label }).then(r => r.data)
export const updateBlock = (blockId: string, data: { label?: string; type?: string }) =>
  client.put<Block>(`/blocks/${blockId}`, data).then(r => r.data)
export const deleteBlock = (blockId: string) => client.delete(`/blocks/${blockId}`)
export const reorderBlocks = (studyId: string, blockIds: string[]) =>
  client.post(`/studies/${studyId}/blocks/reorder`, { block_ids: blockIds })

// ── Slots (slot_kind removed) ─────────────────────────────────────────────────
export const addSlot = (blockId: string, data: {
  name: string; data_type: string; data_nature: string
}) => client.post<DataSlot>(`/blocks/${blockId}/slots`, data).then(r => r.data)
export const updateSlot = (slotId: string, data: Partial<DataSlot>) =>
  client.put<DataSlot>(`/slots/${slotId}`, data).then(r => r.data)
export const deleteSlot = (slotId: string) => client.delete(`/slots/${slotId}`)
export const uploadTemplate = (slotId: string, file: File) => {
  const fd = new FormData()
  fd.append('file', file)
  return client.post<DataSlot>(`/slots/${slotId}/template`, fd).then(r => r.data)
}
export const getTemplateContent = (slotId: string) =>
  client.get(`/slots/${slotId}/template`).then(r => r.data)

// ── Annotations ───────────────────────────────────────────────────────────────
export const upsertAnnotation = (slotId: string, content: string) =>
  client.post<Annotation>(`/slots/${slotId}/annotation`, { content }).then(r => r.data)
export const deleteAnnotation = (slotId: string) =>
  client.delete(`/slots/${slotId}/annotation`)
