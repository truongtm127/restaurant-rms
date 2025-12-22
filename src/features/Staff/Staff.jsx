// src/features/Staff/Staff.jsx
import React, { useEffect, useState } from 'react'
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore'
// Import các hàm cần thiết để tạo user bằng App phụ
import { initializeApp, getApp, deleteApp } from 'firebase/app'
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth'
import { db } from '../../firebase'
import StaffModal from './StaffModal'

export default function Staff({ user }) {
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null) 

  // 1. Lấy danh sách nhân viên realtime
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'staff'), (snap) => {
      const arr = []
      snap.forEach(d => arr.push({ id: d.id, ...d.data() }))
      // Sắp xếp theo tên
      arr.sort((a,b)=> (a.name||'').localeCompare(b.name||''))
      setList(arr); setLoading(false)
    })
    return () => unsub()
  }, [])

  // Chặn truy cập nếu không phải Manager
  if (user?.role !== 'MANAGER') {
    return <div className="p-6 text-center text-slate-500">Bạn không có quyền truy cập trang này.</div>
  }

  const openAdd = () => { setEditing(null); setShowModal(true) }
  const openEdit = (s) => { setEditing(s); setShowModal(true) }
  const closeModal = () => { setEditing(null); setShowModal(false) }

  // --- 2. HÀM TẠO NHÂN VIÊN (Kèm tạo tài khoản đăng nhập) ---
  const handleCreate = async (payload) => {
    // Khởi tạo một App phụ để thao tác Auth mà không ảnh hưởng Admin hiện tại
    const secondaryApp = initializeApp(getApp().options, "Secondary")
    const secondaryAuth = getAuth(secondaryApp)

    try {
      const { password, ...firestoreData } = payload
      
      // Tạo user trên Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, payload.email, password)
      const uid = userCredential.user.uid

      // Lưu thông tin vào Firestore (Lưu kèm uid để sau này xóa được)
      await addDoc(collection(db, 'staff'), {
        ...firestoreData,
        uid: uid, 
        createdAt: new Date()
      })

      // Đăng xuất và xóa App phụ
      await signOut(secondaryAuth)
      deleteApp(secondaryApp)

    } catch (error) {
      deleteApp(secondaryApp) // Dọn dẹp app phụ nếu lỗi
      if (error.code === 'auth/email-already-in-use') {
        throw new Error('Email này đã được sử dụng!')
      }
      throw error
    }
  }

  // --- 3. HÀM CẬP NHẬT THÔNG TIN ---
  const handleUpdate = async (id, payload) => { 
    // Không cập nhật password/email ở đây vì phức tạp, chỉ sửa thông tin hiển thị
    const { password, ...dataToUpdate } = payload
    await updateDoc(doc(db, 'staff', id), dataToUpdate) 
  }

  // --- 4. HÀM XÓA NHÂN VIÊN (Chặn đăng nhập) ---
  const handleDelete = async (staff) => {
    if (!confirm(`CẢNH BÁO: Bạn có chắc muốn xóa nhân viên "${staff.name}"? \n\nHành động này sẽ:\n1. Xóa khỏi danh sách nhân viên.\n2. Chặn quyền đăng nhập của họ ngay lập tức.`)) return
    
    try {
      // Xóa khỏi bảng staff (để danh sách biến mất)
      await deleteDoc(doc(db, 'staff', staff.id))

      // Xóa khỏi bảng users (để file App.jsx chặn đăng nhập)
      if (staff.uid) {
        await deleteDoc(doc(db, 'users', staff.uid))
      }
    } catch (e) {
      console.error(e)
      alert("Lỗi khi xóa dữ liệu!")
    }
  }

  return (
    <div className="space-y-4 animate-fadeIn">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Quản lý nhân viên</h2>
          <p className="text-sm text-slate-500">Tạo tài khoản và phân quyền truy cập</p>
        </div>
        <button onClick={openAdd} className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 shadow-sm shadow-emerald-200 transition">
          + Thêm nhân viên
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left border-b border-slate-200 text-slate-500">
              <th className="p-4 font-semibold">Họ tên</th>
              <th className="p-4 font-semibold">Email</th>
              <th className="p-4 font-semibold">Vai trò</th>
              <th className="p-4 font-semibold">Ca làm</th>
              <th className="p-4 text-right font-semibold">Hành động</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td className="p-6 text-center text-slate-400" colSpan={5}>Đang tải danh sách...</td></tr>
            ) : list.length === 0 ? (
              <tr><td className="p-6 text-center text-slate-400" colSpan={5}>Chưa có nhân viên nào</td></tr>
            ) : list.map(s => (
              <tr key={s.id} className="hover:bg-slate-50 transition">
                <td className="p-4 font-medium text-slate-700">{s.name}</td>
                <td className="p-4 text-slate-500">{s.email}</td>
                <td className="p-4">
                  <span className={`px-2 py-1 rounded text-xs font-bold ${
                    s.role==='MANAGER' ? 'bg-purple-100 text-purple-700' :
                    s.role==='CASHIER' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {s.role}
                  </span>
                </td>
                <td className="p-4 text-slate-600">{s.shift}</td>
                <td className="p-4 text-right">
                  <button onClick={()=>openEdit(s)} className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-white hover:border-slate-300 font-medium mr-2 transition">
                    Sửa
                  </button>
                  <button onClick={()=>handleDelete(s)} className="px-3 py-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 font-medium transition">
                    Xóa
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <StaffModal initial={editing} onClose={closeModal} onCreate={handleCreate} onUpdate={handleUpdate}/>
      )}
    </div>
  )
}