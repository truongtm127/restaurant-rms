import React, { useEffect, useState } from 'react'
import { collection, query, where, addDoc, updateDoc, doc, serverTimestamp, onSnapshot, getDocs, writeBatch } from 'firebase/firestore'
import { Clock, LogIn, LogOut, UserCheck, History, AlertTriangle, CheckCircle, XCircle, Hourglass, ShieldAlert } from 'lucide-react'
import { db } from '../../firebase'
import ConfirmModal from '../../components/UI/ConfirmModal' //

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
  if (!start || !end) return '...'
  const s = start.seconds ? start.seconds * 1000 : start
  const e = end.seconds ? end.seconds * 1000 : end
  const diff = (e - s) / (1000 * 60 * 60)
  return diff.toFixed(1) + ' giờ'
}

// --- COMPONENT ---

export default function Attendance({ user, showToast }) {
  const [currentSession, setCurrentSession] = useState(null)
  const [history, setHistory] = useState([])
  
  // State cho Manager
  const [todayStaff, setTodayStaff] = useState([]) 
  const [pendingRequests, setPendingRequests] = useState([]) 
  
  const [loading, setLoading] = useState(true)
  const [autoFixed, setAutoFixed] = useState(false)
  const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, title: '', message: '', action: null })

  // 1. Logic tự động chốt ca cũ
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
    
    // A. Current Session Listener (Nhân viên)
    const qCurrent = query(
      collection(db, 'attendance'),
      where('userId', '==', user.uid),
      where('date', '==', todayStr) 
    )
    
    const unsubCurrent = onSnapshot(qCurrent, (snap) => {
      if (snap.empty) {
        setCurrentSession(null)
      } else {
        const sessions = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        sessions.sort((a, b) => (b.checkIn?.seconds || 0) - (a.checkIn?.seconds || 0))
        const latest = sessions[0]
        
        if (latest.status !== 'COMPLETED') {
            setCurrentSession(latest)
        } else {
            setCurrentSession(null)
        }
      }
      setLoading(false)
    })

    // B. History Listener (Nhân viên)
    const qHistory = query(
      collection(db, 'attendance'),
      where('userId', '==', user.uid)
    )
    const unsubHistory = onSnapshot(qHistory, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      list.sort((a, b) => (b.checkIn?.seconds || 0) - (a.checkIn?.seconds || 0))
      setHistory(list.slice(0, 20))
    })

    // C. Manager View Listeners
    let unsubStaff = () => {}
    let unsubPending = () => {}

    if (user.role === 'MANAGER') {
        const qStaff = query(
            collection(db, 'attendance'), 
            where('status', '==', 'WORKING'),
            where('date', '==', todayStr)
        )
        unsubStaff = onSnapshot(qStaff, (snap) => {
            setTodayStaff(snap.docs.map(d => ({ id: d.id, ...d.data() })))
        })

        const qPending = query(
            collection(db, 'attendance'), 
            where('status', '==', 'PENDING'),
            where('date', '==', todayStr)
        )
        unsubPending = onSnapshot(qPending, (snap) => {
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
            list.sort((a, b) => (a.checkIn?.seconds || 0) - (b.checkIn?.seconds || 0))
            setPendingRequests(list)
        })
    }

    return () => { unsubCurrent(); unsubHistory(); unsubStaff(); unsubPending() }
  }, [user])

  // --- HANDLERS ---

  const handleCheckInRequest = async () => {
    if (autoFixed) setAutoFixed(false)
    setLoading(true)
    try {
      await addDoc(collection(db, 'attendance'), {
        userId: user.uid,
        userName: user.name || user.email,
        checkIn: serverTimestamp(),
        checkOut: null,
        status: 'PENDING',
        date: new Date().toISOString().slice(0, 10)
      })
      showToast("Đã gửi yêu cầu chấm công! Vui lòng đợi quản lý xác nhận.", "info")
    } catch (error) {
      console.error(error)
      showToast("Lỗi khi gửi yêu cầu", "error")
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
                showToast("✅ Đã Check-out thành công.", "success")
            } catch (error) {
                console.error(error)
                showToast("Lỗi khi Check-out", "error")
            } finally { 
                setLoading(false) 
            }
        }
    })
  }

  const handleAckReject = async () => {
      if(!currentSession) return
      try {
          await updateDoc(doc(db, 'attendance', currentSession.id), {
              status: 'CANCELLED_BY_USER'
          })
          setCurrentSession(null)
      } catch (e) {
          console.error(e)
      }
  }

  // --- MANAGER HANDLERS (Đã sửa để dùng Modal) ---

  const handleApprove = (item) => {
      setConfirmConfig({
          isOpen: true,
          title: "Xác nhận nhân viên",
          message: `Xác nhận nhân viên ${item.userName} đang có mặt và bắt đầu tính giờ làm?`,
          action: async () => {
              try {
                  await updateDoc(doc(db, 'attendance', item.id), {
                      status: 'WORKING'
                  })
                  showToast(`Đã xác nhận cho ${item.userName}`, "success")
              } catch (e) {
                  showToast("Lỗi hệ thống", "error")
              }
          }
      })
  }

  const handleReject = (item) => {
      setConfirmConfig({
          isOpen: true,
          title: "Từ chối chấm công",
          message: `Bạn có chắc chắn muốn TỪ CHỐI yêu cầu chấm công của ${item.userName}? Hành động này sẽ thông báo lỗi về phía nhân viên.`,
          action: async () => {
              try {
                  await updateDoc(doc(db, 'attendance', item.id), {
                      status: 'REJECTED',
                      checkOut: serverTimestamp(),
                      note: 'Quản lý từ chối chấm công'
                  })
                  showToast(`Đã từ chối ${item.userName}`, "info")
              } catch (e) {
                  showToast("Lỗi hệ thống", "error")
              }
          }
      })
  }

  return (
    <div className="space-y-6 animate-fadeIn pb-10">
      
      {/* Modal Xác Nhận Dùng Chung */}
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
                    Hệ thống phát hiện bạn quên chấm công hôm qua. Ca làm việc cũ đã được tự động kết thúc.
                </p>
            </div>
        </div>
      )}

      {/* --- MANAGER SECTION: PENDING REQUESTS --- */}
      {user.role === 'MANAGER' && pendingRequests.length > 0 && (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 p-5 rounded-2xl shadow-sm animate-pulse-slow">
              <h3 className="font-bold text-blue-800 mb-4 flex items-center gap-2">
                  <ShieldAlert size={20} className="animate-bounce"/> 
                  Yêu cầu chấm công ({pendingRequests.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {pendingRequests.map(req => (
                      <div key={req.id} className="bg-white p-4 rounded-xl shadow-sm flex items-center justify-between border border-blue-100">
                          <div>
                              <div className="font-bold text-slate-800">{req.userName}</div>
                              <div className="text-xs text-slate-500 flex items-center gap-1">
                                  <Clock size={12}/> {formatTime(req.checkIn)}
                              </div>
                          </div>
                          <div className="flex gap-2">
                              <button 
                                onClick={() => handleApprove(req)}
                                className="p-2 bg-emerald-100 text-emerald-600 rounded-lg hover:bg-emerald-200 transition"
                                title="Xác nhận đúng"
                              >
                                  <CheckCircle size={20}/>
                              </button>
                              <button 
                                onClick={() => handleReject(req)}
                                className="p-2 bg-rose-100 text-rose-600 rounded-lg hover:bg-rose-200 transition"
                                title="Từ chối (Sai)"
                              >
                                  <XCircle size={20}/>
                              </button>
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT PANEL: ACTION */}
        <div className="lg:col-span-1 space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center justify-center text-center h-72">
                {loading ? <div className="text-slate-400">Đang xử lý...</div> : (
                    currentSession ? (
                        /* --- TRƯỜNG HỢP 1: ĐANG LÀM VIỆC (WORKING) --- */
                        currentSession.status === 'WORKING' ? (
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
                        ) : 
                        /* --- TRƯỜNG HỢP 2: CHỜ DUYỆT (PENDING) --- */
                        currentSession.status === 'PENDING' ? (
                            <>
                                <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mb-4 animate-spin-slow">
                                    <Hourglass size={40} className="text-amber-600"/>
                                </div>
                                <h3 className="text-xl font-bold text-amber-700 mb-1">ĐANG CHỜ DUYỆT</h3>
                                <p className="text-slate-500 mb-2 text-sm px-4">
                                    Bạn đã chấm công lúc <b>{formatTime(currentSession.checkIn)}</b>.
                                    <br/>Vui lòng đợi quản lý xác nhận.
                                </p>
                                <div className="mt-4 px-3 py-1 bg-slate-100 rounded text-xs text-slate-500 font-mono">
                                    ID: {currentSession.id.slice(0,8)}...
                                </div>
                            </>
                        ) :
                        /* --- TRƯỜNG HỢP 3: BỊ TỪ CHỐI (REJECTED) --- */
                        currentSession.status === 'REJECTED' ? (
                            <>
                                <div className="w-20 h-20 bg-rose-100 rounded-full flex items-center justify-center mb-4">
                                    <XCircle size={40} className="text-rose-600"/>
                                </div>
                                <h3 className="text-xl font-bold text-rose-700 mb-1">YÊU CẦU BỊ TỪ CHỐI</h3>
                                <p className="text-slate-600 mb-4 text-sm px-2">
                                    Quản lý xác nhận bạn <b>không đi làm</b> hoặc chấm công sai.
                                    <br/>Vui lòng liên hệ quản lý ngay.
                                </p>
                                <button 
                                    onClick={handleAckReject}
                                    className="w-full py-3 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl transition"
                                >
                                    Đã hiểu / Thử lại
                                </button>
                            </>
                        ) : null
                    ) : (
                        /* --- TRƯỜNG HỢP 4: CHƯA CHẤM CÔNG --- */
                        <>
                            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                                <Clock size={40} className="text-slate-400"/>
                            </div>
                            <h3 className="text-xl font-bold text-slate-700 mb-1">CHƯA VÀO CA</h3>
                            <p className="text-slate-500 mb-6">Vui lòng chấm công khi bắt đầu.</p>
                            
                            <button 
                                onClick={handleCheckInRequest}
                                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition shadow-lg shadow-blue-200 active:scale-95"
                            >
                                <LogIn size={20}/> CHẤM CÔNG
                            </button>
                        </>
                    )
                )}
            </div>

            {/* List nhân viên đang làm */}
            {user.role === 'MANAGER' && (
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
                    <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                        <UserCheck size={18}/> Đang làm việc ({todayStaff.length})
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
                                    {item.status === 'WORKING' || item.status === 'PENDING' ? '...' : calculateDuration(item.checkIn, item.checkOut)}
                                    {item.note && <span className="ml-2 text-amber-500" title={item.note}>⚠️</span>}
                                </td>
                                <td className="p-4 text-center">
                                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                                        item.status === 'WORKING' ? 'bg-emerald-100 text-emerald-700' : 
                                        item.status === 'PENDING' ? 'bg-amber-100 text-amber-700' :
                                        item.status === 'REJECTED' ? 'bg-rose-100 text-rose-700' :
                                        'bg-slate-100 text-slate-500'
                                    }`}>
                                        {item.status === 'WORKING' ? 'Đang làm' : 
                                         item.status === 'PENDING' ? 'Chờ duyệt' :
                                         item.status === 'REJECTED' ? 'Bị từ chối' : 'Hoàn thành'}
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