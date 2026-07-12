import { useEffect, useRef, useState, useCallback } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { saveProtocol } from '../../api/participants'
import { toast } from '../shared/Toast'

interface Props {
  participantId: string
  initialContent: string
}

type SaveState = 'idle' | 'saving' | 'saved'

/**
 * Convert a plain-text interview protocol into structured TipTap HTML.
 *
 * Detection rules (applied per line):
 *  - ALL-CAPS line or line ending with "---" → <h2>
 *  - Line matching /^Q\d+\./ or /^--- .+ ---/ → <h3>
 *  - Empty line → paragraph break
 *  - Everything else → <p>
 *
 * If the content already contains HTML tags we leave it untouched.
 */
function enrichPlainText(raw: string): string {
  if (/<[a-z][\s\S]*>/i.test(raw)) return raw   // already HTML

  const lines = raw.split('\n')
  const parts: string[] = []

  for (const line of lines) {
    const t = line.trim()
    if (!t) {
      parts.push('<p></p>')
      continue
    }
    // Section header (all caps, or dashes separator)
    if (t === t.toUpperCase() && t.length > 2 && /[A-Z]/.test(t)) {
      parts.push(`<h2>${escHtml(t)}</h2>`)
      continue
    }
    if (/^---/.test(t) && /---$/.test(t)) {
      parts.push(`<h2>${escHtml(t.replace(/^-+\s*/, '').replace(/\s*-+$/, ''))}</h2>`)
      continue
    }
    // Question line
    if (/^Q\d+[.:)]/.test(t)) {
      parts.push(`<h3>${escHtml(t)}</h3>`)
      continue
    }
    // Probe / sub-item
    if (/^\[/.test(t) || /^Probe:/.test(t)) {
      parts.push(`<p><em>${escHtml(t)}</em></p>`)
      continue
    }
    parts.push(`<p>${escHtml(t)}</p>`)
  }

  return parts.join('')
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function ProtocolEditorPanel({ participantId, initialContent }: Props) {
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedContent = useRef('')

  const richContent = enrichPlainText(initialContent)

  const editor = useEditor({
    extensions: [StarterKit],
    content: richContent,
    editorProps: {
      attributes: {
        // prose-base for readable body size; custom spacing via CSS class
        class: 'protocol-editor focus:outline-none',
      },
    },
    onUpdate: ({ editor }) => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        handleSave(editor.getHTML())
      }, 2000)
    },
  })

  // Reinitialise when switching participants
  useEffect(() => {
    if (!editor) return
    const newRich = enrichPlainText(initialContent)
    if (newRich !== editor.getHTML()) {
      editor.commands.setContent(newRich)
      lastSavedContent.current = newRich
    }
  }, [participantId])  // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = useCallback(async (html: string) => {
    if (html === lastSavedContent.current) return
    setSaveState('saving')
    try {
      await saveProtocol(participantId, html)
      lastSavedContent.current = html
      setSaveState('saved')
      setSavedAt(new Date())
      setTimeout(() => setSaveState('idle'), 3000)
    } catch {
      setSaveState('idle')
      toast('Failed to save protocol', 'error')
    }
  }, [participantId])

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current) }, [])

  const toolbarButtons = editor ? [
    { label: 'B',      active: editor.isActive('bold'),              action: () => editor.chain().focus().toggleBold().run(),              title: 'Bold' },
    { label: 'I',      active: editor.isActive('italic'),            action: () => editor.chain().focus().toggleItalic().run(),            title: 'Italic' },
    { label: 'H2',     active: editor.isActive('heading', {level:2}),action: () => editor.chain().focus().toggleHeading({level:2}).run(), title: 'Section heading' },
    { label: 'H3',     active: editor.isActive('heading', {level:3}),action: () => editor.chain().focus().toggleHeading({level:3}).run(), title: 'Question heading' },
    { label: '• List', active: editor.isActive('bulletList'),        action: () => editor.chain().focus().toggleBulletList().run(),        title: 'Bullet list' },
    { label: '1. List',active: editor.isActive('orderedList'),       action: () => editor.chain().focus().toggleOrderedList().run(),       title: 'Ordered list' },
  ] : []

  return (
    <div className="flex flex-col h-full border-l border-gray-200 bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 shrink-0">
        <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wide">Interview Protocol</h2>
        <div className="text-[10px]">
          {saveState === 'saving' && <span className="text-indigo-500">Saving…</span>}
          {saveState === 'saved' && savedAt && (
            <span className="text-green-600">Saved {savedAt.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</span>
          )}
          {saveState === 'idle' && <span className="text-gray-400">Auto-saves</span>}
        </div>
      </div>

      {/* Formatting toolbar */}
      {editor && (
        <div className="flex gap-0.5 px-2 py-1.5 border-b border-gray-100 flex-wrap shrink-0 bg-gray-50">
          {toolbarButtons.map(({ label, active, action, title }) => (
            <button
              key={label}
              onClick={action}
              title={title}
              className={`text-xs px-2 py-0.5 rounded transition-colors ${
                active ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Editor body */}
      <div className="flex-1 overflow-y-auto">
        <EditorContent editor={editor} />
      </div>

      {/* Inline styles for the editor content */}
      <style>{`
        .protocol-editor {
          padding: 1.25rem 1.5rem;
          font-size: 0.9375rem;
          line-height: 1.8;
          color: #1f2937;
          min-height: 100%;
        }
        .protocol-editor h2 {
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
        .protocol-editor h2:first-child { margin-top: 0; }
        .protocol-editor h3 {
          font-size: 0.9375rem;
          font-weight: 700;
          color: #111827;
          margin-top: 1.25rem;
          margin-bottom: 0.25rem;
        }
        .protocol-editor p {
          margin-bottom: 0.5rem;
        }
        .protocol-editor em {
          color: #6b7280;
          font-style: italic;
        }
        .protocol-editor ul, .protocol-editor ol {
          padding-left: 1.5rem;
          margin-bottom: 0.75rem;
        }
        .protocol-editor li { margin-bottom: 0.25rem; }
        .protocol-editor strong { color: #111827; }
      `}</style>
    </div>
  )
}
