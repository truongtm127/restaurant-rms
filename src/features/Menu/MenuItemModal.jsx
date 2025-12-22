// src/features/Menu/MenuItemModal.jsx
import React, { useState } from 'react'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { X } from 'lucide-react'
import { storage } from '../../firebase'
// Import thêm hàm nén ảnh
import { compressImage } from '../../utils/helpers'

export default function MenuItemModal({ initial, onClose, onCreate, onUpdate }) {
  const isEdit = !!initial
  
  const [name, setName] = useState(initial?.name || '')
  const [price, setPrice] = useState(initial?.price !== undefined ? initial.price : '')
  const [category, setCategory] = useState(initial?.category || 'Món chính')
  const [imageURL, setImageURL] = useState(initial?.imageURL || '')
  
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(initial?.imageURL || '')
  
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleFile = (e) => {
    const f = e.target.files && e.target.files[0] ? e.target.files[0] : null
    if (f) {
      setFile(f)
      setPreview(URL.createObjectURL(f))
    }
  }

  const validate = () => {
    if (!name.trim()) return 'Vui lòng nhập tên món'
    const p = Number(price)
    if (price === '' || Number.isNaN(p) || p < 0) return 'Giá không hợp lệ'
    return ''
  }

  const uploadIfNeeded = async () => {
    if (!file) return imageURL
    
    // Nén ảnh trước khi upload
    let uploadFile = file
    try {
      if (file.type.startsWith('image/')) {
        uploadFile = await compressImage(file)
      }
    } catch (e) {
      console.warn("Lỗi nén ảnh, sẽ dùng ảnh gốc:", e)
    }

    const path = `menu_items/${Date.now()}_${uploadFile.name}`
    const r = ref(storage, path)
    await uploadBytes(r, uploadFile)
    return await getDownloadURL(r)
  }

  const submit = async () => {
    const msg = validate()
    if (msg) { setError(msg); return }
    setError(''); setSubmitting(true)
    try {
      const url = await uploadIfNeeded()
      const payload = {
        name: name.trim(),
        price: Number(price),
        category: category || 'Món chính',
        is_available: true,
        imageURL: url || '',
      }
      if (isEdit) await onUpdate(initial.id, payload)
      else await onCreate(payload)
      onClose()
    } catch (e) {
      console.error(e)
      setError('Lỗi lưu dữ liệu: ' + (e?.message || 'Không rõ'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose}/>
      
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-fadeIn">
        <div className="px-6 py-4 border-b flex items-center justify-between bg-slate-50">
          <h2 className="text-lg font-bold text-slate-800">
            {isEdit ? 'Chỉnh sửa món' : 'Thêm món mới'}
          </h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-200 text-slate-500 transition">
            <X className="w-5 h-5"/>
          </button>
        </div>

        <div className="p-6 grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 uppercase">Tên món ăn</label>
              <input 
                value={name} 
                onChange={e=>setName(e.target.value)} 
                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-emerald-500 outline-none"
                placeholder="VD: Phở bò đặc biệt"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase">Giá bán (VNĐ)</label>
                <input 
                  type="number" 
                  min="0"
                  value={price} 
                  onChange={e=>setPrice(e.target.value)} 
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-emerald-500 outline-none"
                  placeholder="0"
                />
              </div>
              
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase">Danh mục</label>
                <select 
                  value={category} 
                  onChange={e=>setCategory(e.target.value)} 
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
                >
                  <option value="Món chính">Món chính</option>
                  <option value="Món phụ">Món phụ</option>
                  <option value="Đồ uống">Đồ uống</option>
                  <option value="Khác">Khác</option>
                </select>
              </div>
            </div>
            
            {error && (
              <div className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
                {error}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3">
            <label className="text-xs font-semibold text-slate-500 uppercase">Hình ảnh mô tả</label>
            
            <div className="relative group w-full aspect-[3/2] bg-slate-50 rounded-xl border-2 border-dashed border-slate-300 hover:border-emerald-400 overflow-hidden flex items-center justify-center cursor-pointer">
              
              {preview ? (
                <img src={preview} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <div className="text-center p-4">
                  <div className="w-12 h-12 bg-slate-200 rounded-full flex items-center justify-center mx-auto mb-2 text-slate-500">
                    <span className="text-2xl">📷</span> 
                  </div>
                  <div className="text-sm text-slate-500 font-medium">Tải ảnh lên</div>
                </div>
              )}

              <input 
                type="file" 
                accept="image/*" 
                onChange={handleFile} 
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              
              {preview && (
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition text-white font-medium text-sm">
                  Nhấn để thay đổi
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="px-6 py-4 bg-slate-50 border-t flex justify-end gap-3">
          <button 
            onClick={onClose} 
            className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-600 font-medium hover:bg-white transition"
          >
            Hủy bỏ
          </button>
          <button 
            onClick={submit} 
            disabled={submitting} 
            className="px-6 py-2.5 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition disabled:opacity-50"
          >
            {submitting ? 'Đang lưu...' : (isEdit ? 'Lưu thay đổi' : 'Thêm món mới')}
          </button>
        </div>
      </div>
    </div>
  )
}