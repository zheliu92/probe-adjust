import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Mode } from '../types'

interface SessionState {
  participantId: string
  sessionId: string          // "{participantId}_{compactTimestamp}" — used as log file key
  mode: Mode | null
  studyParticipantId: string | null

  setParticipantId: (id: string) => void
  setStage2: (mode: Mode, studyParticipantId: string) => void
  clear: () => void
}

function compactTimestamp() {
  // Build the regex dynamically so Tailwind's content scanner
  // doesn't pick up the character class as a CSS utility candidate.
  const isoChars = new RegExp('[' + '\\-:.TZ' + ']', 'g')
  return new Date().toISOString().replace(isoChars, '').slice(0, 15)
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set, _get) => ({
      participantId: '',
      sessionId: '',
      mode: null,
      studyParticipantId: null,

      setParticipantId: (id) => {
        const sessionId = `${id}_${compactTimestamp()}`
        set({ participantId: id, sessionId })
      },

      setStage2: (mode, studyParticipantId) => {
        set({ mode, studyParticipantId })
      },

      clear: () =>
        set({ participantId: '', sessionId: '', mode: null, studyParticipantId: null }),
    }),
    { name: 'probe-adjust-session', partialize: (s) => ({ participantId: s.participantId, sessionId: s.sessionId, mode: s.mode, studyParticipantId: s.studyParticipantId }) }
  )
)
