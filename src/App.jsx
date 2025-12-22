// src/App.jsx
import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { doc, getDoc, setDoc, query, where, collection, getDocs } from 'firebase/firestore'
import { auth, db } from './firebase'

// Layout & Auth
import Shell from './components/Layout/Shell'
import Login from './components/Auth/Login'

// Features (Các màn hình chức năng)
import Dashboard from './features/Dashboard/Dashboard'
import OrderTables from './features/Order/OrderTables'
import Menu from './features/Menu/Menu'
import Staff from './features/Staff/Staff'
import Reports from './features/Reports/Reports'

// Danh sách email admin cứng (Fallback nếu chưa có DB)
const MANAGER_EMAILS = ['admin@rms.vn']

export default function App() {
  const [user, setUser] = useState(null)
  const [route, setRoute] = useState('dashboard')
  const [booting, setBooting] = useState(true)

  // State "Lifted" để giữ trạng thái khi chuyển giữa chọn bàn và chọn món
  const [activeTable, setActiveTable] = useState(null)
  const [activeOrderId, setActiveOrderId] = useState(null)

  // --- 1. LẮNG NGHE TRẠNG THÁI ĐĂNG NHẬP ---
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      try {
        if (!u) {
          setUser(null)
          setBooting(false)
          return
        }

        // Kiểm tra trong bảng 'users' (Bảng phân quyền)
        const userRef = doc(db, 'users', u.uid)
        const userSnap = await getDoc(userRef)

        let finalName = ''
        let finalRole = 'STAFF'

        if (userSnap.exists()) {
          // A. Người dùng cũ: Lấy thông tin từ bảng users
          const data = userSnap.data()
          finalName = data.name || u.email.split('@')[0]
          finalRole = data.role || 'STAFF'
          
          setUser({ uid: u.uid, email: u.email, role: finalRole, name: finalName })
        } else {
          // B. Người dùng mới (Lần đầu đăng nhập):
          // Tìm xem email này có trong bảng 'staff' không (do Admin tạo trước đó)
          const qStaff = query(collection(db, 'staff'), where('email', '==', u.email))
          const staffSnap = await getDocs(qStaff)

          if (!staffSnap.empty) {
            // -> Tìm thấy trong Staff: Đồng bộ thông tin sang bảng Users
            const staffData = staffSnap.docs[0].data()
            finalName = staffData.name
            finalRole = staffData.role

            // Lưu profile vào users để lần sau truy cập nhanh hơn
            await setDoc(userRef, { 
              email: u.email, 
              role: finalRole, 
              name: finalName 
            }, { merge: true })

            setUser({ uid: u.uid, email: u.email, role: finalRole, name: finalName })
          } else {
            // -> Không tìm thấy trong Staff cũng không có trong Users
            // Kiểm tra xem có phải Admin cứng không
            const isManager = MANAGER_EMAILS.includes(String(u.email || '').toLowerCase())

            if (isManager) {
              // Là Admin gốc -> Cho phép vào
              finalName = 'Admin'
              finalRole = 'MANAGER'
              await setDoc(userRef, { email: u.email, role: 'MANAGER', name: 'Admin' }, { merge: true })
              setUser({ uid: u.uid, email: u.email, role: 'MANAGER', name: 'Admin' })
            } else {
              // C. KHÔNG HỢP LỆ (Đã bị xóa hoặc không có quyền): Cưỡng chế đăng xuất
              await signOut(auth)
              alert("Tài khoản của bạn không tồn tại hoặc đã bị xóa khỏi hệ thống.")
              setUser(null)
            }
          }
        }
      } catch (e) {
        console.warn('Login check failed:', e)
        // Fallback an toàn nếu lỗi mạng
        setUser({ uid: u?.uid, email: u?.email || 'user', role: 'STAFF', name: 'Nhân viên' })
      } finally {
        setBooting(false)
      }
    })
    return () => unsub()
  }, [])

  // --- 2. MÀN HÌNH CHỜ & LOGIN ---
  if (booting) return (
    <div className="min-h-screen grid place-items-center bg-slate-50 text-slate-500 font-medium animate-pulse">
      Đang khởi tạo hệ thống RMS...
    </div>
  )
  
  if (!user) return <Login />

  // --- 3. HIỆU ỨNG CHUYỂN TRANG ---
  const PageTransition = ({ children, k }) => (
    <motion.div 
      key={k} 
      initial={{ opacity: 0, y: 10 }} 
      animate={{ opacity: 1, y: 0 }} 
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="h-full"
    >
      {children}
    </motion.div>
  )

  // --- 4. RENDER GIAO DIỆN CHÍNH ---
  return (
    <Shell user={user} route={route} setRoute={setRoute} onLogout={() => signOut(auth)}>
      <AnimatePresence mode="wait">
        
        {route === 'dashboard' && (
          <PageTransition k="dash">
            <Dashboard />
          </PageTransition>
        )}

        {route === 'order' && (
          <PageTransition k="order">
            <OrderTables
              user={user} // Truyền user để lưu tên người tạo đơn
              setRoute={setRoute}
              setActiveTable={setActiveTable}
              setActiveOrderId={setActiveOrderId}
            />
          </PageTransition>
        )}

        {route === 'menu' && (
          <PageTransition k="menu">
            <Menu
              user={user} // Truyền user để phân quyền Manager và lưu tên người thanh toán
              activeTable={activeTable}
              activeOrderId={activeOrderId}
              setActiveTable={setActiveTable}
              setActiveOrderId={setActiveOrderId}
              setRoute={setRoute}
            />
          </PageTransition>
        )}

        {/* Chỉ Manager mới vào được trang Nhân viên */}
        {route === 'staff' && user.role === 'MANAGER' && (
          <PageTransition k="staff">
            <Staff user={user} />
          </PageTransition>
        )}

        {/* Chỉ Manager mới vào được trang Báo cáo */}
        {route === 'reports' && user.role === 'MANAGER' && (
          <PageTransition k="reports">
            <Reports />
          </PageTransition>
        )}

      </AnimatePresence>

      <footer className="mt-10 text-xs text-slate-400 text-center md:text-left border-t border-slate-100 pt-4 pb-2">
        RMS v1.4 — Restaurant Management System
      </footer>
    </Shell>
  )
}