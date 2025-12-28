import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { doc, getDoc, setDoc, query, where, collection, getDocs } from 'firebase/firestore'
import { auth, db } from './firebase'

// Layout & Auth
import Shell from './components/Layout/Shell'
import Login from './components/Auth/Login'

// Features
import Dashboard from './features/Dashboard/Dashboard'
import OrderTables from './features/Order/OrderTables'
import Menu from './features/Menu/Menu'
import Staff from './features/Staff/Staff'
import Reports from './features/Reports/Reports'
import Kitchen from './features/Kitchen/Kitchen'

const MANAGER_EMAILS = ['admin@rms.vn']

export default function App() {
  const [user, setUser] = useState(null)
  const [route, setRoute] = useState('dashboard')
  const [booting, setBooting] = useState(true)

  const [activeTable, setActiveTable] = useState(null)
  const [activeOrderId, setActiveOrderId] = useState(null)

  useEffect(() => {
    const checkUserRole = async (u) => {
      try {
        if (!u) { setUser(null); return }

        const userRef = doc(db, 'users', u.uid)
        const userSnap = await getDoc(userRef)
        let userData = { uid: u.uid, email: u.email, name: '', role: 'STAFF' }

        if (userSnap.exists()) {
          userData = { ...userData, ...userSnap.data() }
        } else {
          const isManager = MANAGER_EMAILS.includes(String(u.email || '').toLowerCase())
          if (isManager) {
            userData.role = 'MANAGER'; userData.name = 'Admin';
            await setDoc(userRef, userData, { merge: true })
          } else {
            const q = query(collection(db, 'users'), where('email', '==', u.email))
            const snap = await getDocs(q)
            if (!snap.empty) {
               const d = snap.docs[0].data()
               userData = { ...userData, role: d.role, name: d.name }
               await setDoc(userRef, userData, { merge: true })
            } else {
               await signOut(auth); alert("Tài khoản không hợp lệ."); setUser(null); return
            }
          }
        }
        setUser(userData)
        
        // [FIX] Luôn luôn vào Dashboard đầu tiên, bất kể vai trò là gì
        setRoute('dashboard')

      } catch (error) { console.warn(error); setUser(null) } finally { setBooting(false) }
    }

    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) { setUser(null); setBooting(false) } else checkUserRole(u)
    })
    return () => unsub()
  }, [])

  if (booting) return <div className="min-h-screen grid place-items-center bg-slate-50 text-slate-500 font-medium animate-pulse">Khởi động hệ thống...</div>
  if (!user) return <Login />

  const PageTransition = ({ children, k }) => (
    <motion.div key={k} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.25 }} className="h-full">
      {children}
    </motion.div>
  )

  return (
    <Shell user={user} route={route} setRoute={setRoute} onLogout={() => signOut(auth)}>
      <AnimatePresence mode="wait">
        
        {route === 'dashboard' && (
          <PageTransition k="dash"><Dashboard /></PageTransition>
        )}

        {route === 'kitchen' && ['MANAGER', 'KITCHEN'].includes(user.role) && (
          <PageTransition k="kitchen"><Kitchen user={user} /></PageTransition>
        )}

        {route === 'order' && (
          <PageTransition k="order"><OrderTables user={user} setRoute={setRoute} setActiveTable={setActiveTable} setActiveOrderId={setActiveOrderId} /></PageTransition>
        )}

        {route === 'menu' && (
          <PageTransition k="menu"><Menu user={user} activeTable={activeTable} activeOrderId={activeOrderId} setActiveTable={setActiveTable} setActiveOrderId={setActiveOrderId} setRoute={setRoute} /></PageTransition>
        )}

        {route === 'staff' && user.role === 'MANAGER' && (
          <PageTransition k="staff"><Staff user={user} /></PageTransition>
        )}

        {route === 'reports' && user.role === 'MANAGER' && (
          <PageTransition k="reports"><Reports /></PageTransition>
        )}

      </AnimatePresence>
      <footer className="mt-10 text-xs text-slate-400 text-center border-t border-slate-100 pt-4 pb-2">RMS System</footer>
    </Shell>
  )
}