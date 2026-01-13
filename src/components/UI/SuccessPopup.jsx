import React from 'react'
import { CheckCircle } from 'lucide-react'

export default function SuccessPopup({ message, onClose }) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      {/* Backdrop - Click ra ngoài để đóng */}
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" 
        onClick={onClose} 
      />

      {/* Modal Content */}
      <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-xl p-6 text-center animate-fadeIn">
        <div className="flex justify-center mb-3">
          <CheckCircle className="w-12 h-12 text-emerald-600" />
        </div>
        
        <h3 className="text-lg font-bold text-emerald-700 mb-2">
          Thành công
        </h3>
        
        <p className="text-slate-600 text-sm mb-6 leading-relaxed">
          {message}
        </p>
        
        <button
          onClick={onClose}
          className="w-full px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium transition-colors shadow-sm"
        >
          OK
        </button>
      </div>
    </div>
  )
}