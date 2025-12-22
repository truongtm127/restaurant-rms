// src/features/Staff/StaffModal.jsx
import React, { useState } from 'react'

export default function StaffModal({ initial, onClose, onCreate, onUpdate }) {
  const isEdit = !!initial
  
  const [name, setName] = useState(initial?.name || '')
  const [email, setEmail] = useState(initial?.email || '')
  const [password, setPassword] = useState('')
  
  // Mặc định luôn là STAFF, không cần setRole nữa
  const [role] = useState(initial?.role || 'STAFF')
  
  const [shift, setShift] = useState(initial?.shift || 'Sáng')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const validate = () => {
    if (!name.trim()) return 'Vui lòng nhập tên'
    if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email)) return 'Email không hợp lệ'
    
    // Nếu là thêm mới thì bắt buộc phải có mật khẩu > 6 ký tự
    if (!isEdit && (!password || password.length < 6)) {
      return 'Mật khẩu phải từ 6 ký tự trở lên'
    }
    
    return ''
  }

  const submit = async () => {
    const msg = validate()
    if (msg) { setError(msg); return }
    setError(''); setSubmitting(true)
    try {
      const payload = { name: name.trim(), email: email.trim(), role, shift, password }
      
      if (isEdit) await onUpdate(initial.id, payload)
      else await onCreate(payload)
      
      onClose()
    } catch (e) {
      setError(e.message.replace('Firebase: ', ''))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose}/>
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl p-6 space-y-5 animate-fadeIn">
        <div className="flex items-center justify-between border-b pb-3">
          <div className="text-lg font-bold text-slate-800">{isEdit ? 'Sửa thông tin' : 'Thêm nhân viên mới'}</div>
          <button onClick={onClose} className="px-3 py-1 text-sm text-slate-500 hover:bg-slate-100 rounded-lg">Đóng</button>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1 sm:col-span-2">
            <label className="text-xs font-semibold text-slate-500 uppercase">Họ và tên</label>
            <input value={name} onChange={e=>setName(e.target.value)} className="w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500"/>
          </div>
          
          <div className="space-y-1 sm:col-span-2">
            <label className="text-xs font-semibold text-slate-500 uppercase">Email đăng nhập</label>
            <input 
              value={email} 
              onChange={e=>setEmail(e.target.value)} 
              className="w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500" 
              placeholder="vd: nhanvien@rms.vn"
              disabled={isEdit} 
            />
          </div>

          {!isEdit && (
            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs font-semibold text-slate-500 uppercase">Mật khẩu khởi tạo</label>
              <input 
                type="password"
                value={password} 
                onChange={e=>setPassword(e.target.value)} 
                className="w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500" 
                placeholder="Nhập mật khẩu..."
              />
            </div>
          )}

          {/* Đã xóa phần chọn Vai trò (Role) ở đây */}
          
          <div className="space-y-1 sm:col-span-2">
            <label className="text-xs font-semibold text-slate-500 uppercase">Ca làm việc</label>
            <select value={shift} onChange={e=>setShift(e.target.value)} className="w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-500 bg-white">
              <option value="Sáng">Sáng</option>
              <option value="Chiều">Chiều</option>
              <option value="Full">Full</option>
            </select>
          </div>
        </div>

        {error && <div className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</div>}

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border hover:bg-slate-50 font-medium text-slate-600">Hủy</button>
          <button onClick={submit} disabled={submitting} className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-700 disabled:opacity-50">
            {submitting ? 'Đang xử lý...' : (isEdit ? 'Cập nhật' : 'Tạo tài khoản')}
          </button>
        </div>
      </div>
    </div>
  )
}