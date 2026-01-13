import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { X, CheckCircle, AlertCircle, AlertTriangle } from 'lucide-react'
import { auth, db } from './firebase'

// Components
import Shell from './components/Layout/Shell'
import Login from './components/Auth/Login'

// Features
import Dashboard from './features/Dashboard/Dashboard'
import OrderTables from './features/Order/OrderTables'
import Menu from './features/Menu/Menu'
import Kitchen from './features/Kitchen/Kitchen'
import Inventory from './features/Inventory/Inventory'
import Staff from './features/Staff/Staff'
import Reports from './features/Reports/Reports'
import CouponManager from './features/Coupons/CouponManager'
import Attendance from './features/Staff/Attendance'
import Payroll from './features/Staff/Payroll'

// --- SUB-COMPONENTS ---

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

const ToastNotification = ({ toast, onClose }) => {
  if (!toast.show) return null

  const config = {
    success: { icon: CheckCircle, color: 'text-emerald-500', border: 'border-l-emerald-500', title: 'Thành công', titleColor: 'text-emerald-800' },
    warning: { icon: AlertTriangle, color: 'text-amber-500', border: 'border-l-amber-500', title: 'Chú ý', titleColor: 'text-amber-800' },
    error: { icon: AlertCircle, color: 'text-rose-500', border: 'border-l-rose-500', title: 'Đã xảy ra lỗi', titleColor: 'text-rose-800' }
  }

  const style = config[toast.type] || config.success
  const Icon = style.icon

  return (
    <motion.div 
      key="toast-bar"
      initial={{ opacity: 0, x: 50 }} 
      animate={{ opacity: 1, x: 0 }} 
      exit={{ opacity: 0, x: 50, scale: 0.95 }} 
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={`fixed top-24 right-6 z-[99999] flex items-start gap-4 p-5 min-w-[360px] max-w-md bg-white shadow-2xl rounded-xl border border-slate-100 border-l-8 ${style.border}`}
    >
      <div className={`mt-0.5 shrink-0 ${style.color}`}>
        <Icon size={28}/>
      </div>
      <div className="flex-1 min-w-0 pt-0.5">
        <h4 className={`font-bold text-base mb-1 ${style.titleColor}`}>{style.title}</h4>
        <div className="text-sm text-slate-600 leading-relaxed font-medium">{toast.message}</div>
      </div>
      <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors -mt-1 -mr-1 p-1.5 rounded-lg hover:bg-slate-100">
        <X size={20}/>
      </button>
    </motion.div>
  )
}

// --- MAIN APP ---

export default function App() {
  const [user, setUser] = useState(null)
  const [route, setRoute] = useState('dashboard')
  const [booting, setBooting] = useState(true)
  
  // Shared State
  const [activeTable, setActiveTable] = useState(null)
  const [activeOrderId, setActiveOrderId] = useState(null)

  // Notification State
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' })
  const toastTimerRef = useRef(null) 

  const showToast = useCallback((message, type = 'error') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast({ show: true, message, type })
    toastTimerRef.current = setTimeout(() => setToast(prev => ({ ...prev, show: false })), 4000)
  }, [])

  // Auth Listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        setUser(null)
        setBooting(false)
        return
      }

      try {
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
        setRoute(userData.role === 'KITCHEN' ? 'kitchen' : 'dashboard')

      } catch (error) { 
        console.error("Auth Error:", error)
        setUser(null) 
      } finally { 
        setBooting(false) 
      }
    })
    return () => unsub()
  }, [])

  // Router Logic
  const MainContent = useMemo(() => {
    if (!user) return <Login />

    const isManager = user.role === 'MANAGER'
    const isKitchen = user.role === 'KITCHEN' || isManager

    return (
        <Shell user={user} route={route} setRoute={setRoute} onLogout={() => signOut(auth)}>
          <AnimatePresence mode="wait">
            
            {/* Common Routes */}
            {route === 'dashboard' && <PageTransition k="dash"><Dashboard /></PageTransition>}
            {route === 'attendance' && <PageTransition k="attendance"><Attendance user={user} showToast={showToast} /></PageTransition>}
            
            {/* Operations Routes */}
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

            {route === 'kitchen' && isKitchen && (
              <PageTransition k="kitchen">
                  <Kitchen user={user} showToast={showToast} />
              </PageTransition>
            )}

            {/* Management Routes */}
            {isManager && (
                <>
                    {route === 'inventory' && <PageTransition k="inv"><Inventory user={user} showToast={showToast} /></PageTransition>}
                    {route === 'staff' && <PageTransition k="staff"><Staff user={user} /></PageTransition>}
                    {route === 'payroll' && <PageTransition k="payroll"><Payroll /></PageTransition>}
                    {route === 'coupons' && <PageTransition k="coupons"><CouponManager showToast={showToast} /></PageTransition>}
                    {route === 'reports' && <PageTransition k="reports"><Reports /></PageTransition>}
                </>
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
      <AnimatePresence>
        {toast.show && (
            <ToastNotification 
                toast={toast} 
                onClose={() => {
                    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
                    setToast(p => ({...p, show: false}))
                }} 
            />
        )}
      </AnimatePresence>

      {MainContent}
    </>
  )
}