// src/features/Menu/ItemCard.jsx
import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Trash2, Pencil, Plus, Image as ImageIcon } from 'lucide-react'
import { fmtVND } from '../../utils/helpers'

export default function ItemCard({ m, onEdit, onDelete, onAdd, canAdd, canManage }) {
  // State để kiểm tra ảnh đã tải xong chưa
  const [imageLoaded, setImageLoaded] = useState(false)

  return (
    <motion.div 
      whileHover={{ y: -2 }} 
      className="bg-white rounded-lg border border-slate-200 overflow-hidden flex flex-col h-full hover:shadow-md transition-all group relative"
    >
      {/* ẢNH */}
      <div className="relative w-full aspect-square bg-slate-100 overflow-hidden">
        
        {/* Lớp Placeholder Skeleton (Hiện khi ảnh chưa load xong) */}
        {!imageLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-200 animate-pulse z-0">
            <ImageIcon className="w-8 h-8 text-slate-400 opacity-50" />
          </div>
        )}

        <img
          src={m.thumbURL || m.imageURL}
          loading="lazy" 
          alt={m.name}
          onLoad={() => setImageLoaded(true)}
          className={`w-full h-full object-cover transition-opacity duration-500 z-10 relative ${
            imageLoaded ? 'opacity-100' : 'opacity-0'
          }`}
        />
        
        {/* Giá tiền */}
        <div className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-white/90 backdrop-blur text-emerald-800 font-bold text-[10px] rounded shadow-sm border border-slate-100 z-20">
          {(m.price/1000).toFixed(0)}k
        </div>

        {/* Badge Hết hàng */}
        {!m.is_available && (
           <div className="absolute inset-0 bg-black/40 flex items-center justify-center backdrop-blur-[1px] z-20">
             <span className="text-white text-[10px] font-bold border border-white px-2 py-0.5 rounded">HẾT</span>
           </div>
        )}

        {/* CHỈ HIỆN NÚT XÓA NẾU CÓ QUYỀN QUẢN LÝ (canManage = true) */}
        {canManage && (
          <button 
            onClick={(e) => { e.stopPropagation(); onDelete(m); }}
            className="absolute top-1 left-1 p-1 bg-white/90 text-rose-500 rounded-md opacity-0 group-hover:opacity-100 transition hover:bg-rose-500 hover:text-white z-20"
            title="Xóa"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        )}
        
        {/* CHỈ HIỆN NÚT SỬA NẾU CÓ QUYỀN QUẢN LÝ */}
        {canManage && (
          <button 
            onClick={(e) => { e.stopPropagation(); onEdit(m); }}
            className="absolute top-1 right-1 p-1 bg-white/90 text-slate-600 rounded-md opacity-0 group-hover:opacity-100 transition hover:bg-slate-100 hover:text-emerald-600 z-20"
            title="Sửa"
          >
            <Pencil className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* INFO DƯỚI */}
      <div className="p-1.5 flex flex-col flex-1">
        <div className="font-medium text-[11px] leading-tight text-slate-700 line-clamp-2 min-h-[2.2em]" title={m.name}>
          {m.name}
        </div>
        
        <div className="mt-1.5">
          <button
            onClick={() => onAdd(m)}
            disabled={!canAdd}
            className="w-full py-1 rounded bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-100 hover:bg-emerald-600 hover:text-white hover:border-emerald-600 active:scale-95 transition-all disabled:opacity-50 disabled:bg-slate-50 disabled:text-slate-400 disabled:border-slate-100 flex items-center justify-center gap-1"
          >
            <Plus className="w-3 h-3"/> THÊM
          </button>
        </div>
      </div>
    </motion.div>
  )
}