import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { auth, db } from './firebase'
import { X, CheckCircle, AlertCircle } from 'lucide-react'

// Layout & Auth
import Shell from './components/Layout/Shell'
import Login from './components/Auth/Login'

// Features Imports
import Dashboard from './features/Dashboard/Dashboard'
import OrderTables from './features/Order/OrderTables'
import Menu from './features/Menu/Menu'
import Kitchen from './features/Kitchen/Kitchen'
import Inventory from './features/Inventory/Inventory'

// Manager Features
import Staff from './features/Staff/Staff'
import Reports from './features/Reports/Reports'
import CouponManager from './features/Coupons/CouponManager'
import Attendance from './features/Staff/Attendance'
import Payroll from './features/Staff/Payroll'

export default function App() {
  const [user, setUser] = useState(null)
  const [route, setRoute] = useState('dashboard')
  const [booting, setBooting] = useState(true)
  const [activeTable, setActiveTable] = useState(null)
  const [activeOrderId, setActiveOrderId] = useState(null)

  // State thông báo
  const [toast, setToast] = useState({ show: false, message: '', type: 'error' })

  // Hàm hiển thị thông báo
  const showToast = (message, type = 'error') => {
    setToast({ show: true, message, type })
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 5000)
  }

  useEffect(() => {
    const checkUserRole = async (u) => {
      try {
        if (!u) { setUser(null); return }

        const userRef = doc(db, 'users', u.uid)
        const userSnap = await getDoc(userRef)
        
        // Cấu trúc dữ liệu mặc định cho User mới
        let userData = { 
          uid: u.uid, 
          email: u.email, 
          name: u.displayName || 'Nhân viên mới', 
          role: 'STAFF' 
        }

        if (userSnap.exists()) {
          // Nếu user đã tồn tại, lấy dữ liệu từ DB (bao gồm Role đã được cấp)
          userData = { ...userData, ...userSnap.data() }
        } else {
          // Nếu là user mới tinh, lưu vào DB với quyền mặc định là STAFF
          await setDoc(userRef, userData, { merge: true })
        }
        
        setUser(userData)
        
        // Điều hướng thông minh dựa trên Role
        if (userData.role === 'KITCHEN') setRoute('kitchen')
        else setRoute('dashboard') 

      } catch (error) { 
        console.warn("Auth Error:", error)
        setUser(null) 
      } finally { 
        setBooting(false) 
      }
    }

    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) { setUser(null); setBooting(false) } else checkUserRole(u)
    })
    return () => unsub()
  }, [])

  const PageTransition = ({ children, k }) => (
    <motion.div 
      key={k} 
      initial={{ opacity: 0, y: 5 }} 
      animate={{ opacity: 1, y: 0 }} 
      exit={{ opacity: 0, y: -5 }} 
      transition={{ duration: 0.2 }} 
      className="h-full"
    >
      {children}
    </motion.div>
  )

  if (booting) return (
    <div className="min-h-screen grid place-items-center bg-slate-50">
      <div className="text-center animate-pulse">
        <div className="w-12 h-12 bg-emerald-600 rounded-full mx-auto mb-4"/>
        <p className="text-slate-500 font-bold">Đang khởi động hệ thống...</p>
      </div>
    </div>
  )

  return (
    <>
      {/* --- LAYER THÔNG BÁO (CENTER) --- */}
      <AnimatePresence>
        {toast.show && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className={`
              fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[99999] 
              flex flex-col items-center gap-3 p-6 min-w-[300px] max-w-sm text-center
              rounded-2xl shadow-2xl border-2 transition-all duration-300
              ${toast.type === 'success' 
                ? 'bg-white border-emerald-500 text-emerald-800 shadow-emerald-100' 
                : 'bg-white border-rose-500 text-rose-800 shadow-rose-100'}
            `}
          >
              <div className={`p-3 rounded-full mb-1 ${toast.type === 'success' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                  {toast.type === 'success' ? <CheckCircle size={32}/> : <AlertCircle size={32}/>}
              </div>
              
              <div className="font-bold text-lg">{toast.type === 'success' ? 'Thành công' : 'Thông báo lỗi'}</div>
              <div className="font-medium text-sm text-slate-600 px-2 leading-relaxed">{toast.message}</div>
              
              <button 
                onClick={() => setToast(p => ({...p, show: false}))} 
                className="absolute top-3 right-3 text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-100 rounded-full"
              >
                  <X size={20}/>
              </button>
          </motion.div>
        )}
      </AnimatePresence>

      {!user ? (
        <Login />
      ) : (
        // Đã sửa activeRoute -> route để khớp với Shell mới
        <Shell user={user} route={route} setRoute={setRoute} onLogout={() => signOut(auth)}>
          <AnimatePresence mode="wait">
            {route === 'dashboard' && <PageTransition k="dash"><Dashboard /></PageTransition>}
            {route === 'attendance' && <PageTransition k="attendance"><Attendance user={user} /></PageTransition>}
            
            {route === 'order' && (
              <PageTransition k="order">
                <OrderTables user={user} setRoute={setRoute} setActiveTable={setActiveTable} setActiveOrderId={setActiveOrderId} />
              </PageTransition>
            )}

            {route === 'menu' && (
              <PageTransition k="menu">
                <Menu user={user} activeTable={activeTable} activeOrderId={activeOrderId} setActiveTable={setActiveTable} setActiveOrderId={setActiveOrderId} setRoute={setRoute} />
              </PageTransition>
            )}

            {route === 'kitchen' && ['MANAGER', 'KITCHEN'].includes(user.role) && (
              <PageTransition k="kitchen"><Kitchen user={user} /></PageTransition>
            )}

            {/* --- ROUTE KHO HÀNG --- */}
            {route === 'inventory' && ['MANAGER', 'KITCHEN'].includes(user.role) && (
              <PageTransition k="inv"><Inventory user={user} /></PageTransition>
            )}

            {route === 'staff' && user.role === 'MANAGER' && (
              <PageTransition k="staff"><Staff user={user} /></PageTransition>
            )}

            {route === 'payroll' && user.role === 'MANAGER' && (
              <PageTransition k="payroll"><Payroll /></PageTransition>
            )}

            {route === 'coupons' && user.role === 'MANAGER' && (
              <PageTransition k="coupons"><CouponManager /></PageTransition>
            )}
            
            {route === 'reports' && user.role === 'MANAGER' && (
              <PageTransition k="reports"><Reports /></PageTransition>
            )}
          </AnimatePresence>
          
          <footer className="mt-8 text-[10px] text-slate-300 text-center border-t border-slate-100 pt-2 pb-1 uppercase tracking-widest">
            Restaurant Management System © 2025
          </footer>
        </Shell>
      )}
    </>
  )
}