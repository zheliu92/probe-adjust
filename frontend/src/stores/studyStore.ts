import { create } from 'zustand'
import type { Study, Block } from '../types'
import * as api from '../api/studies'

interface StudyState {
  study: Study | null
  loading: boolean
  error: string | null

  fetchStudy: (id: string) => Promise<void>
  addBlock: (type: string, label: string) => Promise<void>
  updateBlockLabel: (blockId: string, label: string) => Promise<void>
  deleteBlock: (blockId: string) => Promise<void>
  reorderBlocks: (newOrder: string[]) => Promise<void>
  refreshStudy: () => Promise<void>
}

export const useStudyStore = create<StudyState>((set, get) => ({
  study: null,
  loading: false,
  error: null,

  fetchStudy: async (id) => {
    set({ loading: true, error: null })
    try {
      const study = await api.getStudy(id)
      set({ study, loading: false })
    } catch (e: any) {
      set({ error: e.message, loading: false })
    }
  },

  refreshStudy: async () => {
    const id = get().study?.id
    if (id) await get().fetchStudy(id)
  },

  addBlock: async (type, label) => {
    const studyId = get().study?.id
    if (!studyId) return
    const block = await api.addBlock(studyId, type, label)
    set((s) => ({
      study: s.study
        ? { ...s.study, blocks: [...s.study.blocks, block] }
        : s.study,
    }))
  },

  updateBlockLabel: async (blockId, label) => {
    await api.updateBlock(blockId, { label })
    set((s) => ({
      study: s.study
        ? {
            ...s.study,
            blocks: s.study.blocks.map((b) =>
              b.id === blockId ? { ...b, label } : b
            ),
          }
        : s.study,
    }))
  },

  deleteBlock: async (blockId) => {
    await api.deleteBlock(blockId)
    set((s) => ({
      study: s.study
        ? {
            ...s.study,
            blocks: s.study.blocks
              .filter((b) => b.id !== blockId)
              .map((b, i) => ({ ...b, position: i })),
          }
        : s.study,
    }))
  },

  reorderBlocks: async (newOrder) => {
    const studyId = get().study?.id
    if (!studyId) return
    // Optimistic update
    set((s) => {
      if (!s.study) return s
      const blockMap = Object.fromEntries(s.study.blocks.map((b) => [b.id, b]))
      const reordered = newOrder
        .map((id, i) => (blockMap[id] ? { ...blockMap[id], position: i } : null))
        .filter(Boolean) as Block[]
      return { study: { ...s.study, blocks: reordered } }
    })
    await api.reorderBlocks(studyId, newOrder)
  },
}))
