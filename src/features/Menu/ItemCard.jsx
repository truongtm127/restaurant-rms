import React, { useState } from 'react'
import { motion } from 'framer-motion'
// Thêm FlaskConical vào import
import { Trash2, Pencil, Plus, Image as ImageIcon, FlaskConical } from 'lucide-react'
import { fmtVND } from '../../utils/helpers'

export default function ItemCard({ m, onEdit, onDelete, onAdd, onRecipe, canAdd, canManage }) {
  const [imageLoaded, setImageLoaded] = useState(false)
  const [imgError, setImgError] = useState(false)

  // Ưu tiên: Thumb -> Ảnh gốc -> Ảnh cũ (nếu có)
  const finalImg = m.thumbURL || m.imageURL || m.image

  return (
    <motion.div 
      whileHover={{ y: -2 }} 
      className="bg-white rounded-lg border border-slate-200 overflow-hidden flex flex-col h-full hover:shadow-md transition-all group relative"
    >
      {/* KHUNG ẢNH */}
      <div className="relative w-full aspect-square bg-slate-100 overflow-hidden">
        
        {/* Placeholder khi đang tải hoặc lỗi */}
        {(!imageLoaded || imgError || !finalImg) && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-100 z-0">
            <ImageIcon className="w-8 h-8 text-slate-300" />
          </div>
        )}

        {/* Ảnh chính */}
        {finalImg && !imgError && (
          <img
            src={finalImg}
            loading="lazy" 
            alt={m.name}
            onLoad={() => setImageLoaded(true)}
            onError={() => setImgError(true)}
            className={`w-full h-full object-cover transition-opacity duration-500 z-10 relative ${
              imageLoaded ? 'opacity-100' : 'opacity-0'
            }`}
          />
        )}
        
        {/* Giá tiền */}
        <div className="absolute bottom-1 right-1 px-2 py-0.5 bg-white/90 backdrop-blur text-emerald-800 font-bold text-[10px] rounded shadow-sm border border-slate-100 z-20">
          {fmtVND(m.price)}
        </div>

        {/* Badge Hết hàng */}
        {!m.is_available && (
           <div className="absolute inset-0 bg-black/40 flex items-center justify-center backdrop-blur-[1px] z-20">
             <span className="text-white text-[10px] font-bold border border-white px-2 py-0.5 rounded">HẾT HÀNG</span>
           </div>
        )}

        {/* --- ACTION BUTTONS (ADMIN) --- */}
        {canManage && (
          <>
            {/* Nút Xóa (Góc trái trên) */}
            <button 
              onClick={(e) => { e.stopPropagation(); onDelete(m) }}
              className="absolute top-1 left-1 p-1.5 bg-white/90 text-rose-500 rounded-md opacity-0 group-hover:opacity-100 transition hover:bg-rose-500 hover:text-white z-30 shadow-sm"
              title="Xóa món"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
            
            {/* Group Nút Sửa & Công thức (Góc phải trên) */}
            <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition z-30">
                {/* Nút Công Thức */}
                <button 
                  onClick={(e) => { e.stopPropagation(); onRecipe(m) }}
                  className="p-1.5 bg-white/90 text-purple-600 rounded-md hover:bg-purple-500 hover:text-white shadow-sm transition-colors"
                  title="Định lượng / Công thức"
                >
                  <FlaskConical className="w-3.5 h-3.5" />
                </button>

                {/* Nút Sửa */}
                <button 
                  onClick={(e) => { e.stopPropagation(); onEdit(m) }}
                  className="p-1.5 bg-white/90 text-slate-600 rounded-md hover:bg-emerald-600 hover:text-white shadow-sm transition-colors"
                  title="Chỉnh sửa thông tin"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
            </div>
          </>
        )}
      </div>

      {/* THÔNG TIN */}
      <div className="p-2 flex flex-col flex-1 bg-white">
        <div className="font-medium text-[11px] leading-tight text-slate-700 line-clamp-2 min-h-[2.2em]" title={m.name}>
          {m.name}
        </div>
        
        <div className="mt-2 pt-2 border-t border-slate-50">
          <button
            onClick={() => m.is_available && onAdd(m)}
            disabled={!canAdd || !m.is_available}
            className={`w-full py-1.5 rounded text-[10px] font-bold border flex items-center justify-center gap-1.5 transition-all active:scale-95
              ${canAdd && m.is_available 
                ? 'bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-600 hover:text-white hover:border-emerald-600' 
                : 'bg-slate-50 text-slate-400 border-slate-100 cursor-not-allowed'}`}
          >
            <Plus className="w-3 h-3"/> THÊM
          </button>
        </div>
      </div>
    </motion.div>
  )
}