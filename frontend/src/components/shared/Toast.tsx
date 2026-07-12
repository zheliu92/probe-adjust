import { useState, useCallback } from 'react'

export interface ToastMessage {
  id: string
  text: string
  type: 'error' | 'success' | 'info'
}

let _addToast: ((msg: Omit<ToastMessage, 'id'>) => void) | null = null

export function toast(text: string, type: ToastMessage['type'] = 'info') {
  _addToast?.({ text, type })
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const add = useCallback((msg: Omit<ToastMessage, 'id'>) => {
    const id = Math.random().toString(36).slice(2)
    setToasts((prev) => [...prev, { ...msg, id }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000)
  }, [])

  // Register global handler
  _addToast = add

  const COLOR = {
    error: 'bg-red-600',
    success: 'bg-green-600',
    info: 'bg-gray-800',
  }

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`${COLOR[t.type]} text-white text-sm px-4 py-2 rounded-lg shadow-lg max-w-xs`}
        >
          {t.text}
        </div>
      ))}
    </div>
  )
}
