import { useEffect, useState } from 'react'
import { getFileContent } from '../../api/participants'
import { getTemplateContent } from '../../api/studies'
import { logEvent } from '../../api/log'
import type { FileLine, ViewerTarget } from '../../types'

interface Props {
  target: ViewerTarget | null
  onClose: () => void
  /** If true, fileId is a slot ID and we load the template via /slots/{id}/template */
  isTemplate?: boolean
}

export function FileViewerModal({ target, onClose, isTemplate = false }: Props) {
  const [lines, setLines] = useState<FileLine[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!target) return
    setLoading(true)
    setError(null)

    // Route to template endpoint or participant file endpoint
    const fetcher = isTemplate
      ? getTemplateContent(target.fileId)
      : getFileContent(target.fileId)

    fetcher
      .then((data) => {
        setLines(data.lines)
        setLoading(false)
        logEvent('file_opened', {
          file_id: target.fileId,
          file_name: target.fileName,
          context: target.context,
          ...(target.citationFindingId ? { finding_id: target.citationFindingId } : {}),
          ...(target.citationRef ? { citation_ref: target.citationRef } : {}),
        })
      })
      .catch((e) => {
        setError(e.message)
        setLoading(false)
      })
  }, [target?.fileId])

  // Scroll to highlighted line after render
  useEffect(() => {
    if (target?.highlightLine) {
      const el = document.getElementById(`line-${target.highlightLine}`)
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }
  }, [lines, target?.highlightLine])

  if (!target) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-[90vw] max-w-4xl h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <div>
            <span className="font-semibold text-gray-800">{target.fileName}</span>
            {target.context === 'citation' && target.citationRef && (
              <span className="ml-2 text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                {target.citationRef}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
            aria-label="Close viewer"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto p-4 font-mono text-sm bg-gray-50">
          {loading && (
            <div className="flex items-center justify-center h-full text-gray-400">
              Loading…
            </div>
          )}
          {error && (
            <div className="text-red-500 p-4">Failed to load file: {error}</div>
          )}
          {!loading && !error && (
            <table className="w-full border-collapse">
              <tbody>
                {lines.map((line) => {
                  const isHighlight = line.n === target.highlightLine
                  return (
                    <tr
                      key={line.n}
                      id={`line-${line.n}`}
                      className={isHighlight ? 'bg-yellow-200' : 'hover:bg-gray-100'}
                    >
                      <td className="select-none text-right text-gray-400 pr-4 w-10 text-xs pt-0.5">
                        {line.n}
                      </td>
                      <td className="whitespace-pre-wrap break-all text-gray-800">
                        {line.text}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
