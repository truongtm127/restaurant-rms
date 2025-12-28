import React, { useState, useEffect } from 'react'
import { X, Lock } from 'lucide-react'

export default function StaffModal({ initialData, onClose, onSave }) {
  const [formData, setFormData] = useState({
    name: '', email: '', password: '', role: 'STAFF'
  })

  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name || '',
        email: initialData.email || '',
        password: initialData.password || '',
        role: initialData.role || 'STAFF'
      })
    }
  }, [initialData])

  const handleSubmit = (e) => {
    e.preventDefault()
    onSave(formData)
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  // Kiểm tra xem đây có phải là tài khoản Quản lý đang được sửa hay không
  const isEditingManager = initialData?.role === 'MANAGER'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50">
          <h3 className="text-lg font-bold text-slate-800">
            {initialData ? 'Cập nhật nhân viên' : 'Thêm nhân viên mới'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition">
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Họ và tên</label>
            <input name="name" required value={formData.name} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="Nguyễn Văn A" />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Email đăng nhập</label>
            <input 
              type="email" name="email" required 
              value={formData.email} onChange={handleChange} 
              disabled={!!initialData} 
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none disabled:bg-slate-100 disabled:text-slate-500" 
              placeholder="user@rms.vn" 
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Mật khẩu</label>
            <input type="text" name="password" required value={formData.password} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none font-mono" placeholder="******" />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
              Vai trò {isEditingManager && <Lock size={12} className="text-amber-500"/>}
            </label>
            
            <select 
              name="role" 
              value={formData.role} 
              onChange={handleChange} 
              disabled={isEditingManager} // Khóa không cho chọn nếu là Quản lý
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white 
                ${isEditingManager ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''}`}
            >
              {isEditingManager ? (
                // Nếu đang sửa Quản lý -> Chỉ hiện option Quản lý
                <option value="MANAGER">Quản lý (Cố định)</option>
              ) : (
                // Nếu là nhân viên thường hoặc tạo mới -> Chỉ hiện Bếp/Phục vụ
                <>
                  <option value="STAFF">Nhân viên Phục vụ</option>
                  <option value="KITCHEN">Nhân viên Bếp</option>
                </>
              )}
            </select>
            
            {isEditingManager && (
              <p className="text-[10px] text-amber-600 mt-1 italic">
                * Không thể thay đổi vai trò của tài khoản Quản lý.
              </p>
            )}
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