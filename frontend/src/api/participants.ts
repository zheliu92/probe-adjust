import client from './client'
import type { StudyParticipant, ParticipantDataFile, FileContent, AnalysisRequest } from '../types'

// ── Participants ──────────────────────────────────────────────────────────────
export const getParticipants = (studyId: string) =>
  client.get<StudyParticipant[]>(`/studies/${studyId}/participants`).then(r => r.data)
export const createParticipant = (studyId: string, label: string) =>
  client.post<StudyParticipant>(`/studies/${studyId}/participants`, { label }).then(r => r.data)
export const getParticipant = (participantId: string) =>
  client.get<StudyParticipant>(`/participants/${participantId}`).then(r => r.data)
export const deleteParticipant = (participantId: string) =>
  client.delete(`/participants/${participantId}`)

/** Upload a zip file; participant label is derived from zip filename on the server. */
export const uploadParticipantZip = (studyId: string, zipFile: File) => {
  const fd = new FormData()
  fd.append('file', zipFile)
  return client
    .post<StudyParticipant>(`/studies/${studyId}/participants/upload-zip`, fd)
    .then(r => r.data)
}

// ── Files ─────────────────────────────────────────────────────────────────────
export const uploadFile = (participantId: string, slotId: string, file: File) => {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('slot_id', slotId)
  return client.post<ParticipantDataFile>(`/participants/${participantId}/files`, fd).then(r => r.data)
}
export const getFileContent = (fileId: string) =>
  client.get<FileContent>(`/files/${fileId}/content`).then(r => r.data)
export const updateFile = (fileId: string, data: { custom_prompt?: string; included_in_analysis?: boolean }) =>
  client.put<ParticipantDataFile>(`/files/${fileId}`, data).then(r => r.data)
export const deleteFile = (fileId: string) => client.delete(`/files/${fileId}`)

// ── Protocol ──────────────────────────────────────────────────────────────────
export const getProtocol = (participantId: string) =>
  client.get<{ content: string; updated_at: string | null }>(`/participants/${participantId}/protocol`).then(r => r.data)
export const saveProtocol = (participantId: string, content: string) =>
  client.put(`/participants/${participantId}/protocol`, { content })
export const saveProtocolSnapshot = (participantId: string, sessionId: string, mode: string, content: string) =>
  client.post(`/participants/${participantId}/protocol/snapshot`, { session_id: sessionId, mode, content })

// ── Analysis ──────────────────────────────────────────────────────────────────
export const submitAnalysis = (
  participantId: string,
  label: string,
  mode: string,
  fileIds: string[],
  customPrompt?: string,
) =>
  client
    .post<{ id: string; status: string }>(`/participants/${participantId}/analysis/requests`, {
      label, mode, file_ids: fileIds, custom_prompt: customPrompt || null,
    })
    .then(r => r.data)

export const getAnalysisRequests = (participantId: string) =>
  client.get<AnalysisRequest[]>(`/participants/${participantId}/analysis/requests`).then(r => r.data)

export const getAnalysisRequest = (requestId: string) =>
  client.get<AnalysisRequest>(`/analysis/requests/${requestId}`).then(r => r.data)

export const deleteAnalysisRequest = (requestId: string) =>
  client.delete(`/analysis/requests/${requestId}`)
