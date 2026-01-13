import React, { useEffect, useState } from 'react'
import { collection, query, where, addDoc, updateDoc, doc, serverTimestamp, onSnapshot, getDocs, writeBatch } from 'firebase/firestore'
import { Clock, LogIn, LogOut, UserCheck, History, AlertTriangle } from 'lucide-react'
import { db } from '../../firebase'
import ConfirmModal from '../../components/UI/ConfirmModal'

// --- HELPERS ---

const formatTime = (timestamp) => {
  if (!timestamp) return '--:--'
  const date = timestamp.seconds ? new Date(timestamp.seconds * 1000) : new Date(timestamp)
  return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
}

const formatDate = (timestamp) => {
  if (!timestamp) return ''
  const date = timestamp.seconds ? new Date(timestamp.seconds * 1000) : new Date(timestamp)
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const calculateDuration = (start, end) => {
  if (!start || !end) return 'Đang làm...'
  const s = start.seconds ? start.seconds * 1000 : start
  const e = end.seconds ? end.seconds * 1000 : end
  const diff = (e - s) / (1000 * 60 * 60)
  return diff.toFixed(1) + ' giờ'
}

// --- COMPONENT ---

export default function Attendance({ user, showToast }) {
  const [currentSession, setCurrentSession] = useState(null)
  const [history, setHistory] = useState([])
  const [todayStaff, setTodayStaff] = useState([])
  const [loading, setLoading] = useState(true)
  const [autoFixed, setAutoFixed] = useState(false)
  const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, title: '', message: '', action: null })

  // 1. Logic tự động chốt ca cũ quên checkout
  useEffect(() => {
    const fixStaleSessions = async () => {
        const todayStr = new Date().toISOString().slice(0, 10)
        const q = query(
            collection(db, 'attendance'),
            where('userId', '==', user.uid),
            where('status', '==', 'WORKING')
        )
        
        try {
            const snap = await getDocs(q)
            const batch = writeBatch(db)
            let fixedCount = 0

            snap.docs.forEach(d => {
                const data = d.data()
                if (data.date !== todayStr) {
                    fixedCount++
                    const defaultCheckout = new Date(data.date)
                    defaultCheckout.setHours(23, 59, 59)

                    batch.update(d.ref, {
                        status: 'COMPLETED',
                        checkOut: defaultCheckout,
                        note: 'Hệ thống tự động chốt do quên Check-out'
                    })
                }
            })

            if (fixedCount > 0) {
                await batch.commit()
                setAutoFixed(true)
            }
        } catch (e) {
            console.error("Fix Stale Session Error:", e)
        }
    }
    fixStaleSessions()
  }, [user.uid])

  // 2. Lắng nghe dữ liệu realtime
  useEffect(() => {
    const todayStr = new Date().toISOString().slice(0, 10)
    
    // Current Session Listener
    const qCurrent = query(
      collection(db, 'attendance'),
      where('userId', '==', user.uid),
      where('status', '==', 'WORKING'),
      where('date', '==', todayStr) 
    )
    const unsubCurrent = onSnapshot(qCurrent, (snap) => {
      setCurrentSession(snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() })
      setLoading(false)
    })

    // History Listener
    const qHistory = query(
      collection(db, 'attendance'),
      where('userId', '==', user.uid)
    )
    const unsubHistory = onSnapshot(qHistory, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      list.sort((a, b) => (b.checkIn?.seconds || 0) - (a.checkIn?.seconds || 0))
      setHistory(list.slice(0, 20))
    })

    // Manager View Listener
    let unsubStaff = () => {}
    if (user.role === 'MANAGER') {
        const qStaff = query(
            collection(db, 'attendance'), 
            where('status', '==', 'WORKING'),
            where('date', '==', todayStr)
        )
        unsubStaff = onSnapshot(qStaff, (snap) => {
            setTodayStaff(snap.docs.map(d => ({ id: d.id, ...d.data() })))
        })
    }

    return () => { unsubCurrent(); unsubHistory(); unsubStaff() }
  }, [user])

  // --- HANDLERS ---

  const handleCheckIn = async () => {
    if (autoFixed) setAutoFixed(false)
    setLoading(true)
    try {
      await addDoc(collection(db, 'attendance'), {
        userId: user.uid,
        userName: user.name || user.email,
        checkIn: serverTimestamp(),
        checkOut: null,
        status: 'WORKING',
        date: new Date().toISOString().slice(0, 10)
      })
      showToast("✅ Check-in thành công! Bắt đầu ca làm việc.", "success")
    } catch (error) {
      console.error(error)
      showToast("Lỗi khi Check-in", "error")
    } finally { 
      setLoading(false) 
    }
  }

  const handleCheckOut = () => {
    if (!currentSession) return
    
    setConfirmConfig({
        isOpen: true,
        title: "Kết thúc ca",
        message: "Bạn có chắc chắn muốn Check-out kết thúc ca làm việc?",
        action: async () => {
            setLoading(true)
            try {
                await updateDoc(doc(db, 'attendance', currentSession.id), {
                    checkOut: serverTimestamp(),
                    status: 'COMPLETED'
                })
                showToast("✅ Đã Check-out thành công. Hẹn gặp lại!", "success")
            } catch (error) {
                console.error(error)
                showToast("Lỗi khi Check-out", "error")
            } finally { 
                setLoading(false) 
            }
        }
    })
  }

  return (
    <div className="space-y-6 animate-fadeIn pb-10">
      
      <ConfirmModal 
        isOpen={confirmConfig.isOpen} 
        onClose={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))} 
        onConfirm={confirmConfig.action} 
        title={confirmConfig.title} 
        message={confirmConfig.message} 
      />

      {/* Header Info */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div>
           <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><Clock className="text-emerald-600"/> Chấm công</h1>
           <p className="text-slate-500">Xin chào, <b>{user.name}</b>! Chúc bạn một ngày làm việc hiệu quả.</p>
        </div>
        <div className="text-right hidden md:block">
           <div className="text-3xl font-bold text-slate-700">{new Date().toLocaleTimeString('vi-VN', {hour:'2-digit', minute:'2-digit'})}</div>
           <div className="text-slate-500 text-sm">{new Date().toLocaleDateString('vi-VN', {weekday: 'long', day:'2-digit', month:'2-digit', year:'numeric'})}</div>
        </div>
      </div>

      {/* Alert Auto Fix */}
      {autoFixed && (
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-start gap-3 animate-pulse">
            <AlertTriangle className="text-amber-600 shrink-0" />
            <div>
                <h4 className="font-bold text-amber-800">Phát hiện quên Check-out!</h4>
                <p className="text-sm text-amber-700 mt-1">
                    Hệ thống phát hiện bạn quên chấm công hôm qua. Ca làm việc cũ đã được tự động kết thúc vào lúc <b>23:59</b>. 
                    Vui lòng nhớ Check-out đúng giờ để tính lương chính xác.
                </p>
            </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT PANEL: ACTION */}
        <div className="lg:col-span-1 space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center justify-center text-center h-64">
                {loading ? <div className="text-slate-400">Đang xử lý...</div> : (
                    currentSession ? (
                        <>
                            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-4 animate-pulse">
                                <UserCheck size={40} className="text-emerald-600"/>
                            </div>
                            <h3 className="text-xl font-bold text-emerald-700 mb-1">ĐANG LÀM VIỆC</h3>
                            <p className="text-slate-500 mb-6">Bắt đầu: <b>{formatTime(currentSession.checkIn)}</b></p>
                            
                            <button 
                                onClick={handleCheckOut}
                                className="w-full py-3 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition shadow-lg shadow-rose-200 active:scale-95"
                            >
                                <LogOut size={20}/> KẾT THÚC CA
                            </button>
                        </>
                    ) : (
                        <>
                            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                                <Clock size={40} className="text-slate-400"/>
                            </div>
                            <h3 className="text-xl font-bold text-slate-700 mb-1">CHƯA VÀO CA</h3>
                            <p className="text-slate-500 mb-6">Vui lòng chấm công khi bắt đầu.</p>
                            
                            <button 
                                onClick={handleCheckIn}
                                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition shadow-lg shadow-emerald-200 active:scale-95"
                            >
                                <LogIn size={20}/> BẮT ĐẦU CA
                            </button>
                        </>
                    )
                )}
            </div>

            {user.role === 'MANAGER' && (
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
                    <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                        <UserCheck size={18}/> Nhân sự đang trực ({todayStaff.length})
                    </h3>
                    <div className="space-y-3 max-h-60 overflow-y-auto custom-scrollbar">
                        {todayStaff.length === 0 && <p className="text-sm text-slate-400 italic">Chưa có ai check-in.</p>}
                        {todayStaff.map(s => (
                            <div key={s.id} className="flex items-center justify-between text-sm p-2 bg-emerald-50 rounded-lg border border-emerald-100">
                                <div className="font-bold text-slate-700">{s.userName}</div>
                                <div className="text-emerald-600 font-mono">{formatTime(s.checkIn)}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>

        {/* RIGHT PANEL: HISTORY */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
            <div className="p-5 border-b border-slate-100 bg-slate-50">
                <h3 className="font-bold text-slate-700 flex items-center gap-2"><History size={18}/> Lịch sử chấm công của bạn</h3>
            </div>
            <div className="flex-1 overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead className="bg-white text-slate-500 border-b border-slate-100">
                        <tr>
                            <th className="p-4 font-bold">Ngày</th>
                            <th className="p-4 font-bold">Bắt đầu</th>
                            <th className="p-4 font-bold">Kết thúc</th>
                            <th className="p-4 font-bold">Tổng giờ</th>
                            <th className="p-4 font-bold text-center">Trạng thái</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {history.length === 0 && (
                            <tr><td colSpan="5" className="p-8 text-center text-slate-400">Chưa có dữ liệu chấm công.</td></tr>
                        )}
                        {history.map(item => (
                            <tr key={item.id} className="hover:bg-slate-50 transition">
                                <td className="p-4 font-medium text-slate-700">{formatDate(item.checkIn)}</td>
                                <td className="p-4 text-emerald-600 font-bold">{formatTime(item.checkIn)}</td>
                                <td className="p-4 text-rose-600 font-bold">
                                    {item.checkOut ? formatTime(item.checkOut) : '--:--'}
                                </td>
                                <td className="p-4 font-medium">
                                    {calculateDuration(item.checkIn, item.checkOut)}
                                    {item.note && <span className="ml-2 text-amber-500" title={item.note}>⚠️</span>}
                                </td>
                                <td className="p-4 text-center">
                                    <span className={`px-2 py-1 rounded text-xs font-bold ${item.status === 'WORKING' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                                        {item.status === 'WORKING' ? 'Đang làm' : 'Hoàn thành'}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>

      </div>
    </div>
  )
}