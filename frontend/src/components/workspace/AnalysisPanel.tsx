import { useState } from 'react'
import type { AnalysisRequest, ParticipantDataFile, ViewerTarget, Mode } from '../../types'
import { useWorkspaceStore } from '../../stores/workspaceStore'
import { logEvent } from '../../api/log'
import { toast } from '../shared/Toast'

// ── Tension badge ─────────────────────────────────────────────────────────────
const TENSION_STYLE: Record<string, string> = {
  contradiction: 'bg-red-100 text-red-700 border-red-200',
  convergence:   'bg-green-100 text-green-700 border-green-200',
  anomaly:       'bg-yellow-100 text-yellow-800 border-yellow-200',
}
const TENSION_ICON: Record<string, string> = {
  contradiction: '⚡',
  convergence:   '🔗',
  anomaly:       '⚠',
}

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    queued:    'bg-gray-100 text-gray-500',
    analyzing: 'bg-blue-100 text-blue-700 animate-pulse',
    complete:  'bg-green-100 text-green-700',
    error:     'bg-red-100 text-red-600',
  }
  const labels: Record<string, string> = {
    queued: 'queued', analyzing: 'analysing…', complete: 'done', error: 'error',
  }
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${styles[status] ?? styles.queued}`}>
      {labels[status] ?? status}
    </span>
  )
}

// ── In-progress placeholder ───────────────────────────────────────────────────
function AnalysingPlaceholder({ status }: { status: string }) {
  return (
    <div className="py-5 px-3 text-center space-y-2">
      {status === 'queued' ? (
        <>
          <div className="text-2xl">⏳</div>
          <p className="text-sm text-gray-500 font-medium">Waiting in queue…</p>
          <p className="text-xs text-gray-400">This request is in line. Results will appear here once processing begins.</p>
        </>
      ) : (
        <>
          <div className="text-2xl animate-pulse">🔍</div>
          <p className="text-sm text-indigo-600 font-medium animate-pulse">Analysing your data…</p>
          <p className="text-xs text-gray-400">The system is reading your files and generating findings. This usually takes a few seconds.</p>
          <div className="flex justify-center gap-1 pt-1">
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-indigo-300 animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ── Citation link ─────────────────────────────────────────────────────────────
function CitationLink({ citation, findingId, onOpen }: {
  citation: AnalysisRequest['findings'][0]['citations'][0]
  findingId: string
  onOpen: (t: ViewerTarget) => void
}) {
  const lineVal =
    typeof citation.location?.value === 'number'
      ? citation.location.value
      : parseInt(String(citation.location?.value ?? '0'))

  return (
    <button
      className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full px-2 py-0.5 hover:bg-indigo-100 transition-colors disabled:opacity-40 disabled:cursor-default"
      disabled={!citation.file_id}
      title={citation.file_id ? 'Open source file at this location' : 'Source file not available'}
      onClick={() => {
        if (!citation.file_id) return
        logEvent('citation_clicked', { finding_id: findingId, citation_ref: citation.display_ref })
        onOpen({
          fileId: citation.file_id,
          fileName: citation.display_ref,
          highlightLine: isNaN(lineVal) ? undefined : lineVal,
          context: 'citation',
          citationFindingId: findingId,
          citationRef: citation.display_ref,
        })
      }}
    >
      🔗 {citation.display_ref}
    </button>
  )
}

// ── Suggestion card ───────────────────────────────────────────────────────────
function SuggestionCard({ s, requestLabel }: { s: AnalysisRequest['suggestions'][0]; requestLabel: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border border-purple-200 rounded-lg bg-purple-50">
      <button
        className="w-full text-left px-3 py-2 flex items-start gap-2 hover:bg-purple-100 rounded-lg"
        onClick={() => {
          setOpen(v => !v)
          if (!open) logEvent('suggestion_viewed', { suggestion_id: s.id, request_label: requestLabel })
        }}
      >
        <span className="text-purple-400 text-xs mt-0.5 shrink-0">{open ? '▾' : '▸'}</span>
        <span className="text-xs font-medium text-purple-800 leading-snug">
          💡 {s.description.slice(0, 90)}{s.description.length > 90 ? '…' : ''}
        </span>
      </button>
      {open && (
        <div className="px-3 pb-3 pt-1 border-t border-purple-100 space-y-1">
          <p className="text-sm text-purple-900 leading-relaxed">{s.description}</p>
          {s.protocol_ref && (
            <p className="text-xs text-purple-500 italic">→ Protocol: {s.protocol_ref}</p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Finding card ──────────────────────────────────────────────────────────────
function FindingCard({ f, onOpenViewer }: {
  f: AnalysisRequest['findings'][0]
  onOpenViewer: (t: ViewerTarget) => void
}) {
  const [open, setOpen] = useState(false)
  const tension = f.tension_type ?? 'anomaly'
  return (
    <div className="border border-gray-200 rounded-lg bg-white">
      <button
        className="w-full text-left px-3 py-2.5 flex items-start gap-2 hover:bg-gray-50 rounded-lg"
        onClick={() => {
          setOpen(v => !v)
          if (!open) logEvent('finding_viewed', { finding_id: f.id, finding_title: f.title })
        }}
      >
        <span className="text-gray-400 text-xs mt-0.5 shrink-0">{open ? '▾' : '▸'}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800 leading-snug">{f.title}</p>
          <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded border mt-1 ${TENSION_STYLE[tension]}`}>
            {TENSION_ICON[tension]} {tension}
          </span>
        </div>
      </button>
      {open && (
        <div className="px-3 pb-3 pt-1 border-t border-gray-100 space-y-2">
          <p className="text-sm text-gray-700 leading-relaxed">{f.explanation}</p>
          {f.citations.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {f.citations.map(c => (
                <CitationLink key={c.id} citation={c} findingId={f.id} onOpen={onOpenViewer} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Result block (one per request) ───────────────────────────────────────────
function ResultBlock({ req, mode, onOpenViewer }: {
  req: AnalysisRequest
  mode: Mode
  onOpenViewer: (t: ViewerTarget) => void
}) {
  const { deleteAnalysisRequest } = useWorkspaceStore()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="card mb-3 overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-gray-50 select-none"
        onClick={() => setCollapsed(v => !v)}
      >
        <span className="text-gray-400 text-xs">{collapsed ? '▸' : '▾'}</span>
        <span className="flex-1 text-sm font-semibold text-gray-800 truncate">{req.label}</span>
        <StatusBadge status={req.status} />
        {req.completed_at && (
          <span className="text-[10px] text-gray-400 shrink-0">
            {new Date(req.completed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
        <button
          className="text-gray-300 hover:text-red-400 text-xs ml-1 shrink-0"
          title="Remove this result"
          onClick={e => { e.stopPropagation(); deleteAnalysisRequest(req.id) }}
        >
          ✕
        </button>
      </div>

      {!collapsed && (
        <div className="border-t border-gray-100">
          {/* In-progress */}
          {(req.status === 'queued' || req.status === 'analyzing') && (
            <AnalysingPlaceholder status={req.status} />
          )}

          {/* Error */}
          {req.status === 'error' && (
            <div className="px-3 py-3 text-sm text-red-500">
              Analysis failed. Check the backend logs and try again.
            </div>
          )}

          {/* Complete */}
          {req.status === 'complete' && (
            <div className="px-3 pb-3 pt-2 space-y-3">
              {/* Findings */}
              <div>
                <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">
                  Findings ({req.findings.length})
                </h4>
                {req.findings.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">No findings returned for this request.</p>
                ) : (
                  <div className="space-y-1.5">
                    {req.findings.map(f => (
                      <FindingCard key={f.id} f={f} onOpenViewer={onOpenViewer} />
                    ))}
                  </div>
                )}
              </div>

              {/* Suggestions (suggestions mode only) */}
              {mode === 'suggestions' && req.suggestions.length > 0 && (
                <div>
                  <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">
                    Protocol suggestions ({req.suggestions.length})
                  </h4>
                  <div className="space-y-1.5">
                    {req.suggestions.map(s => (
                      <SuggestionCard key={s.id} s={s} requestLabel={req.label} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Analysis request form ─────────────────────────────────────────────────────
function RequestForm({ files, onSubmit }: {
  files: ParticipantDataFile[]
  onSubmit: (label: string, fileIds: string[], prompt: string) => Promise<void>
}) {
  const [label, setLabel] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set(files.map(f => f.id)))
  const [prompt, setPrompt] = useState('')
  const [showPrompt, setShowPrompt] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Keep selection in sync when new files are added
  const toggleFile = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      const nowIncluded = !next.has(id) // about to add
      next.has(id) ? next.delete(id) : next.add(id)
      logEvent('source_toggled', { source_id: id, action: nowIncluded ? 'include' : 'exclude' })
      return next
    })
  }

  async function handleSubmit() {
    const trimmed = label.trim()
    if (!trimmed) return
    if (selected.size === 0) { toast('Select at least one data file', 'error'); return }
    setSubmitting(true)
    try {
      await onSubmit(trimmed, Array.from(selected), prompt.trim())
      setLabel('')
      setPrompt('')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="card p-3 mb-4 bg-gray-50 border-gray-200">
      <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">New analysis request</h3>

      <div className="space-y-2.5">
        {/* Label */}
        <input
          className="input text-sm"
          placeholder='Label, e.g. "Trust vs. error rate"'
          value={label}
          onChange={e => setLabel(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
        />

        {/* File selection */}
        <div>
          <p className="label mb-1">Data sources to include</p>
          {files.length === 0 ? (
            <p className="text-xs text-gray-400 italic">No data files uploaded for this participant yet.</p>
          ) : (
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {files.map(f => (
                <label key={f.id} className="flex items-center gap-2 text-xs cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={selected.has(f.id)}
                    onChange={() => toggleFile(f.id)}
                    className="rounded"
                  />
                  <span className="text-gray-700 truncate">{f.file_name}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Custom prompt */}
        <button
          className="text-xs text-indigo-500 hover:underline flex items-center gap-1"
          onClick={() => setShowPrompt(v => !v)}
        >
          {showPrompt ? '▾' : '▸'} Add custom focus prompt (optional)
        </button>
        {showPrompt && (
          <textarea
            className="input text-sm min-h-[60px] resize-y"
            placeholder='e.g. "Focus on whether trust ratings align with task error patterns"'
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
          />
        )}

        {/* Submit — ALWAYS enabled; mock returns results after 5s */}
        <button
          className="btn-primary w-full justify-center"
          onClick={handleSubmit}
          disabled={submitting || !label.trim()}
        >
          {submitting ? 'Submitting…' : '▶ Analyse'}
        </button>

        {files.length === 0 && (
          <p className="text-[10px] text-amber-600 text-center">
            Upload participant data first (left panel) to include real files in the analysis.
          </p>
        )}
      </div>
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────
interface Props {
  mode: Mode
  participantFiles: ParticipantDataFile[]
  requests: AnalysisRequest[]
  onOpenViewer: (t: ViewerTarget) => void
}

export function AnalysisPanel({ mode, participantFiles, requests, onOpenViewer }: Props) {
  const { submitAnalysis } = useWorkspaceStore()

  async function handleSubmit(label: string, fileIds: string[], prompt: string) {
    await submitAnalysis(label, mode === 'baseline' ? 'findings' : mode, fileIds, prompt || undefined)
    logEvent('analysis_triggered', {
      request_label: label,
      sources_included: fileIds,
      custom_prompt: prompt || null,
    })
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto p-3">
        <RequestForm files={participantFiles} onSubmit={handleSubmit} />

        {requests.length === 0 ? (
          <div className="text-center py-10 space-y-2">
            <p className="text-2xl">📋</p>
            <p className="text-sm text-gray-500 font-medium">No analysis requests yet</p>
            <p className="text-xs text-gray-400">Fill in the form above and click Analyse to get started.</p>
          </div>
        ) : (
          requests.map(req => (
            <ResultBlock key={req.id} req={req} mode={mode} onOpenViewer={onOpenViewer} />
          ))
        )}
      </div>
    </div>
  )
}
