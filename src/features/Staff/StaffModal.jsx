import React, { useState, useEffect } from 'react'
import { X } from 'lucide-react'

export default function StaffModal({ initialData, onClose, onSave }) {
  // 1. Khởi tạo state cho form
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'STAFF' // Mặc định là nhân viên
  })

  // 2. [QUAN TRỌNG] useEffect này giúp điền dữ liệu vào form khi bấm Sửa
  // Nếu không có đoạn này, form sẽ luôn trống trơn dù bạn bấm Edit
  useEffect(() => {
    if (initialData) {
      // Chế độ Sửa: Đổ dữ liệu cũ vào form
      setFormData({
        name: initialData.name || '',
        email: initialData.email || '',
        password: initialData.password || '',
        role: initialData.role || 'STAFF'
      })
    } else {
      // Chế độ Thêm mới: Reset form
      setFormData({
        name: '',
        email: '',
        password: '',
        role: 'STAFF'
      })
    }
  }, [initialData])

  // 3. Hàm xử lý khi nhập liệu
  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  // 4. Hàm submit form
  const handleSubmit = (e) => {
    e.preventDefault()
    // Gọi hàm onSave (được truyền từ Staff.jsx) để xử lý Lưu/Cập nhật
    onSave(formData)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
        
        {/* Header Modal */}
        <div className="flex justify-between items-center p-4 border-b border-slate-100">
          <h3 className="text-lg font-bold text-slate-800">
            {initialData ? 'Cập nhật thông tin' : 'Thêm nhân viên mới'}
          </h3>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          
          {/* Tên nhân viên */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Họ và tên</label>
            <input
              type="text"
              name="name"
              required
              value={formData.name}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
              placeholder="Ví dụ: Nguyễn Văn A"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email đăng nhập</label>
            <input
              type="email"
              name="email"
              required
              value={formData.email}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
              placeholder="email@rms.vn"
            />
          </div>

          {/* Mật khẩu */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Mật khẩu</label>
            <input
              type="text"
              name="password"
              required
              value={formData.password}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-mono"
              placeholder="Nhập mật khẩu..."
            />
          </div>

          {/* Vai trò (Role) */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Vai trò / Phân quyền</label>
            <select
              name="role"
              value={formData.role}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
            >
              <option value="EMPLOYEE">Nhân viên</option>
              <option value="MANAGER">Quản lý (Admin)</option>
            </select>
          </div>

          {/* Footer Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-50 mt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-bold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 shadow-sm transition-colors"
            >
              {initialData ? 'Lưu thay đổi' : 'Tạo tài khoản'}
            </button>
          </div>

        </form>
      </div>
    </div>
  )
}