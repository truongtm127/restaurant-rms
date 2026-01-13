import React, { useState, useEffect } from 'react'
import { X, Lock, DollarSign } from 'lucide-react'

const INITIAL_STATE = {
  name: '', 
  email: '', 
  password: '', 
  role: 'STAFF',
  hourlyRate: 20000 
}

const INPUT_CLASSES = "w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"

export default function StaffModal({ initialData, onClose, onSave }) {
  const [formData, setFormData] = useState(INITIAL_STATE)

  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name || '',
        email: initialData.email || '',
        password: '', // Password luôn trống khi edit
        role: initialData.role || 'STAFF',
        hourlyRate: initialData.hourlyRate || 20000 
      })
    } else {
      setFormData(INITIAL_STATE)
    }
  }, [initialData])

  const validateForm = () => {
    if (!initialData && !formData.password) {
        alert("Vui lòng nhập mật khẩu khi tạo mới!")
        return false
    }
    return true
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (validateForm()) {
        onSave(formData)
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    const finalValue = name === 'hourlyRate' ? Number(value) : value
    setFormData(prev => ({ ...prev, [name]: finalValue }))
  }

  const isEditingManager = initialData?.role === 'MANAGER'

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      
      {/* Modal Content */}
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden relative z-10" onClick={(e) => e.stopPropagation()}>
        
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50">
          <h3 className="text-lg font-bold text-slate-800">
            {initialData ? 'Cập nhật nhân viên' : 'Thêm nhân viên mới'}
          </h3>
          <button onClick={onClose} type="button" className="text-slate-400 hover:text-slate-600 transition p-1 hover:bg-slate-200 rounded-full">
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Họ và tên</label>
            <input 
              name="name" required 
              value={formData.name} onChange={handleChange} 
              className={INPUT_CLASSES} 
              placeholder="Nguyễn Văn A" 
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Email đăng nhập</label>
            <input 
              type="email" name="email" required 
              value={formData.email} onChange={handleChange} 
              disabled={!!initialData} 
              className={`${INPUT_CLASSES} disabled:bg-slate-100 disabled:text-slate-500`} 
              placeholder="user@rms.vn" 
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">
              {initialData ? 'Mật khẩu mới (Bỏ trống nếu không đổi)' : 'Mật khẩu'}
            </label>
            <input 
              type="text" 
              name="password" 
              required={!initialData} 
              value={formData.password} 
              onChange={handleChange} 
              className={`${INPUT_CLASSES} font-mono`} 
              placeholder={initialData ? "******" : "Nhập mật khẩu..."} 
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                Vai trò {isEditingManager && <Lock size={12} className="text-amber-500"/>}
              </label>
              <select 
                name="role" 
                value={formData.role} 
                onChange={handleChange} 
                disabled={isEditingManager}
                className={`${INPUT_CLASSES} bg-white ${isEditingManager ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''}`}
              >
                {isEditingManager ? (
                  <option value="MANAGER">Quản lý (Cố định)</option>
                ) : (
                  <>
                    <option value="STAFF">Phục vụ</option>
                    <option value="KITCHEN">Bếp</option>
                    <option value="MANAGER">Quản lý</option>
                  </>
                )}
              </select>
            </div>

            <div className="space-y-1">
               <label className="text-sm font-medium text-slate-700 flex items-center gap-1">
                  Lương / Giờ <DollarSign size={12}/>
               </label>
               <div className="relative">
                  <input 
                    type="number"
                    name="hourlyRate"
                    min="0"
                    step="1000"
                    value={formData.hourlyRate}
                    onChange={handleChange}
                    className="w-full pl-3 pr-8 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-emerald-600 text-right"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">đ</span>
               </div>
            </div>
          </div>
          
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-50 mt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition">Hủy</button>
            <button type="submit" className="px-4 py-2 text-sm font-bold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 shadow-sm transition">
              {initialData ? 'Lưu thay đổi' : 'Tạo mới'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}