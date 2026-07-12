// HashRouter is used so that deep-linked URLs work on GitHub Pages without
// server-side configuration. Locally it works identically to BrowserRouter.
// Paths become /#/design, /#/conduct, etc.
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { SessionEntryPage } from './pages/SessionEntryPage'
import { StudyDesignPage } from './pages/StudyDesignPage'
import { TransitionPage } from './pages/TransitionPage'
import { ParticipantWorkspacePage } from './pages/ParticipantWorkspacePage'
import { InterviewReadyPage } from './pages/InterviewReadyPage'
import { ToastContainer } from './components/shared/Toast'

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<SessionEntryPage />} />
        <Route path="/design" element={<StudyDesignPage />} />
        <Route path="/conduct" element={<TransitionPage />} />
        <Route path="/workspace/:participantId" element={<ParticipantWorkspacePage />} />
        <Route path="/workspace/:participantId/interview" element={<InterviewReadyPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ToastContainer />
    </HashRouter>
  )
}
