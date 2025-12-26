import React, { useEffect, useState } from 'react'
import { collection, onSnapshot, deleteDoc, doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
// 1. Import thêm các hàm updatePassword, updateEmail, signInWithEmailAndPassword
import { initializeApp, getApp, deleteApp } from 'firebase/app'
import { getAuth, createUserWithEmailAndPassword, signOut, signInWithEmailAndPassword, updatePassword, updateEmail } from 'firebase/auth'
import { db } from '../../firebase'
import { Plus, Trash2, Edit, Shield, User } from 'lucide-react'
import StaffModal from './StaffModal'
import ConfirmModal from '../../components/UI/ConfirmModal'

export default function Staff() {
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingStaff, setEditingStaff] = useState(null)

  const [confirmConfig, setConfirmConfig] = useState({
    isOpen: false, title: '', message: '', action: null
  })

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), (snap) => {
      const list = []
      snap.forEach(d => list.push({ id: d.id, ...d.data() }))
      setStaff(list)
      setLoading(false)
    })
    return () => unsub()
  }, [])

  // --- HÀM XỬ LÝ LƯU (ĐÃ NÂNG CẤP ĐỔI MẬT KHẨU) ---
  const handleSave = async (data) => {
    let secondaryApp = null;
    
    // Tạo tên app ngẫu nhiên để tránh trùng lặp
    const appName = "SecondaryApp-" + Date.now();

    try {
      if (editingStaff) {
        // --- TRƯỜNG HỢP 1: CẬP NHẬT (UPDATE) ---
        
        // Kiểm tra xem có thay đổi thông tin quan trọng không
        const isPasswordChanged = data.password !== editingStaff.password;
        const isEmailChanged = data.email !== editingStaff.email;

        if (isPasswordChanged || isEmailChanged) {
           // Nếu có đổi mật khẩu hoặc email -> Cần đăng nhập vào App phụ để cập nhật Auth
           
           // 1. Khởi tạo App phụ
           secondaryApp = initializeApp(getApp().options, appName);
           const secondaryAuth = getAuth(secondaryApp);

           // 2. Đăng nhập bằng tài khoản CŨ (dựa vào thông tin đang lưu trong Firestore)
           // Lưu ý: Nếu password trong Firestore bị sai so với thực tế thì bước này sẽ lỗi
           const userCredential = await signInWithEmailAndPassword(
             secondaryAuth, 
             editingStaff.email, 
             editingStaff.password
           );
           const user = userCredential.user;

           // 3. Thực hiện đổi mật khẩu (nếu có)
           if (isPasswordChanged) {
             await updatePassword(user, data.password);
           }

           // 4. Thực hiện đổi email (nếu có) - Làm sau cùng
           if (isEmailChanged) {
             await updateEmail(user, data.email);
           }

           // 5. Đăng xuất
           await signOut(secondaryAuth);
        }

        // 6. Cập nhật thông tin mới vào Firestore (bao gồm cả mật khẩu mới để lần sau còn đổi được)
        await updateDoc(doc(db, 'users', editingStaff.id), data)

      } else {
        // --- TRƯỜNG HỢP 2: TẠO MỚI (CREATE) ---
        
        secondaryApp = initializeApp(getApp().options, appName);
        const secondaryAuth = getAuth(secondaryApp);

        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, data.email, data.password);
        const newUser = userCredential.user;

        await signOut(secondaryAuth);

        await setDoc(doc(db, 'users', newUser.uid), {
          ...data,
          uid: newUser.uid,
          createdAt: serverTimestamp()
        });
      }
      
      setShowModal(false)
      setEditingStaff(null)

    } catch (error) {
      console.error("Lỗi:", error)
      if (error.code === 'auth/wrong-password') {
        alert("Lỗi: Mật khẩu cũ lưu trong hệ thống không khớp với mật khẩu thực tế của user này. Không thể cập nhật.")
      } else if (error.code === 'auth/email-already-in-use') {
        alert("Email này đã được sử dụng!")
      } else if (error.code === 'auth/requires-recent-login') {
        alert("Bảo mật: Cần đăng nhập lại để thực hiện hành động này.")
      } else {
        alert("Lỗi: " + error.message)
      }
    } finally {
      // Dọn dẹp App phụ
      if (secondaryApp) {
        await deleteApp(secondaryApp);
      }
    }
  }

  const handleDeleteClick = (s) => {
    setConfirmConfig({
      isOpen: true,
      title: 'Xóa nhân viên',
      message: `Bạn có chắc chắn muốn xóa nhân viên "${s.name}"? (Lưu ý: Tài khoản đăng nhập cần xóa thủ công trong trang Admin Firebase)`,
      action: async () => {
        try {
          await deleteDoc(doc(db, 'users', s.id))
        } catch (error) {
          console.error("Lỗi xóa:", error)
          alert("Không thể xóa nhân viên này.")
        }
      }
    })
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      <ConfirmModal 
        isOpen={confirmConfig.isOpen}
        onClose={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmConfig.action}
        title={confirmConfig.title}
        message={confirmConfig.message}
      />

      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Quản lý nhân viên</h2>
          <p className="text-sm text-slate-500">Danh sách tài khoản truy cập hệ thống</p>
        </div>
        <button 
          onClick={() => { setEditingStaff(null); setShowModal(true) }}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 shadow-sm transition-transform active:scale-95"
        >
          <Plus size={18} /> Thêm nhân viên
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
           <div className="col-span-full text-center py-10 text-slate-500">Đang tải dữ liệu...</div>
        ) : staff.length === 0 ? (
           <div className="col-span-full text-center py-10 text-slate-500">Chưa có nhân viên nào.</div>
        ) : (
          staff.map(s => (
            <div key={s.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${s.role === 'MANAGER' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
                    {s.role === 'MANAGER' ? <Shield size={20}/> : <User size={20}/>}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800">{s.name}</h3>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      s.role === 'MANAGER' 
                        ? 'bg-purple-50 text-purple-700 border border-purple-100' 
                        : 'bg-blue-50 text-blue-700 border border-blue-100'
                    }`}>
                      {s.role === 'MANAGER' ? 'Quản lý' : 'Nhân viên'}
                    </span>
                  </div>
                </div>
                
                <div className="flex gap-1">
                  <button 
                    onClick={() => { setEditingStaff(s); setShowModal(true) }}
                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Chỉnh sửa"
                  >
                    <Edit size={16} />
                  </button>
                  <button 
                    onClick={() => handleDeleteClick(s)}
                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    title="Xóa"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <div className="space-y-1 text-sm text-slate-600 pl-1">
                <div className="flex gap-2">
                  <span className="w-16 text-slate-400">Email:</span>
                  <span className="font-medium">{s.email}</span>
                </div>
                <div className="flex gap-2">
                  <span className="w-16 text-slate-400">Mật khẩu:</span>
                  {/* Hiển thị mật khẩu để Admin dễ quản lý (theo yêu cầu của bạn) */}
                  <span className="font-mono bg-slate-100 px-1 rounded text-xs">{s.password}</span>
                </div>
              </div>
            </div>
          ))
        )}
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