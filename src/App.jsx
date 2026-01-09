import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { auth, db } from './firebase'
import { X, CheckCircle, AlertCircle, AlertTriangle } from 'lucide-react'

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

  // --- STATE THÔNG BÁO ---
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' })
  const toastTimerRef = useRef(null) 

  // Hàm hiển thị thông báo
  const showToast = useCallback((message, type = 'error') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)

    setToast({ show: true, message, type })

    toastTimerRef.current = setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }))
    }, 4000)
  }, [])

  // --- LOGIC AUTH ---
  useEffect(() => {
    const checkUserRole = async (u) => {
      try {
        if (!u) { setUser(null); return }

        const userRef = doc(db, 'users', u.uid)
        const userSnap = await getDoc(userRef)
        
        let userData = { 
          uid: u.uid, 
          email: u.email, 
          name: u.displayName || 'Nhân viên mới', 
          role: 'STAFF' 
        }

        if (userSnap.exists()) {
          userData = { ...userData, ...userSnap.data() }
        } else {
          await setDoc(userRef, userData, { merge: true })
        }
        
        setUser(userData)
        
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
      transition={{ duration: 0.15, ease: "easeOut" }} 
      className="h-full"
    >
      {children}
    </motion.div>
  )

  const MainContent = useMemo(() => {
    if (!user) return <Login />

    return (
        <Shell user={user} route={route} setRoute={setRoute} onLogout={() => signOut(auth)}>
          <AnimatePresence mode="wait">
            {route === 'dashboard' && <PageTransition k="dash"><Dashboard /></PageTransition>}
            {route === 'attendance' && <PageTransition k="attendance"><Attendance user={user} showToast={showToast} /></PageTransition>}
            
            {route === 'order' && (
              <PageTransition k="order">
                <OrderTables user={user} setRoute={setRoute} setActiveTable={setActiveTable} setActiveOrderId={setActiveOrderId} />
              </PageTransition>
            )}

            {route === 'menu' && (
              <PageTransition k="menu">
                <Menu 
                    user={user} 
                    activeTable={activeTable} 
                    activeOrderId={activeOrderId} 
                    setActiveTable={setActiveTable} 
                    setActiveOrderId={setActiveOrderId} 
                    setRoute={setRoute}
                    showToast={showToast} 
                />
              </PageTransition>
            )}

            {route === 'kitchen' && ['MANAGER', 'KITCHEN'].includes(user.role) && (
              <PageTransition k="kitchen">
                  <Kitchen user={user} showToast={showToast} />
              </PageTransition>
            )}

            {route === 'inventory' && ['MANAGER', 'KITCHEN'].includes(user.role) && (
              <PageTransition k="inv">
                  <Inventory user={user} showToast={showToast} />
              </PageTransition>
            )}

            {route === 'staff' && user.role === 'MANAGER' && (
              <PageTransition k="staff"><Staff user={user} /></PageTransition>
            )}

            {route === 'payroll' && user.role === 'MANAGER' && (
              <PageTransition k="payroll"><Payroll /></PageTransition>
            )}

            {route === 'coupons' && user.role === 'MANAGER' && (
               <PageTransition k="coupons">
               <CouponManager showToast={showToast} /> {/* <--- Thêm prop này */}
              </PageTransition>
      )}
            
            {route === 'reports' && user.role === 'MANAGER' && (
              <PageTransition k="reports"><Reports /></PageTransition>
            )}
          </AnimatePresence>
          
          <footer className="mt-8 text-[10px] text-slate-300 text-center border-t border-slate-100 pt-2 pb-1 uppercase tracking-widest">
            Restaurant Management System © 2025
          </footer>
        </Shell>
    )
  }, [user, route, activeTable, activeOrderId, showToast])

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
      {/* LAYER THÔNG BÁO - ĐÃ DỊCH XUỐNG DƯỚI */}
      <AnimatePresence>
        {toast.show && (
          <motion.div 
            key="toast-bar"
            style={{ willChange: "opacity, transform" }} 
            
            initial={{ opacity: 0, x: 50 }} 
            animate={{ opacity: 1, x: 0 }} 
            exit={{ opacity: 0, x: 50, scale: 0.95 }} 
            transition={{ duration: 0.3, ease: "easeOut" }}
            
            className={`
              fixed top-24 right-6 z-[99999] /* [SỬA] top-6 -> top-24 (Đẩy xuống khoảng 96px) */
              flex items-start 
              gap-4 
              p-5 
              min-w-[360px] max-w-md 
              bg-white shadow-2xl rounded-xl border border-slate-100
              ${toast.type === 'success' ? 'border-l-8 border-l-emerald-500' : 
                toast.type === 'warning' ? 'border-l-8 border-l-amber-500' : 
                'border-l-8 border-l-rose-500'}
            `}
          >
              <div className={`mt-0.5 shrink-0 ${
                  toast.type === 'success' ? 'text-emerald-500' : 
                  toast.type === 'warning' ? 'text-amber-500' : 
                  'text-rose-500'
              }`}>
                  {toast.type === 'success' ? <CheckCircle size={28}/> : 
                   toast.type === 'warning' ? <AlertTriangle size={28}/> : 
                   <AlertCircle size={28}/>}
              </div>
              
              <div className="flex-1 min-w-0 pt-0.5">
                  <h4 className={`font-bold text-base mb-1 ${ 
                      toast.type === 'success' ? 'text-emerald-800' : 
                      toast.type === 'warning' ? 'text-amber-800' : 
                      'text-rose-800'
                  }`}>
                      {toast.type === 'success' ? 'Thành công' : toast.type === 'warning' ? 'Chú ý' : 'Đã xảy ra lỗi'}
                  </h4>
                  <div className="text-sm text-slate-600 leading-relaxed font-medium"> 
                      {toast.message}
                  </div>
              </div>
              
              <button 
                onClick={() => {
                    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
                    setToast(p => ({...p, show: false}))
                }} 
                className="text-slate-400 hover:text-slate-600 transition-colors -mt-1 -mr-1 p-1.5 rounded-lg hover:bg-slate-100"
              >
                  <X size={20}/>
              </button>
          </motion.div>
        )}
      </AnimatePresence>

      {MainContent}
    </>
  )
}