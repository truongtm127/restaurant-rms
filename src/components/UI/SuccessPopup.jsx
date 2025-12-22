import React from 'react'
import { CheckCircle } from 'lucide-react'

export default function SuccessPopup({ message, onClose }) {
  return (
    <div className="fixed inset-0 z-[200]">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm text-center animate-fadeIn">
          <CheckCircle className="w-12 h-12 text-emerald-600 mx-auto mb-3" />
          <div className="text-lg font-semibold text-emerald-700 mb-1">
            Thành công
          </div>
          <div className="text-slate-600 text-sm mb-4">
            {message}
          </div>
          <button
            className="px-4 py-2 rounded-lg bg-emerald-600 text-white w-full"
            onClick={onClose}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  )
}