import React, { useState } from 'react'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { X, Upload, Loader2 } from 'lucide-react'
import { storage } from '../../firebase'
import { compressImage } from '../../utils/helpers'

const INPUT_CLASSES = "w-full border border-slate-300 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-emerald-500 outline-none text-sm bg-white"
const LABEL_CLASSES = "text-xs font-semibold text-slate-500 uppercase mb-1.5 block"

export default function MenuItemModal({ initial, onClose, onCreate, onUpdate }) {
  const isEdit = !!initial
  const initialImage = initial?.imageURL || initial?.image || ''

  // Form State
  const [formData, setFormData] = useState({
    name: initial?.name || '',
    price: initial?.price !== undefined ? initial.price : '',
    category: initial?.category || 'Món chính',
    isAvailable: initial?.is_available !== undefined ? initial.is_available : true
  })

  // Image State
  const [preview, setPreview] = useState(initialImage)
  const [file, setFile] = useState(null)
  
  // UI State
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (error) setError('')
  }

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      setPreview(URL.createObjectURL(selectedFile))
    }
  }

  const validateForm = () => {
    if (!formData.name.trim()) return 'Vui lòng nhập tên món ăn.'
    const numPrice = Number(formData.price)
    if (formData.price === '' || Number.isNaN(numPrice) || numPrice < 0) return 'Giá bán không hợp lệ.'
    return ''
  }

  const handleUploadImage = async () => {
    if (!file) return initialImage 

    const fileName = `${Date.now()}_${file.name}`
    const storageRef = ref(storage, `menu_items/${fileName}`)

    try {
      // Thử nén ảnh trước khi upload
      const uploadFile = file.type.startsWith('image/') ? await compressImage(file) : file
      await uploadBytes(storageRef, uploadFile)
    } catch (err) {
      console.warn("Lỗi nén ảnh, đang tải ảnh gốc...", err)
      await uploadBytes(storageRef, file)
    }

    return await getDownloadURL(storageRef)
  }

  const handleSubmit = async () => {
    const errorMsg = validateForm()
    if (errorMsg) {
      setError(errorMsg)
      return
    }

    setSubmitting(true)
    setError('')

    try {
      const url = await handleUploadImage()
      
      const payload = {
        name: formData.name.trim(),
        price: Number(formData.price),
        category: formData.category,
        is_available: formData.isAvailable,
        imageURL: url || '',
      }

      if (isEdit) {
        await onUpdate(initial.id, payload)
      } else {
        await onCreate(payload)
      }
      
      onClose()
    } catch (e) {
      console.error(e)
      setError('Đã xảy ra lỗi khi lưu dữ liệu. Vui lòng thử lại.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose}/>
      
      {/* Modal Content */}
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

        {/* Body */}
        <div className="p-6 overflow-y-auto">
          <div className="grid md:grid-cols-2 gap-6">
            
            {/* Left Column: Form Fields */}
            <div className="space-y-4">
              <div>
                <label className={LABEL_CLASSES}>Tên món ăn</label>
                <input 
                  value={formData.name} 
                  onChange={e => handleInputChange('name', e.target.value)} 
                  className={INPUT_CLASSES}
                  placeholder="VD: Phở bò đặc biệt"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={LABEL_CLASSES}>Giá bán (VNĐ)</label>
                  <input 
                    type="number" 
                    min="0"
                    value={formData.price} 
                    onChange={e => handleInputChange('price', e.target.value)} 
                    className={INPUT_CLASSES}
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className={LABEL_CLASSES}>Danh mục</label>
                  <select 
                    value={formData.category} 
                    onChange={e => handleInputChange('category', e.target.value)} 
                    className={INPUT_CLASSES}
                  >
                    <option value="Món chính">Món chính</option>
                    <option value="Món phụ">Món phụ</option>
                    <option value="Đồ uống">Đồ uống</option>
                    <option value="Khác">Khác</option>
                  </select>
                </div>
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer select-none group">
                  <input 
                    type="checkbox" 
                    checked={formData.isAvailable}
                    onChange={e => handleInputChange('isAvailable', e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500 border-gray-300 cursor-pointer"
                  />
                  <span className="text-sm font-medium text-slate-700 group-hover:text-emerald-700 transition">
                    Đang kinh doanh (Còn hàng)
                  </span>
                </label>
              </div>
              
              {error && (
                <div className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 animate-pulse">
                  {error}
                </div>
              )}
            </div>

            {/* Right Column: Image Upload */}
            <div>
              <label className={LABEL_CLASSES}>Hình ảnh mô tả</label>
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