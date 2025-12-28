import React, { useState } from 'react'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { X, Upload, Loader2 } from 'lucide-react'
import { storage } from '../../firebase'
import { compressImage } from '../../utils/helpers'

export default function MenuItemModal({ initial, onClose, onCreate, onUpdate }) {
  const isEdit = !!initial
  
  // Form State
  const [name, setName] = useState(initial?.name || '')
  const [price, setPrice] = useState(initial?.price !== undefined ? initial.price : '')
  const [category, setCategory] = useState(initial?.category || 'Món chính')
  const [isAvailable, setIsAvailable] = useState(initial?.is_available !== undefined ? initial.is_available : true)
  
  // Image State
  // Fallback cho cả trường dữ liệu cũ (image) và mới (imageURL)
  const initialImage = initial?.imageURL || initial?.image || ''
  const [imageURL] = useState(initialImage)
  const [preview, setPreview] = useState(initialImage)
  const [file, setFile] = useState(null)
  
  // UI State
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      setPreview(URL.createObjectURL(selectedFile))
    }
  }

  const validateForm = () => {
    if (!name.trim()) return 'Vui lòng nhập tên món ăn.'
    const numPrice = Number(price)
    if (price === '' || Number.isNaN(numPrice) || numPrice < 0) return 'Giá bán không hợp lệ.'
    return ''
  }

  const handleUploadImage = async () => {
    if (!file) return imageURL // Giữ nguyên ảnh cũ nếu không chọn ảnh mới

    try {
      // Nén ảnh nếu là file ảnh
      let uploadFile = file
      if (file.type.startsWith('image/')) {
        uploadFile = await compressImage(file)
      }

      const path = `menu_items/${Date.now()}_${uploadFile.name}`
      const storageRef = ref(storage, path)
      await uploadBytes(storageRef, uploadFile)
      return await getDownloadURL(storageRef)
    } catch (err) {
      console.warn("Lỗi xử lý ảnh, đang tải ảnh gốc...", err)
      // Fallback: Upload ảnh gốc nếu nén lỗi
      const path = `menu_items/${Date.now()}_${file.name}`
      const storageRef = ref(storage, path)
      await uploadBytes(storageRef, file)
      return await getDownloadURL(storageRef)
    }
  }

  const handleSubmit = async () => {
    const errorMsg = validateForm()
    if (errorMsg) { setError(errorMsg); return }

    setError('')
    setSubmitting(true)

    try {
      const url = await handleUploadImage()
      
      const payload = {
        name: name.trim(),
        price: Number(price),
        category: category,
        is_available: isAvailable,
        imageURL: url || '', // Luôn ưu tiên lưu vào imageURL
      }

      if (isEdit) await onUpdate(initial.id, payload)
      else await onCreate(payload)
      
      onClose()
    } catch (e) {
      console.error(e)
      setError('Đã xảy ra lỗi khi lưu dữ liệu. Vui lòng thử lại.')
    } finally {
      setSubmitting(false)
    }
  }

  const inputClass = "w-full border border-slate-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
  const labelClass = "text-xs font-semibold text-slate-500 uppercase mb-1.5 block"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose}/>
      
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-fadeIn flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between bg-slate-50 shrink-0">
          <h2 className="text-lg font-bold text-slate-800">
            {isEdit ? 'Chỉnh sửa món' : 'Thêm món mới'}
          </h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-200 text-slate-500 transition">
            <X className="w-5 h-5"/>
          </button>
        </div>

        {/* Body (Scrollable) */}
        <div className="p-6 overflow-y-auto">
          <div className="grid md:grid-cols-2 gap-6">
            
            {/* Left Column: Form Info */}
            <div className="space-y-4">
              <div>
                <label className={labelClass}>Tên món ăn</label>
                <input 
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                  className={inputClass}
                  placeholder="VD: Phở bò đặc biệt"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Giá bán (VNĐ)</label>
                  <input 
                    type="number" 
                    min="0"
                    value={price} 
                    onChange={e => setPrice(e.target.value)} 
                    className={inputClass}
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className={labelClass}>Danh mục</label>
                  <select 
                    value={category} 
                    onChange={e => setCategory(e.target.value)} 
                    className={`${inputClass} bg-white`}
                  >
                    <option value="Món chính">Món chính</option>
                    <option value="Món phụ">Món phụ</option>
                    <option value="Đồ uống">Đồ uống</option>
                    <option value="Khác">Khác</option>
                  </select>
                </div>
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input 
                    type="checkbox" 
                    checked={isAvailable}
                    onChange={e => setIsAvailable(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500 border-gray-300"
                  />
                  <span className="text-sm font-medium text-slate-700">Đang kinh doanh (Còn hàng)</span>
                </label>
              </div>
              
              {error && (
                <div className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
                  {error}
                </div>
              )}
            </div>

            {/* Right Column: Image Upload */}
            <div>
              <label className={labelClass}>Hình ảnh mô tả</label>
              <div className="relative group w-full aspect-[4/3] bg-slate-50 rounded-xl border-2 border-dashed border-slate-300 hover:border-emerald-400 overflow-hidden flex items-center justify-center cursor-pointer transition-colors">
                
                {preview ? (
                  <>
                    <img src={preview} alt="Preview" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white font-medium text-sm backdrop-blur-[1px]">
                      <Upload className="w-4 h-4 mr-2" /> Nhấn để thay đổi
                    </div>
                  </>
                ) : (
                  <div className="text-center p-4">
                    <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-2 text-slate-400 group-hover:bg-white group-hover:text-emerald-500 transition-colors">
                      <Upload className="w-6 h-6" />
                    </div>
                    <div className="text-sm text-slate-500 font-medium group-hover:text-emerald-600">Tải ảnh lên</div>
                    <div className="text-xs text-slate-400 mt-1">PNG, JPG, WEBP</div>
                  </div>
                )}

                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleFileChange} 
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t flex justify-end gap-3 shrink-0">
          <button 
            onClick={onClose}
            disabled={submitting}
            className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-600 font-medium hover:bg-white transition disabled:opacity-50"
          >
            Hủy bỏ
          </button>
          <button 
            onClick={handleSubmit} 
            disabled={submitting} 
            className="px-6 py-2.5 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition disabled:opacity-70 shadow-sm shadow-emerald-200 flex items-center gap-2"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {submitting ? 'Đang lưu...' : (isEdit ? 'Lưu thay đổi' : 'Thêm món mới')}
          </button>
        </div>
      </div>
    </div>
  )
}