import { create } from 'zustand'
import type { StudyParticipant, AnalysisRequest, ParticipantDataFile } from '../types'
import * as api from '../api/participants'

interface WorkspaceState {
  participant: StudyParticipant | null
  analysisRequests: AnalysisRequest[]
  loading: boolean
  error: string | null

  fetchWorkspace: (participantId: string) => Promise<void>
  refreshFiles: () => Promise<void>
  refreshAnalysis: () => Promise<void>
  pollRequest: (requestId: string) => void
  uploadFile: (slotId: string, file: File) => Promise<ParticipantDataFile>
  updateFile: (fileId: string, data: { custom_prompt?: string; included_in_analysis?: boolean }) => Promise<void>
  deleteFile: (fileId: string) => Promise<void>
  submitAnalysis: (label: string, mode: string, fileIds: string[], customPrompt?: string) => Promise<string>
  deleteAnalysisRequest: (requestId: string) => Promise<void>
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  participant: null,
  analysisRequests: [],
  loading: false,
  error: null,

  fetchWorkspace: async (participantId) => {
    set({ loading: true, error: null })
    try {
      const [participant, requests] = await Promise.all([
        api.getParticipant(participantId),
        api.getAnalysisRequests(participantId),
      ])
      set({ participant, analysisRequests: requests, loading: false })
    } catch (e: any) {
      // 404 means the participant no longer exists (e.g. Render redeployed and
      // wiped the ephemeral SQLite DB). Signal this specifically so the workspace
      // page can redirect the user back to the session setup screen.
      const is404 = e?.response?.status === 404
      set({
        error: is404 ? 'PARTICIPANT_NOT_FOUND' : e.message,
        loading: false,
      })
    }
  },

  refreshFiles: async () => {
    const pid = get().participant?.id
    if (!pid) return
    const participant = await api.getParticipant(pid)
    set({ participant })
  },

  refreshAnalysis: async () => {
    const pid = get().participant?.id
    if (!pid) return
    const requests = await api.getAnalysisRequests(pid)
    set({ analysisRequests: requests })
  },

  pollRequest: (requestId) => {
    const interval = setInterval(async () => {
      try {
        const updated = await api.getAnalysisRequest(requestId)
        set((s) => ({
          analysisRequests: s.analysisRequests.map((r) =>
            r.id === requestId ? updated : r
          ),
        }))
        if (updated.status === 'complete' || updated.status === 'error') {
          clearInterval(interval)
        }
      } catch {
        clearInterval(interval)
      }
    }, 3000)
  },

  uploadFile: async (slotId, file) => {
    const pid = get().participant?.id
    if (!pid) throw new Error('No participant loaded')
    const pf = await api.uploadFile(pid, slotId, file)
    set((s) => ({
      participant: s.participant
        ? { ...s.participant, data_files: [...s.participant.data_files, pf] }
        : s.participant,
    }))
    return pf
  },

  updateFile: async (fileId, data) => {
    const updated = await api.updateFile(fileId, data)
    set((s) => ({
      participant: s.participant
        ? {
            ...s.participant,
            data_files: s.participant.data_files.map((f) =>
              f.id === fileId ? updated : f
            ),
          }
        : s.participant,
    }))
  },

  deleteFile: async (fileId) => {
    await api.deleteFile(fileId)
    set((s) => ({
      participant: s.participant
        ? {
            ...s.participant,
            data_files: s.participant.data_files.filter((f) => f.id !== fileId),
          }
        : s.participant,
    }))
  },

  submitAnalysis: async (label, mode, fileIds, customPrompt) => {
    const pid = get().participant?.id
    if (!pid) throw new Error('No participant loaded')
    const result = await api.submitAnalysis(pid, label, mode, fileIds, customPrompt)
    // Add placeholder request to state; polling will fill in findings
    const placeholder: AnalysisRequest = {
      id: result.id,
      participant_id: pid,
      label,
      mode: mode as 'findings' | 'suggestions',
      status: 'queued',
      custom_prompt: customPrompt || null,
      position: get().analysisRequests.length,
      created_at: new Date().toISOString(),
      completed_at: null,
      findings: [],
      suggestions: [],
    }
    set((s) => ({ analysisRequests: [...s.analysisRequests, placeholder] }))
    get().pollRequest(result.id)
    return result.id
  },

  deleteAnalysisRequest: async (requestId) => {
    await api.deleteAnalysisRequest(requestId)
    set((s) => ({
      analysisRequests: s.analysisRequests.filter((r) => r.id !== requestId),
    }))
  },
}))
