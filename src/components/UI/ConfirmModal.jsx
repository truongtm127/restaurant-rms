import React from 'react'

export default function ConfirmModal({ isOpen, onClose, onConfirm, title, message }) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-5 scale-100 transition-all">
        <h3 className="text-lg font-bold text-slate-800 mb-2">{title}</h3>
        
        {/* [SỬA LỖI] Thay thẻ <p> thành <div> để có thể chứa nội dung HTML/Div con */}
        <div className="text-sm text-slate-600 mb-6 leading-relaxed">
          {message}
        </div>
        
        <div className="flex gap-3 justify-end">
          <button 
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-slate-600 font-bold hover:bg-slate-100 transition"
          >
            Hủy
          </button>
          <button 
            onClick={() => { onConfirm(); onClose() }}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-700 shadow-md transition"
          >
            Đồng ý
          </button>
        </div>
      </div>
    </div>
  )
}