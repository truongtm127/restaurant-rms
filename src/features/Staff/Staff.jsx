import React, { useEffect, useState } from 'react'
import { initializeApp, deleteApp } from 'firebase/app'
import {
  getAuth, createUserWithEmailAndPassword,
  signOut, signInWithEmailAndPassword,
  updatePassword, updateEmail
} from 'firebase/auth'
import {
  collection, onSnapshot,
  deleteDoc, doc, setDoc, updateDoc,
  serverTimestamp, query
} from 'firebase/firestore'
// [THÊM] Import các icon cho thông báo
import { Plus, Trash2, Edit, Shield, ChefHat, Coffee, Mail, DollarSign, Search, CheckCircle, AlertCircle, X } from 'lucide-react'
import { db, firebaseConfig } from '../../firebase' 
import StaffModal from './StaffModal'
import ConfirmModal from '../../components/UI/ConfirmModal'
import { fmtVND } from '../../utils/helpers'

export default function Staff({ user }) {
  const [staffList, setStaffList] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingStaff, setEditingStaff] = useState(null)
  
  // State cho Modal xác nhận xóa
  const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, title: '', message: '', action: null })

  // [MỚI] State cho Thông báo ứng dụng (Toast)
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' }) // type: 'success' | 'error'

  // Hàm hiển thị thông báo
  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type })
    // Tự động tắt sau 3 giây
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000)
  }

  // Lắng nghe danh sách nhân viên
  useEffect(() => {
    const q = query(collection(db, 'users'))
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      list.sort((a, b) => {
        const roleOrder = { MANAGER: 1, KITCHEN: 2, STAFF: 3 }
        return (roleOrder[a.role] || 99) - (roleOrder[b.role] || 99)
      })
      setStaffList(list)
      setLoading(false)
    })
    return () => unsub()
  }, [])

  const getRoleDisplay = (role) => {
    switch (role) {
      case 'MANAGER': return { label: 'Quản lý', color: 'bg-purple-50 text-purple-700 border-purple-100', icon: Shield, iconBg: 'bg-purple-100 text-purple-600' }
      case 'KITCHEN': return { label: 'Bếp', color: 'bg-orange-50 text-orange-700 border-orange-100', icon: ChefHat, iconBg: 'bg-orange-100 text-orange-600' }
      case 'STAFF':
      default: return { label: 'Phục vụ', color: 'bg-blue-50 text-blue-700 border-blue-100', icon: Coffee, iconBg: 'bg-blue-100 text-blue-600' }
    }
  }

  // --- XỬ LÝ LƯU ---
  const handleSave = async (data) => {
    let secondaryApp = null
    const appName = "SecondaryApp-" + Date.now()

    try {
      if (!firebaseConfig) {
          showToast("Lỗi cấu hình: Không tìm thấy firebaseConfig.", "error")
          return
      }

      if (editingStaff) {
        // --- CẬP NHẬT ---
        const newPassword = data.password && data.password.trim() !== '' ? data.password : null
        const isEmailChanged = data.email !== editingStaff.email

        if (newPassword || isEmailChanged) {
          // Kiểm tra mật khẩu cũ
          if (!editingStaff.password) {
             // Logic tự sửa lỗi cho Admin (Self-Healing)
             if (editingStaff.role === 'MANAGER' && newPassword) {
                 console.log("Admin fix: Update password directly.")
             } else {
                 showToast("Lỗi: Tài khoản này thiếu mật khẩu cũ. Vui lòng xóa tạo lại.", "error")
                 return
             }
          } else {
             // Logic chuẩn: Xác thực lại
             secondaryApp = initializeApp(firebaseConfig, appName)
             const secondaryAuth = getAuth(secondaryApp)
             const userCredential = await signInWithEmailAndPassword(secondaryAuth, editingStaff.email, editingStaff.password)
             const tempUser = userCredential.user
             if (newPassword) await updatePassword(tempUser, newPassword)
             if (isEmailChanged) await updateEmail(tempUser, data.email)
             await signOut(secondaryAuth)
          }
        }

        await updateDoc(doc(db, 'users', editingStaff.id), {
            name: data.name,
            role: data.role,
            email: data.email,
            hourlyRate: Number(data.hourlyRate),
            password: newPassword || editingStaff.password,
            updatedAt: serverTimestamp()
        })
        
        // [THAY ĐỔI] Dùng showToast thay alert
        showToast("Cập nhật nhân viên thành công!", "success")

      } else {
        // --- TẠO MỚI ---
        if (!data.password) {
            showToast("Vui lòng nhập mật khẩu!", "error")
            return
        }

        secondaryApp = initializeApp(firebaseConfig, appName)
        const secondaryAuth = getAuth(secondaryApp)

        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, data.email, data.password)
        const newUser = userCredential.user
        await signOut(secondaryAuth)

        await setDoc(doc(db, 'users', newUser.uid), {
          uid: newUser.uid,
          name: data.name,
          email: data.email,
          password: data.password,
          role: data.role,
          hourlyRate: Number(data.hourlyRate),
          createdAt: serverTimestamp()
        })
        
        // [THAY ĐỔI] Dùng showToast thay alert
        showToast("Đã tạo nhân viên mới!", "success")
      }
      setShowModal(false)
      setEditingStaff(null)

    } catch (error) {
      console.error("Lỗi:", error)
      let msg = error.message
      if (error.code === 'auth/email-already-in-use') msg = "Email đã tồn tại!"
      if (error.code === 'auth/wrong-password') msg = "Mật khẩu cũ không đúng!"
      
      // [THAY ĐỔI] Dùng showToast thay alert
      showToast(msg, "error")
    } finally {
      if (secondaryApp) {
          try { await deleteApp(secondaryApp) } catch (e) { console.log(e) }
      }
    }
  }

  const handleDeleteClick = (staff) => {
    if (staff.id === user.uid) {
      showToast("Không thể tự xóa tài khoản của chính mình!", "error")
      return
    }
    // Modal xác nhận xóa vẫn giữ nguyên vì nó là hành động quan trọng
    setConfirmConfig({
      isOpen: true,
      title: 'Xóa nhân viên',
      message: `Bạn có chắc chắn muốn xóa nhân viên ${staff.name}?`,
      action: async () => {
        try { 
            await deleteDoc(doc(db, 'users', staff.id))
            showToast("Đã xóa nhân viên.", "success")
        } catch (e) { 
            showToast("Lỗi khi xóa nhân viên.", "error") 
        }
      }
    })
  }
  
  const displayList = staffList.filter(s => 
    s.name?.toLowerCase().includes(filter.toLowerCase()) || 
    s.email?.toLowerCase().includes(filter.toLowerCase())
  )

  return (
    <div className="space-y-6 animate-fadeIn pb-10 relative">
      
      {/* --- [MỚI] TOAST NOTIFICATION UI --- */}
      {toast.show && (
        <div className={`fixed top-5 right-5 z-[99999] flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl animate-slideIn border transition-all duration-300
            ${toast.type === 'success' ? 'bg-white border-emerald-500 text-emerald-700' : 'bg-white border-rose-500 text-rose-700'}
        `}>
            <div className={`p-1 rounded-full ${toast.type === 'success' ? 'bg-emerald-100' : 'bg-rose-100'}`}>
                {toast.type === 'success' ? <CheckCircle size={20}/> : <AlertCircle size={20}/>}
            </div>
            <div className="font-bold text-sm pr-2">{toast.message}</div>
            <button onClick={() => setToast(p => ({...p, show: false}))} className="text-slate-400 hover:text-slate-600">
                <X size={16}/>
            </button>
        </div>
      )}

      {/* Modal xác nhận xóa */}
      <ConfirmModal
        isOpen={confirmConfig.isOpen}
        onClose={() => setConfirmConfig(p => ({ ...p, isOpen: false }))}
        onConfirm={confirmConfig.action}
        title={confirmConfig.title}
        message={confirmConfig.message}
      />

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200 sticky top-0 z-10">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Quản lý nhân sự</h2>
          <p className="text-sm text-slate-500">Danh sách tài khoản hệ thống</p>
        </div>
        
        <div className="flex w-full md:w-auto gap-2">
            <div className="relative flex-1 md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
                <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Tìm kiếm..." className="w-full pl-9 pr-4 py-2 bg-slate-100 border-none rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 outline-none"/>
            </div>
            <button
              onClick={() => { setEditingStaff(null); setShowModal(true) }}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 shadow-lg shadow-emerald-200 transition active:scale-95 whitespace-nowrap"
            >
              <Plus size={18} /> Thêm mới
            </button>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? <div className="col-span-full text-center py-10 text-slate-500">Đang tải...</div> :
          displayList.length === 0 ? <div className="col-span-full text-center py-10 text-slate-500">Trống.</div> :
          displayList.map(s => {
              const roleStyle = getRoleDisplay(s.role)
              const RoleIcon = roleStyle.icon
              return (
                <div key={s.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 hover:border-emerald-300 transition group relative">
                  <div className={`absolute top-4 right-4 text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wide border ${roleStyle.color}`}>
                      {roleStyle.label}
                  </div>
                  <div className="flex items-center gap-4 mb-4">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${roleStyle.iconBg}`}>
                       <RoleIcon size={24} />
                    </div>
                    <div>
                       <h3 className="font-bold text-slate-800 text-lg leading-tight">{s.name}</h3>
                       <div className="text-xs text-slate-500 flex items-center gap-1 mt-1"><Mail size={12}/> {s.email}</div>
                    </div>
                  </div>
                  <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
                    <div className="text-sm font-bold text-emerald-600 flex items-center gap-1">
                        <DollarSign size={14}/> {fmtVND(s.hourlyRate || 0)} / giờ
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => { setEditingStaff(s); setShowModal(true) }} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition" title="Sửa">
                        <Edit size={18} />
                      </button>
                      {s.role !== 'MANAGER' && (
                        <button onClick={() => handleDeleteClick(s)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition" title="Xóa">
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  </div>
                  {!s.password && s.role === 'MANAGER' && <div className="mt-2 text-[10px] text-rose-500 text-center font-bold animate-pulse">! Thiếu Password DB - Cần cập nhật ngay</div>}
                </div>
              )
            })
        }
      </div>

      {showModal && (
        <StaffModal
          initialData={editingStaff}
          onClose={() => { setShowModal(false); setEditingStaff(null) }}
          onSave={handleSave}
        />
      )}
    </div>
  )
}