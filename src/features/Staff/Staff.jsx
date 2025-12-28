import React, { useEffect, useState } from 'react'
import { initializeApp, getApp, deleteApp } from 'firebase/app'
import {
  getAuth, createUserWithEmailAndPassword,
  signOut, signInWithEmailAndPassword,
  updatePassword, updateEmail
} from 'firebase/auth'
import {
  collection, onSnapshot,
  deleteDoc, doc, setDoc, updateDoc,
  serverTimestamp
} from 'firebase/firestore'
import { Plus, Trash2, Edit, Shield, User, ChefHat, Coffee } from 'lucide-react'
import { db } from '../../firebase'
import StaffModal from './StaffModal'
import ConfirmModal from '../../components/UI/ConfirmModal'

export default function Staff() {
  const [staffList, setStaffList] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingStaff, setEditingStaff] = useState(null)
  const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, title: '', message: '', action: null })

  // Lắng nghe danh sách nhân viên realtime
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), (snap) => {
      const list = []
      snap.forEach(d => list.push({ id: d.id, ...d.data() }))
      // Sắp xếp: Quản lý -> Bếp -> Phục vụ
      list.sort((a, b) => {
        const roleOrder = { MANAGER: 1, KITCHEN: 2, STAFF: 3 }
        return (roleOrder[a.role] || 99) - (roleOrder[b.role] || 99)
      })
      setStaffList(list)
      setLoading(false)
    })
    return () => unsub()
  }, [])

  // Helper: Lấy thông tin hiển thị theo Role
  const getRoleDisplay = (role) => {
    switch (role) {
      case 'MANAGER':
        return { label: 'Quản lý', color: 'bg-purple-50 text-purple-700 border-purple-100', icon: Shield, iconBg: 'bg-purple-100 text-purple-600' }
      case 'KITCHEN':
        return { label: 'Bếp', color: 'bg-orange-50 text-orange-700 border-orange-100', icon: ChefHat, iconBg: 'bg-orange-100 text-orange-600' }
      case 'STAFF':
      default:
        return { label: 'Phục vụ', color: 'bg-blue-50 text-blue-700 border-blue-100', icon: Coffee, iconBg: 'bg-blue-100 text-blue-600' }
    }
  }

  // Xử lý Lưu (Tạo mới hoặc Cập nhật)
  const handleSave = async (data) => {
    let secondaryApp = null
    const appName = "SecondaryApp-" + Date.now()

    try {
      if (editingStaff) {
        // --- LOGIC CẬP NHẬT ---
        const isPassChanged = data.password !== editingStaff.password
        const isEmailChanged = data.email !== editingStaff.email

        if (isPassChanged || isEmailChanged) {
          secondaryApp = initializeApp(getApp().options, appName)
          const secondaryAuth = getAuth(secondaryApp)

          const userCredential = await signInWithEmailAndPassword(
            secondaryAuth,
            editingStaff.email,
            editingStaff.password
          )
          const user = userCredential.user

          if (isPassChanged) await updatePassword(user, data.password)
          if (isEmailChanged) await updateEmail(user, data.email)

          await signOut(secondaryAuth)
        }

        await updateDoc(doc(db, 'users', editingStaff.id), data)

      } else {
        // --- LOGIC TẠO MỚI ---
        secondaryApp = initializeApp(getApp().options, appName)
        const secondaryAuth = getAuth(secondaryApp)

        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, data.email, data.password)
        const newUser = userCredential.user
        
        await signOut(secondaryAuth)

        await setDoc(doc(db, 'users', newUser.uid), {
          ...data,
          uid: newUser.uid,
          createdAt: serverTimestamp()
        })
      }

      setShowModal(false)
      setEditingStaff(null)

    } catch (error) {
      console.error("Lỗi thao tác nhân viên:", error)
      const errorMap = {
        'auth/wrong-password': 'Mật khẩu cũ lưu trong hệ thống không khớp. Không thể cập nhật.',
        'auth/email-already-in-use': 'Email này đã được sử dụng bởi nhân viên khác.',
        'auth/requires-recent-login': 'Bảo mật: Cần đăng nhập lại để thực hiện.'
      }
      alert(errorMap[error.code] || `Lỗi: ${error.message}`)
    } finally {
      if (secondaryApp) await deleteApp(secondaryApp)
    }
  }

  // Xử lý Xóa
  const handleDeleteClick = (staff) => {
    if (staff.role === 'MANAGER') {
      alert("Không thể xóa tài khoản Quản lý!")
      return
    }
    setConfirmConfig({
      isOpen: true,
      title: 'Xóa nhân viên',
      message: `Xóa nhân viên "${staff.name}"? (Lưu ý: Bạn cần xóa tài khoản Auth thủ công trong Firebase Console nếu cần)`,
      action: async () => {
        try {
          await deleteDoc(doc(db, 'users', staff.id))
        } catch (e) { console.error(e) }
      }
    })
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      <ConfirmModal
        isOpen={confirmConfig.isOpen}
        onClose={() => setConfirmConfig(p => ({ ...p, isOpen: false }))}
        onConfirm={confirmConfig.action}
        title={confirmConfig.title}
        message={confirmConfig.message}
      />

      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Quản lý nhân viên</h2>
          <p className="text-sm text-slate-500">Danh sách tài khoản hệ thống</p>
        </div>
        <button
          onClick={() => { setEditingStaff(null); setShowModal(true) }}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 shadow-sm transition active:scale-95"
        >
          <Plus size={18} /> Thêm nhân viên
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? <div className="col-span-full text-center py-10 text-slate-500">Đang tải...</div> :
          staffList.length === 0 ? <div className="col-span-full text-center py-10 text-slate-500">Trống.</div> :
            staffList.map(s => {
              const roleStyle = getRoleDisplay(s.role)
              const RoleIcon = roleStyle.icon

              return (
                <div key={s.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${roleStyle.iconBg}`}>
                        <RoleIcon size={20} />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-800">{s.name}</h3>
                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${roleStyle.color}`}>
                          {roleStyle.label}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => { setEditingStaff(s); setShowModal(true) }} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition">
                        <Edit size={16} />
                      </button>
                      {s.role !== 'MANAGER' && (
                        <button onClick={() => handleDeleteClick(s)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition">
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1 text-sm text-slate-600 pl-1">
                    <div className="flex gap-2"><span className="w-16 text-slate-400">Email:</span> <span className="font-medium truncate">{s.email}</span></div>
                    <div className="flex gap-2"><span className="w-16 text-slate-400">Pass:</span> <span className="font-mono bg-slate-100 px-1 rounded text-xs">{s.password}</span></div>
                  </div>
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