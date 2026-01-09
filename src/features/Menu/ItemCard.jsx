import React, { useState } from 'react'
import { Edit, Trash2, ChefHat, Plus, Image as ImageIcon } from 'lucide-react'

// Helper format tiền (nếu chưa có file helpers thì dùng hàm này)
const fmtVND = (num) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(num)

export default function ItemCard({ m, onEdit, onDelete, onAdd, onRecipe, canAdd, canManage }) {
  const [imageLoaded, setImageLoaded] = useState(false)
  const [imgError, setImgError] = useState(false)

  // Ưu tiên: Thumb -> Ảnh gốc -> Ảnh cũ
  const finalImg = m.thumbURL || m.imageURL || m.image

  // Hàm ngăn chặn sự kiện click lan ra ngoài (để không kích hoạt thêm món khi bấm sửa)
  const stopProp = (e, action) => {
    e.stopPropagation()
    action()
  }

  return (
    <div 
      onClick={() => canAdd && m.is_available && onAdd(m)}
      className={`
        relative flex flex-col bg-white rounded-2xl shadow-sm border border-slate-200 
        overflow-hidden transition-all duration-200 h-full
        ${canAdd ? 'cursor-pointer active:scale-95' : ''}
        ${!m.is_available ? 'opacity-60 grayscale' : ''}
      `}
    >
      {/* 1. KHUNG ẢNH */}
      <div className="relative w-full aspect-square bg-slate-100 overflow-hidden">
        
        {/* Placeholder */}
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
        
        {/* Giá tiền (Badge) */}
        <div className="absolute bottom-2 left-2 px-3 py-1 bg-white/95 backdrop-blur text-emerald-800 font-bold text-xs rounded-lg shadow-sm border border-emerald-100 z-20">
          {fmtVND(m.price)}
        </div>

        {/* Badge Hết hàng */}
        {!m.is_available && (
           <div className="absolute inset-0 bg-black/40 flex items-center justify-center backdrop-blur-[1px] z-20">
             <span className="bg-rose-600 text-white px-3 py-1 rounded-lg text-xs font-bold uppercase shadow-lg transform -rotate-12 border border-white">
               Tạm ngưng
             </span>
           </div>
        )}

        {/* --- [TABLET FIX] BUTTONS QUẢN LÝ (LUÔN HIỆN) --- */}
        {canManage && (
          <div className="absolute top-2 right-2 flex flex-col gap-2 z-30">
             {/* Nút Sửa */}
             <button 
                onClick={(e) => stopProp(e, () => onEdit(m))}
                className="w-9 h-9 bg-white text-blue-600 rounded-full shadow-md flex items-center justify-center hover:bg-blue-600 hover:text-white transition-colors border border-blue-100"
                title="Sửa món"
             >
                <Edit size={18} />
             </button>
             
             {/* Nút Công thức */}
             <button 
                onClick={(e) => stopProp(e, () => onRecipe(m))}
                className={`w-9 h-9 rounded-full shadow-md flex items-center justify-center transition-colors border ${
                    m.recipe?.length 
                    ? 'bg-white text-orange-600 border-orange-100 hover:bg-orange-600 hover:text-white' 
                    : 'bg-slate-100 text-slate-400 border-slate-200'
                }`}
                title="Định lượng"
             >
                <ChefHat size={18} />
             </button>

             {/* Nút Xóa */}
             <button 
                onClick={(e) => stopProp(e, () => onDelete(m))}
                className="w-9 h-9 bg-white text-rose-500 rounded-full shadow-md flex items-center justify-center hover:bg-rose-600 hover:text-white transition-colors border border-rose-100"
                title="Xóa món"
             >
                <Trash2 size={18} />
             </button>
          </div>
        )}
      </div>

      {/* 2. THÔNG TIN & NÚT THÊM */}
      <div className="p-3 flex flex-col flex-1 bg-white">
        <div className="flex-1">
           <h3 className="font-bold text-slate-700 text-sm leading-snug line-clamp-2 mb-1" title={m.name}>
             {m.name}
           </h3>
           <p className="text-[10px] text-slate-400 truncate">{m.category || 'Khác'}</p>
        </div>
        
        {/* Nút Thêm (To rõ cho Tablet) */}
        {canAdd && (
            <div className="mt-3 pt-3 border-t border-slate-50">
                <button
                    disabled={!m.is_available}
                    className={`w-full py-2.5 rounded-xl text-xs font-bold border flex items-center justify-center gap-2 transition-all
                    ${m.is_available 
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-600 hover:text-white hover:shadow-md' 
                        : 'bg-slate-50 text-slate-400 border-slate-100 cursor-not-allowed'}`}
                >
                    <Plus size={16}/> THÊM MÓN
                </button>
            </div>
        )}
      </div>
    </div>
  )
}