/**
 * BaselineDataPanel — shown in the center column when mode = 'baseline'.
 *
 * Files are added cumulatively by the user clicking file rows in the
 * CompactCanvasPanel. Each open file is shown as a card with:
 *   - header: filename + close button
 *   - body: line-numbered content (mirrors FileViewerModal), max-height with
 *     independent scroll so long files don't push other cards off-screen
 *
 * The entire card list is also scrollable when multiple cards are open.
 */
import { useEffect, useState } from 'react'
import { getFileContent } from '../../api/participants'
import type { FileLine } from '../../types'

interface OpenFile {
  fileId: string
  fileName: string
}

interface FileCardProps {
  file: OpenFile
  onClose: (fileId: string) => void
}

function FileCard({ file, onClose }: FileCardProps) {
  const [lines, setLines] = useState<FileLine[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    getFileContent(file.fileId)
      .then(data => setLines(data.lines))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [file.fileId])

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white shrink-0">
      {/* Card header */}
      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-200">
        <span className="text-xs font-semibold text-gray-700 truncate flex-1 mr-2">
          📄 {file.fileName}
        </span>
        <button
          onClick={() => onClose(file.fileId)}
          className="text-gray-400 hover:text-gray-600 text-sm leading-none shrink-0"
          title="Close"
        >
          ✕
        </button>
      </div>

      {/* Card body — independently scrollable, fixed max-height ~200px */}
      <div className="overflow-y-auto max-h-52 bg-gray-50">
        {loading && (
          <div className="flex items-center justify-center py-6 text-gray-400 text-xs">
            Loading…
          </div>
        )}
        {error && (
          <div className="px-3 py-3 text-red-500 text-xs">
            Failed to load: {error}
          </div>
        )}
        {!loading && !error && (
          <table className="w-full border-collapse font-mono text-xs">
            <tbody>
              {lines.map(line => (
                <tr key={line.n} className="hover:bg-gray-100">
                  <td className="select-none text-right text-gray-400 pr-3 pl-2 w-8 py-0.5 align-top">
                    {line.n}
                  </td>
                  <td className="whitespace-pre-wrap break-all text-gray-800 pr-2 py-0.5 align-top">
                    {line.text}
                  </td>
                </tr>
              ))}
              {lines.length === 0 && (
                <tr>
                  <td colSpan={2} className="px-3 py-4 text-gray-400 text-center italic">
                    Empty file
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

interface Props {
  openFiles: OpenFile[]
  onClose: (fileId: string) => void
}

export function BaselineDataPanel({ openFiles, onClose }: Props) {
  if (openFiles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-6 gap-3">
        <div className="text-4xl opacity-20">📂</div>
        <p className="text-sm text-gray-400 font-medium">No files open</p>
        <p className="text-xs text-gray-400">
          Click any data file in the left panel to preview it here.
          Multiple files can be open at once.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {openFiles.map(f => (
          <FileCard key={f.fileId} file={f} onClose={onClose} />
        ))}
      </div>
    </div>
  )
}

// Export the OpenFile type so the parent can manage state
export type { OpenFile }
