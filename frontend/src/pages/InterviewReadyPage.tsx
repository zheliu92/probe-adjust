import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getProtocol, getParticipant } from '../api/participants'
import { useSessionStore } from '../stores/sessionStore'
import type { StudyParticipant } from '../types'

const MODE_LABEL: Record<string, string> = {
  findings:    'Findings mode',
  suggestions: 'Suggestions mode',
  baseline:    'No AI baseline',
}

function htmlToPlainText(html: string): string {
  return html
    .replace(/<h[1-3][^>]*>/gi, '\n\n')
    .replace(/<\/h[1-3]>/gi, '\n')
    .replace(/<p[^>]*>/gi, '')
    .replace(/<\/p>/gi, '\n')
    .replace(/<li[^>]*>/gi, '  • ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Convert plain-text protocol content to structured HTML — same logic as
 * ProtocolEditorPanel's enrichPlainText(). Applied when the stored content
 * has no HTML tags (i.e. never been opened in the editor yet).
 */
function enrichPlainText(raw: string): string {
  if (/<[a-z][\s\S]*>/i.test(raw)) return raw  // already HTML — return as-is

  const lines = raw.split('\n')
  const parts: string[] = []

  for (const line of lines) {
    const t = line.trim()
    if (!t) { parts.push('<p></p>'); continue }

    // Section header: all-caps line or ---...--- separator
    if (t === t.toUpperCase() && t.length > 2 && /[A-Z]/.test(t)) {
      parts.push(`<h2>${esc(t)}</h2>`)
      continue
    }
    if (/^---/.test(t) && /---$/.test(t)) {
      parts.push(`<h2>${esc(t.replace(/^-+\s*/, '').replace(/\s*-+$/, ''))}</h2>`)
      continue
    }
    // Question line
    if (/^Q\d+[.:)]/.test(t)) {
      parts.push(`<h3>${esc(t)}</h3>`)
      continue
    }
    // Probe / sub-item
    if (/^\[/.test(t) || /^Probe:/.test(t)) {
      parts.push(`<p><em>${esc(t)}</em></p>`)
      continue
    }
    parts.push(`<p>${esc(t)}</p>`)
  }

  return parts.join('')
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function InterviewReadyPage() {
  const { participantId } = useParams<{ participantId: string }>()
  const navigate = useNavigate()
  const { mode } = useSessionStore()

  const [participant, setParticipant] = useState<StudyParticipant | null>(null)
  const [htmlContent, setHtmlContent] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!participantId) return
    Promise.all([
      getParticipant(participantId),
      getProtocol(participantId),
    ]).then(([p, proto]) => {
      setParticipant(p)
      setHtmlContent(proto.content ?? '')
    }).finally(() => setLoading(false))
  }, [participantId])

  function handleExport() {
    const plain = htmlToPlainText(htmlContent)
    const label = participant?.label ?? 'participant'
    const blob = new Blob([plain], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `interview_protocol_${label}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400">
        Loading protocol…
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4 print:hidden">
        <button
          className="text-sm text-indigo-500 hover:underline"
          onClick={() => navigate('/conduct')}
        >
          ← Back to session setup
        </button>
        <div className="flex-1" />
        {mode && (
          <span className="text-xs text-gray-400 italic">{MODE_LABEL[mode]}</span>
        )}
        <button className="btn-secondary text-xs" onClick={handleExport}>
          ↓ Export as .txt
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 max-w-2xl mx-auto w-full px-8 py-10">
        {/* Ready header */}
        <div className="mb-8 pb-6 border-b border-gray-200">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">🎤</span>
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                Ready to Interview — {participant?.label}
              </h1>
              <p className="text-sm text-gray-500">
                This is your adjusted interview protocol. Use it to guide the post-experience interview.
              </p>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-3 italic print:hidden">
            Tip: You can export this as a text file or print this page (Ctrl/Cmd + P) for a paper copy.
          </p>
        </div>

        {/* Protocol — enrich plain text to HTML if not already, then render read-only */}
        {htmlContent ? (
          <div
            className="protocol-view"
            dangerouslySetInnerHTML={{ __html: enrichPlainText(htmlContent) }}
          />
        ) : (
          <p className="text-gray-400 italic text-center py-12">
            No protocol content found. Go back and edit the protocol before starting the interview.
          </p>
        )}
      </div>

      {/* Print / read-only styles — mirrors ProtocolEditorPanel's .protocol-editor */}
      <style>{`
        .protocol-view {
          font-size: 0.9375rem;
          line-height: 1.8;
          color: #1f2937;
        }
        .protocol-view h2 {
          font-size: 0.875rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: #6b7280;
          margin-top: 1.75rem;
          margin-bottom: 0.5rem;
          padding-bottom: 0.25rem;
          border-bottom: 1px solid #e5e7eb;
        }
        .protocol-view h2:first-child { margin-top: 0; }
        .protocol-view h3 {
          font-size: 0.9375rem;
          font-weight: 700;
          color: #111827;
          margin-top: 1.25rem;
          margin-bottom: 0.25rem;
        }
        .protocol-view p { margin-bottom: 0.5rem; }
        .protocol-view em { color: #6b7280; font-style: italic; }
        .protocol-view strong { color: #111827; }
        .protocol-view ul, .protocol-view ol {
          padding-left: 1.5rem;
          margin-bottom: 0.75rem;
        }
        .protocol-view li { margin-bottom: 0.25rem; }
        @media print {
          .print\\:hidden { display: none !important; }
          .protocol-view { font-size: 11pt; line-height: 1.7; }
          .protocol-view h2 { font-size: 9pt; }
          .protocol-view h3 { font-size: 11pt; }
        }
      `}</style>
    </div>
  )
}
